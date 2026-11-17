import { receivableDocumentSource } from "./receivable-service";
import { internalInvoicePrintable } from "./internal-document";
import type { PrintableDocument } from "./commercial-pdf";
import { inputMessage } from "./document-display";
import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { sql } from "drizzle-orm";
import {
  executeBusinessAction,
  executeBusinessRead,
  revalidateBusinessPath,
} from "./business-action";
import { currentBusinessContext } from "./business-context";
import { inAuthenticatedUserContext } from "./authenticated-user-context";
import { getAccessContext } from "./server-access";
import { executeCommercial } from "./commercial-service";
import { storedCommand, recoverStored } from "./stored-command";
import {
  documentCommandSchema,
  defaultDocumentDesign,
  documentImageSize,
  type DocumentCommand,
  type DocumentResult,
  type TemplateDto,
  type DocumentIssue,
  type DocumentDesign,
} from "./document-design";
import type { SessionUser } from "./actions/session-helpers";
function context() {
  const value = currentBusinessContext();
  if (!value) throw new Error("Falta transacción documental.");
  return value;
}
function must(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
export async function executeDocuments(
  user: SessionUser,
  input: unknown,
  device: string | null = null,
  branches?: string[],
): Promise<DocumentResult> {
  try {
    const c = documentCommandSchema.parse(input);
    const runner = ["templates", "read"].includes(c.action)
      ? executeBusinessRead
      : executeBusinessAction;
    return await inAuthenticatedUserContext(user, () =>
      runner(user, async (): Promise<DocumentResult> => {
        const { tx } = context();
        if (device) context().deviceId = device;
        if (branches) context().sucursalIds = branches;
        const access = await getAccessContext(user);
        must(
          !access.suscripcionBloqueada &&
            (access.plan.features.cotizaciones ||
              access.plan.features.facturacion),
          "Tu plan no permite documentos.",
        );
        const permission = [
          "createTemplate",
          "saveTemplate",
          "duplicateTemplate",
        ].includes(c.action)
          ? "disenar"
          : c.action === "issue"
            ? "emitir"
            : c.action === "print"
              ? "imprimir"
              : "ver";
        must(
          access.permisos.includes("documento.ver") &&
            access.permisos.includes("documento." + permission),
          "No tienes el permiso documental requerido.",
        );
        if (branches)
          must(
            branches.includes(c.sucursalId),
            "Sucursal no autorizada para este equipo.",
          );
        const valid = await tx.execute(
          sql`select s.id from sucursales s join usuarios u on u.id=${user.id}::uuid and u.empresa_id=s.empresa_id and u.activo and u.eliminado_en is null where s.id=${c.sucursalId}::uuid and s.empresa_id=${user.empresaId}::uuid and s.activa and s.eliminado_en is null and (not exists(select 1 from usuario_sucursales us join sucursales a on a.id=us.sucursal_id where us.usuario_id=u.id and a.empresa_id=s.empresa_id) or exists(select 1 from usuario_sucursales us where us.usuario_id=u.id and us.sucursal_id=s.id))`,
        );
        must(valid.length, "Sucursal no autorizada.");
        const scope = {
          branch: c.sucursalId,
          kind: "documental",
          requestId: c.requestId,
        };
        let result: DocumentResult;
        if (c.action === "recover") {
          must(c.attemptId, "Falta intento.");
          result = await recoverStored<DocumentResult>(scope, c.attemptId);
        } else if (["templates", "read"].includes(c.action))
          result = await execute(user, c, device);
        else
          result = await storedCommand(scope, c, () =>
            execute(user, c, device),
          );
        if (result.ok && result.issue)
          await assertDocumentSourceAccess(
            user,
            result.issue.sourceKind,
            c.action === "print",
          );
        return result.ok ? { ...result, permissions: access.permisos } : result;
      }),
    );
  } catch (error) {
    return {
      ok: false,
      error: inputMessage(error, "No se pudo completar el documento."),
    };
  }
}

async function assertDocumentSourceAccess(
  user: SessionUser,
  kind: string,
  print: boolean,
) {
  const access = await getAccessContext(user);
  if (kind === "cotizacion" || kind === "proforma") {
    must(
      access.plan.features.cotizaciones &&
        access.permisos.includes(`${kind}.${print ? "imprimir" : "ver"}`),
      "No tienes acceso al documento comercial de origen.",
    );
    return;
  }
  if (kind === "factura" || kind === "venta") {
    must(
      access.plan.features.facturacion &&
        access.permisos.includes("ventas.ver"),
      "No tienes acceso al comprobante de la venta.",
    );
    return;
  }
  if (["nota_credito", "recibo", "estado_cuenta"].includes(kind)) {
    must(
      access.plan.features.cuentas_por_cobrar &&
        access.permisos.includes("cxc.ver") &&
        (!print || access.permisos.includes("cxc.imprimir")),
      "Sin permiso para el documento financiero.",
    );
    return;
  }
  throw new Error("Tipo de documento no disponible en esta versión.");
}

export function validateTemplateImage(design: DocumentDesign) {
  if (!design.logoData) return;
  const bytes = Buffer.from(design.logoData.split(",")[1], "base64");
  must(bytes.length <= 200000, "El logo debe ocupar como máximo 200 KB.");
  const { width, height } = documentImageSize(bytes);
  must(
    width > 0 && height > 0 && width <= 1024 && height <= 1024,
    "El logo debe ser PNG/JPEG raster y tener hasta 1024 × 1024 píxeles.",
  );
}
async function audit(
  user: SessionUser,
  c: DocumentCommand,
  device: string | null,
  action: string,
  reference: { document?: string; template?: string; version: number },
  data: unknown = {},
) {
  await context().tx.execute(
    sql`insert into documento_eventos(empresa_id,sucursal_id,documento_id,plantilla_id,version,accion,usuario_id,device_id,correlation_id,datos) values(${user.empresaId}::uuid,${c.sucursalId}::uuid,${reference.document ?? null}::uuid,${reference.template ?? null}::uuid,${reference.version},${action},${user.id}::uuid,${device}::uuid,${c.requestId}::uuid,${JSON.stringify(data)}::jsonb)`,
  );
  await context().tx.execute(
    sql`insert into auditoria(empresa_id,usuario_id,accion,tabla,registro_id,datos_despues) values(${user.empresaId}::uuid,${user.id}::uuid,${"documento." + action},'documentos',${reference.document ?? reference.template ?? null},${JSON.stringify({ sucursalId: c.sucursalId, device, correlationId: c.requestId, ...reference, data })}::jsonb)`,
  );
}
async function template(user: SessionUser, id: string): Promise<TemplateDto> {
  const { tx } = context();
  const [row] = await tx.execute(
    sql`select id,nombre as name,version from documento_plantillas where empresa_id=${user.empresaId}::uuid and id=${id}::uuid for update`,
  );
  must(row, "Plantilla no encontrada.");
  const versions = await tx.execute(
    sql`select version,case when version=${Number(row.version)} then design else null end as design from documento_plantilla_versiones where empresa_id=${user.empresaId}::uuid and plantilla_id=${id}::uuid order by version desc`,
  );
  return { ...row, versions: [...versions] } as unknown as TemplateDto;
}
async function issue(
  user: SessionUser,
  id: string,
  branch: string,
): Promise<DocumentIssue> {
  const { tx } = context();
  const [r] = await tx.execute(
    sql`select id,origen_tipo as "sourceKind",origen_id as "sourceId",origen_version as "sourceVersion",numero,ejemplar,origen_version as version,snapshot,design from documento_emisiones where empresa_id=${user.empresaId}::uuid and sucursal_id=${branch}::uuid and id=${id}::uuid`,
  );
  must(r, "Documento no encontrado.");
  const events = await tx.execute(
    sql`select e.accion,u.nombre as usuario,e.creado_en as fecha from documento_eventos e join usuarios u on u.id=e.usuario_id where e.empresa_id=${user.empresaId}::uuid and e.documento_id=${id}::uuid order by e.creado_en,e.id`,
  );
  return { ...r, events: [...events] } as unknown as DocumentIssue;
}
async function execute(
  user: SessionUser,
  c: DocumentCommand,
  device: string | null,
): Promise<DocumentResult> {
  const { tx } = context();
  if (c.action === "templates") {
    const rows = await tx.execute(
      sql`select p.id,p.nombre as name,p.version,jsonb_agg(jsonb_build_object('version',v.version,'design',case when v.version=p.version then v.design else null end) order by v.version desc) as versions from documento_plantillas p join documento_plantilla_versiones v on v.empresa_id=p.empresa_id and v.plantilla_id=p.id where p.empresa_id=${user.empresaId}::uuid group by p.id order by p.nombre,p.id limit 200`,
    );
    return { ok: true, templates: [...rows] as unknown as TemplateDto[] };
  }
  if (
    ["createTemplate", "saveTemplate", "duplicateTemplate"].includes(c.action)
  ) {
    let id = c.id,
      version = 1,
      design = c.design,
      name = c.name;
    if (c.action === "duplicateTemplate") {
      must(id, "Selecciona una plantilla.");
      const original = await template(user, id);
      design = original.versions.find(
        (v) => v.version === original.version,
      )!.design!;
      name = name ?? original.name + " (copia)";
      id = undefined;
    }
    must(design, "Configura el diseño.");
    must(name, "Indica el nombre.");
    validateTemplateImage(design);
    if (c.action === "saveTemplate") {
      must(id, "Selecciona una plantilla.");
      const original = await template(user, id);
      must(
        original.version === c.expectedVersion,
        "La plantilla cambió. Recarga antes de guardar.",
      );
      version = original.version + 1;
      await tx.execute(
        sql`update documento_plantillas set nombre=${name},version=${version} where empresa_id=${user.empresaId}::uuid and id=${id}::uuid`,
      );
    } else {
      id = randomUUID();
      await tx.execute(
        sql`insert into documento_plantillas(id,empresa_id,nombre,creado_por) values(${id}::uuid,${user.empresaId}::uuid,${name},${user.id}::uuid)`,
      );
    }
    await tx.execute(
      sql`insert into documento_plantilla_versiones(empresa_id,plantilla_id,version,design,usuario_id,device_id) values(${user.empresaId}::uuid,${id}::uuid,${version},${JSON.stringify(design)}::jsonb,${user.id}::uuid,${device}::uuid)`,
    );
    await audit(user, c, device, c.action, { template: id, version });
    revalidateBusinessPath("/documentos");
    return { ok: true, template: await template(user, id) };
  }
  if (c.action === "read") {
    must(c.id, "Selecciona un documento.");
    return { ok: true, issue: await issue(user, c.id, c.sucursalId) };
  }
  if (c.action === "print") {
    must(c.id, "Selecciona un documento.");
    const d = await issue(user, c.id, c.sucursalId);
    await audit(user, c, device, "impresion_solicitada", {
      document: d.id,
      version: d.version,
    });
    return { ok: true, issue: await issue(user, d.id, c.sucursalId) };
  }
  must(
    c.action === "issue" && c.sourceId && c.sourceKind,
    "Selecciona el documento de origen.",
  );
  let design = defaultDocumentDesign,
    version = 0;
  if (c.templateId) {
    must(c.templateVersion, "Selecciona una versión de plantilla.");
    const t = await template(user, c.templateId);
    const [selected] = await tx.execute(
      sql`select version,design from documento_plantilla_versiones where empresa_id=${user.empresaId}::uuid and plantilla_id=${t.id}::uuid and version=${c.templateVersion}`,
    );
    must(selected, "Versión de plantilla no encontrada.");
    design = selected.design as DocumentDesign;
    version = Number(selected.version);
  }
  let snapshot: PrintableDocument;
  if (c.sourceKind === "factura" || c.sourceKind === "venta") {
    await assertDocumentSourceAccess(user, c.sourceKind, false);
    const [invoice] = await tx.execute(
      sql`select f.id,f.venta_id,f.numero,f.snapshot,v.estado,v.sucursal_id from facturas f join ventas v on v.id=f.venta_id and v.empresa_id=f.empresa_id where f.empresa_id=${user.empresaId}::uuid and v.sucursal_id=${c.sucursalId}::uuid and ${c.sourceKind === "venta" ? sql`f.venta_id=${c.sourceId}::uuid` : sql`f.id=${c.sourceId}::uuid`}`,
    );
    must(invoice, "Comprobante no encontrado en esta sucursal.");
    snapshot = internalInvoicePrintable(
      invoice as unknown as Parameters<typeof internalInvoicePrintable>[0],
    );
    c = { ...c, sourceKind: "factura", sourceId: String(invoice.id) };
  } else if (
    ["nota_credito", "recibo", "estado_cuenta"].includes(c.sourceKind)
  ) {
    await assertDocumentSourceAccess(user, c.sourceKind, true);
    snapshot = await receivableDocumentSource(
      user,
      c.sourceKind,
      c.sourceId,
      c.sucursalId,
    );
  } else {
    must(
      c.sourceKind === "cotizacion" || c.sourceKind === "proforma",
      "Este tipo se habilitará en el incremento financiero.",
    );
    const source = await executeCommercial(
      user,
      {
        action: "detail",
        requestId: randomUUID(),
        kind: c.sourceKind,
        sucursalId: c.sucursalId,
        id: c.sourceId,
      },
      device,
    );
    must(
      source.ok && source.document,
      source.ok ? "Origen no encontrado." : source.error,
    );
    const revision = source.document.revisions.find(
      (r) => r.version === c.sourceVersion,
    );
    must(revision, "Revisión de origen no encontrada.");
    snapshot = {
      ...source.document,
      events: [],
      revisions: [],
      version: revision.version,
      estado:
        revision.version === source.document.version
          ? source.document.estado
          : "historica",
      snapshot: revision.snapshot,
    };
    const access = await getAccessContext(user);
    must(
      access.permisos.includes(`${c.sourceKind}.imprimir`),
      "No tienes permiso para imprimir el origen.",
    );
  }
  must(
    c.sourceVersion === snapshot.version,
    "La revisión del origen cambió. Actualiza la pantalla.",
  );
  const [previous] = await tx.execute(
    sql`select id from documento_emisiones where empresa_id=${user.empresaId}::uuid and origen_tipo=${c.sourceKind} and origen_id=${c.sourceId}::uuid and origen_version=${snapshot.version} and origen_estado=${snapshot.estado} and plantilla_id is not distinct from ${c.templateId ?? null}::uuid and plantilla_version=${version} and ejemplar=${c.ejemplar}`,
  );
  if (previous) {
    await audit(user, c, device, "reimpresion_preparada", {
      document: String(previous.id),
      version: snapshot.version,
    });
    return {
      ok: true,
      issue: await issue(user, String(previous.id), c.sucursalId),
    };
  }
  const id = randomUUID();
  await tx.execute(
    sql`insert into documento_emisiones(id,empresa_id,sucursal_id,origen_tipo,origen_id,origen_version,origen_estado,numero,plantilla_id,plantilla_version,ejemplar,snapshot,design,usuario_id,device_id) values(${id}::uuid,${user.empresaId}::uuid,${c.sucursalId}::uuid,${c.sourceKind},${c.sourceId}::uuid,${snapshot.version},${snapshot.estado},${snapshot.numero},${c.templateId ?? null}::uuid,${version},${c.ejemplar},${JSON.stringify(snapshot)}::jsonb,${JSON.stringify(design)}::jsonb,${user.id}::uuid,${device}::uuid)`,
  );
  await audit(
    user,
    c,
    device,
    "emision_interna",
    { document: id, template: c.templateId, version: snapshot.version },
    {
      sourceKind: c.sourceKind,
      sourceId: c.sourceId,
      templateVersion: version,
      fiscal: false,
    },
  );
  return { ok: true, issue: await issue(user, id, c.sucursalId) };
}
