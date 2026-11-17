import {inputMessage} from './document-display';
import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  executeBusinessAction,
  executeBusinessRead,
  revalidateBusinessPath,
} from "./business-action";
import { currentBusinessContext } from "./business-context";
import { getAccessContext } from "./server-access";
import { procesarVenta } from "./actions/ventas";
import type { SessionUser } from "./actions/session-helpers";
import { inAuthenticatedUserContext } from "./authenticated-user-context";
import {
  commercialCommandSchema,
  commercialAmounts,
  commercialLegend,
  assertCommercialTransition,
  type CommercialCommand,
  type CommercialDocument,
  type CommercialDraft,
  type CommercialResult,
  type CommercialSnapshot,
  type CommercialState,
} from "./commercial-core";

type Origin = {
  id: string;
  empresa_id: string;
  sucursal_id: string;
  cotizacion_id: string | null;
  version: number;
  estado: CommercialState;
  venta_id: string | null;
};
function tx() {
  const context = currentBusinessContext();
  if (!context) throw new Error("Falta transacción comercial.");
  return context.tx;
}
function must(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => [k, canonical(v)]),
        )
      : value;

/** Both authenticated Web and Desktop enter the existing root transaction. No local sale engine. */
export async function executeCommercial(
  user: SessionUser,
  raw: unknown,
  deviceId: string | null = null,
  branches?: string[],
): Promise<CommercialResult> {
  try {
    const c = commercialCommandSchema.parse(raw);
    const runner=['list','detail','options'].includes(c.action)?executeBusinessRead:executeBusinessAction;
    return await inAuthenticatedUserContext(user, () =>
      runner(user, async (): Promise<CommercialResult> => {
        const context = currentBusinessContext();
        must(context, "Falta contexto comercial.");
        if (deviceId) context.deviceId = deviceId;
        if (branches) context.sucursalIds = branches;
        const access = await getAccessContext(user);
        must(
          !access.suscripcionBloqueada && access.plan.features.cotizaciones,
          "Tu plan no permite documentos comerciales.",
        );
        const actionPermission: Record<string, string> = {
          list: "ver",
          detail: "ver",
          options: "ver",
          recover: "ver",
          create: "crear",
          edit: "editar",
          revise: "editar",
          duplicate: "duplicar",
          derive: "ver",
          state:
            c.state === "aceptada"
              ? "aceptar"
              : c.state === "rechazada"
                ? "rechazar"
                : c.state === "enviada"
                  ? "enviar"
                  : "editar",
          convert: "convertir",
          pdf: "imprimir",
          print: "imprimir",
          profile: "ver",
        };
        const has = (p: string) => access.permisos.includes(p);
        must(
          has(`${c.kind}.${actionPermission[c.action]}`),
          "No tienes el permiso comercial requerido.",
        );
        if (c.action === "derive")
          must(
            has("proforma.crear"),
            "No tienes permiso para crear proformas.",
          );
        if (c.action === "profile")
          must(
            has("documental.configurar"),
            "No tienes permiso para configurar el perfil documental.",
          );
        await assertBranch(user, c.sucursalId, branches);
        if (c.draft)
          must(
            c.draft.sucursalId === c.sucursalId,
            "La sucursal del borrador no coincide.",
          );
        if (c.action === "recover") {
          must(c.attemptId, "Falta el intento original.");
          const [previous] = await tx().execute(
            sql`select resultado,sucursal_id,clase from comercial_intentos where empresa_id=${user.empresaId}::uuid and usuario_id=${user.id}::uuid and request_id=${c.attemptId}::uuid`,
          );
          if (previous) {
            must(
              previous.sucursal_id === c.sucursalId &&
                previous.clase === c.kind,
              "Intento de otra sucursal o clase.",
            );
            return previous.resultado as CommercialResult;
          }
          const discarded = { ok: true as const, discarded: true };
          await tx().execute(
            sql`insert into comercial_intentos(empresa_id,usuario_id,request_id,sucursal_id,clase,hash,resultado) values(${user.empresaId}::uuid,${user.id}::uuid,${c.attemptId}::uuid,${c.sucursalId}::uuid,${c.kind},'discarded',${JSON.stringify(discarded)}::jsonb)`,
          );
          return discarded;
        }
        const readonly = ["list", "detail", "options"].includes(c.action);
        const hash = createHash("sha256")
          .update(JSON.stringify(canonical(c)))
          .digest("hex");
        if (!readonly) {
          const [previous] = await tx().execute(
            sql`select hash,resultado from comercial_intentos where empresa_id=${user.empresaId}::uuid and usuario_id=${user.id}::uuid and request_id=${c.requestId}::uuid`,
          );
          if (previous) {
            must(
              previous.hash !== "discarded",
              "Este intento se descartó sin efectos. Crea un intento nuevo.",
            );
            must(
              previous.hash === hash,
              "La clave de intento ya corresponde a otro contenido.",
            );
            return previous.resultado as CommercialResult;
          }
        }
        const result = await command(user, c, deviceId, access.permisos);
        if (result.ok && !readonly) {
          await tx().execute(
            sql`insert into comercial_intentos(empresa_id,usuario_id,request_id,sucursal_id,clase,hash,resultado) values(${user.empresaId}::uuid,${user.id}::uuid,${c.requestId}::uuid,${c.sucursalId}::uuid,${c.kind},${hash},${JSON.stringify(result)}::jsonb)`,
          );
          revalidateBusinessPath("/cotizaciones");
          revalidateBusinessPath("/proformas");
        }
        return result;
      }),
    );
  } catch (error) {
    return {
      ok: false,
      error: inputMessage(error,"No se pudo completar el documento."),
    };
  }
}

async function assertBranch(
  user: SessionUser,
  id: string,
  branches?: string[],
) {
  if (branches)
    must(branches.includes(id), "Sucursal no autorizada para el dispositivo.");
  const rows = await tx()
    .execute(sql`select s.id from sucursales s join usuarios actor on actor.id=${user.id}::uuid and actor.empresa_id=s.empresa_id and actor.activo and actor.eliminado_en is null where s.id=${id}::uuid and s.empresa_id=${user.empresaId}::uuid and s.activa and s.eliminado_en is null
    and (not exists(select 1 from usuario_sucursales us join sucursales a on a.id=us.sucursal_id where us.usuario_id=${user.id}::uuid and a.empresa_id=s.empresa_id)
    or exists(select 1 from usuario_sucursales us where us.usuario_id=${user.id}::uuid and us.sucursal_id=s.id))`);
  must(rows.length, "Sucursal no autorizada.");
}
async function origin(
  user: SessionUser,
  c: CommercialCommand,
): Promise<Origin> {
  must(c.id, "Falta el documento.");
  const rows = await tx().execute(
    c.kind === "cotizacion"
      ? sql`select o.* from comercial_origenes o where o.cotizacion_id=${c.id}::uuid and o.empresa_id=${user.empresaId}::uuid and o.sucursal_id=${c.sucursalId}::uuid ${c.action==='detail'?sql``:sql`for update`}`
      : sql`select o.* from comercial_origenes o join proformas p on p.origen_id=o.id and p.empresa_id=o.empresa_id where p.id=${c.id}::uuid and o.empresa_id=${user.empresaId}::uuid and o.sucursal_id=${c.sucursalId}::uuid ${c.action==='detail'?sql``:sql`for update of o`}`,
  );
  must(rows[0], "Documento no encontrado en esta sucursal.");
  return rows[0] as unknown as Origin;
}
async function snapshot(
  user: SessionUser,
  d: CommercialDraft,
): Promise<CommercialSnapshot> {
  const [company] = await tx().execute(
    sql`select e.razon_social as nombre,e.nombre_comercial as "nombreComercial",e.direccion,e.telefono,e.email,e.logo_url as "logoUrl",p.ruc,coalesce(p.perfil,'configuracion_pendiente') as "perfilFiscal",e.moneda from empresas e left join perfiles_documentales p on p.empresa_id=e.id where e.id=${user.empresaId}::uuid`,
  );
  must(company, "Empresa no disponible.");
  // The current sales Core has no per-sale FX. Preserve parity instead of silently converting currency.
  must(
    d.moneda === company.moneda,
    "Usa la moneda operativa de la empresa; conversión multimoneda no disponible.",
  );
  let customer: CommercialSnapshot["cliente"] = null;
  if (d.clienteId) {
    const [r] = await tx().execute(
      sql`select nombre,identificacion_fiscal as identificacion from clientes where id=${d.clienteId}::uuid and empresa_id=${user.empresaId}::uuid and activo and eliminado_en is null`,
    );
    must(r, "Cliente no autorizado.");
    customer = r as CommercialSnapshot["cliente"];
  }
  const calculated = commercialAmounts(d),
    items: CommercialSnapshot["items"] = [];
  for (const line of calculated.items) {
    const [product] = await tx().execute(
      sql`select nombre from productos where id=${line.productoId}::uuid and empresa_id=${user.empresaId}::uuid and activo and eliminado_en is null`,
    );
    must(product, "Producto no autorizado o inactivo.");
    items.push({ ...line, nombre: String(product.nombre) });
  }
  return {
    ...d,
    issuer: company as CommercialSnapshot["issuer"],
    cliente: customer,
    vendedor: user.nombre,
    items,
    amounts: calculated.amounts,
    documental: {
      schemaVersion: 1,
      clase: "oferta_comercial",
      fiscal: false,
      serie: null,
      autorizacion: null,
      ejemplar: "original",
      pie: commercialLegend,
    },
  };
}
async function currentSnapshot(o: Origin) {
  const [r] = await tx().execute(
    sql`select snapshot from comercial_revisiones where empresa_id=${o.empresa_id}::uuid and origen_id=${o.id}::uuid and version=${o.version}`,
  );
  must(r, "Revisión no encontrada.");
  return r.snapshot as CommercialSnapshot;
}
async function event(
  user: SessionUser,
  c: CommercialCommand,
  o: Origin,
  device: string | null,
  action: string,
  data: unknown = {},
) {
  await tx()
    .execute(sql`insert into comercial_eventos(empresa_id,origen_id,version,documento_id,clase,accion,usuario_id,device_id,correlation_id,motivo,evidencia,datos)
    values(${user.empresaId}::uuid,${o.id}::uuid,${c.documentVersion ?? o.version},${c.id}::uuid,${c.kind},${action},${user.id}::uuid,${device}::uuid,${c.requestId}::uuid,${c.reason || null},${c.evidence || null},${JSON.stringify(data)}::jsonb)`);
  await tx().execute(
    sql`insert into auditoria(empresa_id,usuario_id,accion,tabla,registro_id,datos_despues) values(${user.empresaId}::uuid,${user.id}::uuid,${`comercial.${action}`},${c.kind},${c.id},${JSON.stringify({ sucursalId: o.sucursal_id, deviceId: device, correlationId: c.requestId, version: c.documentVersion ?? o.version, resultado: "confirmado", data })}::jsonb)`,
  );
}
async function doc(
  user: SessionUser,
  c: CommercialCommand,
  o: Origin,
): Promise<CommercialDocument> {
  const [n] = await tx().execute(
    c.kind === "cotizacion"
      ? sql`select numero from cotizaciones where id=${c.id}::uuid and empresa_id=${user.empresaId}::uuid`
      : sql`select numero from proformas where id=${c.id}::uuid and empresa_id=${user.empresaId}::uuid`,
  );
  const revisions = await tx().execute(
    sql`select version,snapshot from comercial_revisiones where empresa_id=${user.empresaId}::uuid and origen_id=${o.id}::uuid order by version desc`,
  );
  const events=await tx().execute(sql`select * from (
    select 'c:'||e.id::text as id,e.usuario_id as "actorId",e.accion,u.nombre as usuario,e.creado_en as fecha,e.version,e.motivo,e.datos->'changed' as changed,e.device_id as "deviceId" from comercial_eventos e join usuarios u on u.id=e.usuario_id where e.empresa_id=${user.empresaId}::uuid and e.origen_id=${o.id}::uuid
    union all
    select 'd:'||e.id::text,e.usuario_id,'documento.'||e.accion,u.nombre,e.creado_en,e.version,null::text,null::jsonb,e.device_id from documento_eventos e join documento_emisiones d on d.id=e.documento_id and d.empresa_id=e.empresa_id join usuarios u on u.id=e.usuario_id where e.empresa_id=${user.empresaId}::uuid and ((d.origen_tipo='cotizacion' and d.origen_id=${o.cotizacion_id}::uuid) or(d.origen_tipo='proforma' and d.origen_id in(select id from proformas where empresa_id=${user.empresaId}::uuid and origen_id=${o.id}::uuid)))
    ) history order by fecha,id`);
  return {
    id: c.id!,
    kind: c.kind,
    origenId: o.id,
    numero: String(n.numero),
    version: o.version,
    estado: o.estado,
    ventaId: o.venta_id,
    snapshot: await currentSnapshot(o),
    events: [...events] as unknown as CommercialDocument["events"],
    revisions: [...revisions] as unknown as CommercialDocument["revisions"],
  };
}
async function mirrorQuote(
  o: Origin,
  s: CommercialSnapshot,
  newRevision = false,
) {
  if (!o.cotizacion_id) return;
  await tx().execute(
    sql`update cotizaciones set cliente_id=${s.clienteId}::uuid,fecha=${s.fecha}::date,vigente_hasta=${s.vigenteHasta}::date,estado=${o.estado},subtotal=${s.amounts.subtotal},descuento=${s.amounts.descuentoTotal},impuesto=${s.amounts.impuesto},total=${s.amounts.total},notas=${s.observaciones},venta_id=${o.venta_id}::uuid where id=${o.cotizacion_id}::uuid and empresa_id=${o.empresa_id}::uuid`,
  );
  if (newRevision)
    for (const line of s.items)
      await tx().execute(
        sql`insert into cotizacion_detalle(cotizacion_id,revision_oferta,producto_id,cantidad,precio_unitario,descuento,impuesto,subtotal) values(${o.cotizacion_id}::uuid,${o.version},${line.productoId}::uuid,${line.cantidad},${line.precioUnitario},${line.descuento},${line.impuesto},${line.subtotal})`,
      );
}
async function command(
  user: SessionUser,
  c: CommercialCommand,
  device: string | null,
  permissions: string[],
): Promise<CommercialResult> {
  if (c.action === "options") {
    const products = await tx().execute(
      sql`select p.id,p.nombre,p.precio_base as precio,coalesce(i.tasa,0)::float as tasa from productos p left join impuestos i on i.id=p.impuesto_id and i.empresa_id=p.empresa_id where p.empresa_id=${user.empresaId}::uuid and p.activo and p.eliminado_en is null order by p.nombre limit 2000`,
    );
    const customers = await tx().execute(
      sql`select id,nombre from clientes where empresa_id=${user.empresaId}::uuid and activo and eliminado_en is null order by nombre limit 2000`,
    );
    const warehouses = await tx().execute(
      sql`select id,nombre from almacenes where empresa_id=${user.empresaId}::uuid and sucursal_id=${c.sucursalId}::uuid and activo order by nombre`,
    );
    const methods = await tx().execute(
      sql`select id,nombre,codigo from formas_pago where empresa_id=${user.empresaId}::uuid and activa order by nombre`,
    );
    const sessions=await tx().execute(sql`select s.id,c.nombre as nombre from sesiones_caja s join cajas c on c.id=s.caja_id and c.empresa_id=s.empresa_id where s.empresa_id=${user.empresaId}::uuid and c.sucursal_id=${c.sucursalId}::uuid and s.estado='abierta' order by c.nombre,c.id`);
    const [p] = await tx().execute(
      sql`select perfil,ruc from perfiles_documentales where empresa_id=${user.empresaId}::uuid`,
    );
    return {
      ok: true,
      options: {
        products,
        customers,
        warehouses,
        sessions,
        methods,
        permissions,
        profile: p ?? { perfil: "configuracion_pendiente", ruc: null },
      } as unknown as Extract<CommercialResult, { ok: true }>["options"],
    };
  }
  if (c.action === "profile") {
    must(c.profile, "Falta perfil.");
    must(
      c.profile.perfil !== "registrado" || c.profile.ruc?.trim(),
      "Un perfil registrado requiere RUC; los demás no.",
    );
    await tx().execute(
      sql`insert into perfiles_documentales(empresa_id,perfil,ruc,actualizado_por) values(${user.empresaId}::uuid,${c.profile.perfil},${c.profile.ruc},${user.id}::uuid) on conflict(empresa_id) do update set perfil=excluded.perfil,ruc=excluded.ruc,actualizado_por=excluded.actualizado_por,actualizado_en=now()`,
    );
    await tx().execute(
      sql`insert into auditoria(empresa_id,usuario_id,accion,tabla,registro_id,datos_despues) values(${user.empresaId}::uuid,${user.id}::uuid,'documental.perfil','perfiles_documentales',${user.empresaId},${JSON.stringify({ ...c.profile, device, correlationId: c.requestId, fiscal: false })}::jsonb)`,
    );
    return { ok: true };
  }
  if (c.action === "list") {
    const rows = await tx().execute(
      c.kind === "cotizacion"
        ? sql`select o.*,q.id as document_id,q.numero from comercial_origenes o join cotizaciones q on q.id=o.cotizacion_id and q.empresa_id=o.empresa_id join comercial_revisiones r on r.empresa_id=o.empresa_id and r.origen_id=o.id and r.version=o.version where o.empresa_id=${user.empresaId}::uuid and o.sucursal_id=${c.sucursalId}::uuid and (${c.filter ?? null}::text is null or o.estado=${c.filter ?? null}) and (strpos(lower(q.numero||' '||coalesce(r.snapshot->'cliente'->>'nombre','')),lower(${c.query}))>0) order by q.creado_en desc,q.id limit 50 offset ${c.offset}`
        : sql`select o.*,p.id as document_id,p.numero from comercial_origenes o join proformas p on p.origen_id=o.id and p.empresa_id=o.empresa_id join comercial_revisiones r on r.empresa_id=o.empresa_id and r.origen_id=o.id and r.version=o.version where o.empresa_id=${user.empresaId}::uuid and o.sucursal_id=${c.sucursalId}::uuid and (${c.filter ?? null}::text is null or o.estado=${c.filter ?? null}) and strpos(lower(p.numero||' '||coalesce(r.snapshot->'cliente'->>'nombre','')),lower(${c.query}))>0 order by p.creado_en desc,p.id limit 50 offset ${c.offset}`,
    );
    const documents = [];
    for (const r of rows)
      documents.push(
        await doc(
          user,
          { ...c, id: String(r.document_id) },
          r as unknown as Origin,
        ),
      );
    return { ok: true, documents };
  }
  if (c.action === "create" || c.action === "duplicate") {
    let draft = c.draft;
    if (c.action === "duplicate") {
      const source = await origin(user, c);
      draft = await currentSnapshot(source);
    }
    must(draft, "Falta el borrador.");
    const s = await snapshot(user, draft),
      id = randomUUID(),
      originId = randomUUID();
    const number = `${c.kind === "cotizacion" ? "COT" : "PRO"}-${id.toUpperCase()}`;
    if (c.kind === "cotizacion") {
      await tx().execute(
        sql`insert into cotizaciones(id,empresa_id,sucursal_id,cliente_id,numero,fecha,vigente_hasta,estado,subtotal,descuento,impuesto,total,notas,usuario_id) values(${id}::uuid,${user.empresaId}::uuid,${c.sucursalId}::uuid,${s.clienteId}::uuid,${number},${s.fecha}::date,${s.vigenteHasta}::date,'borrador',${s.amounts.subtotal},${s.amounts.descuentoTotal},${s.amounts.impuesto},${s.amounts.total},${s.observaciones},${user.id}::uuid)`,
      );
      for (const line of s.items)
        await tx().execute(
          sql`insert into cotizacion_detalle(cotizacion_id,revision_oferta,producto_id,cantidad,precio_unitario,descuento,impuesto,subtotal) values(${id}::uuid,1,${line.productoId}::uuid,${line.cantidad},${line.precioUnitario},${line.descuento},${line.impuesto},${line.subtotal})`,
        );
    }
    await tx().execute(
      sql`insert into comercial_origenes(id,empresa_id,sucursal_id,cotizacion_id,estado,creado_por,device_id) values(${originId}::uuid,${user.empresaId}::uuid,${c.sucursalId}::uuid,${c.kind === "cotizacion" ? id : null}::uuid,'borrador',${user.id}::uuid,${device}::uuid)`,
    );
    if (c.kind === "proforma")
      await tx().execute(
        sql`insert into proformas(id,empresa_id,origen_id,numero,creado_por) values(${id}::uuid,${user.empresaId}::uuid,${originId}::uuid,${number},${user.id}::uuid)`,
      );
    await tx().execute(
      sql`insert into comercial_revisiones(empresa_id,origen_id,version,snapshot,creado_por,device_id) values(${user.empresaId}::uuid,${originId}::uuid,1,${JSON.stringify(s)}::jsonb,${user.id}::uuid,${device}::uuid)`,
    );
    const next = { ...c, id };
    const o = await origin(user, next);
    await event(user, next, o, device, c.action, { sourceId: c.id ?? null });
    return { ok: true, document: await doc(user, next, o) };
  }
  const o = await origin(user, c);
  if (c.action === "detail")
    return { ok: true, document: await doc(user, c, o) };
  must(
    c.expectedVersion === o.version,
    "La revisión cambió. Recarga el documento.",
  );
  const s = await currentSnapshot(o);
  if (c.action === "derive") {
    must(
      c.kind === "cotizacion",
      "Solo una cotización puede originar una proforma.",
    );
    const [previous] = await tx().execute(
      sql`select id from proformas where empresa_id=${user.empresaId}::uuid and origen_id=${o.id}::uuid`,
    );
    const id = previous ? String(previous.id) : randomUUID();
    if (!previous) {
      await tx().execute(
        sql`insert into proformas(id,empresa_id,origen_id,numero,creado_por) values(${id}::uuid,${user.empresaId}::uuid,${o.id}::uuid,${`PRO-${id.toUpperCase()}`},${user.id}::uuid)`,
      );
      await event(user, { ...c, kind: "proforma", id }, o, device, "derive", {
        cotizacionId: c.id,
      });
    }
    return {
      ok: true,
      document: await doc(user, { ...c, kind: "proforma", id }, o),
    };
  }
  if (c.action === "edit" || c.action === "revise") {
    must(
      o.estado !== "convertida",
      "Un documento convertido no se modifica; duplica para una oferta nueva.",
    );
    must(
      c.action === "revise" || o.estado === "borrador",
      "Solo puedes editar borradores; crea una nueva revisión.",
    );
    must(c.draft, "Falta el borrador.");
    const revised = await snapshot(user, c.draft),
      previousVersion = o.version;
    o.version++;
    o.estado = "borrador";
    await tx().execute(
      sql`insert into comercial_revisiones(empresa_id,origen_id,version,snapshot,creado_por,device_id) values(${user.empresaId}::uuid,${o.id}::uuid,${o.version},${JSON.stringify(revised)}::jsonb,${user.id}::uuid,${device}::uuid)`,
    );
    await tx().execute(
      sql`update comercial_origenes set version=${o.version},estado='borrador',actualizado_en=now() where id=${o.id}::uuid and empresa_id=${user.empresaId}::uuid`,
    );
    await mirrorQuote(o, revised, true);
    await event(user, c, o, device, c.action, {
      previousVersion,
      changed: Object.keys(revised).filter(
        (k) =>
          JSON.stringify(revised[k as keyof CommercialSnapshot]) !==
          JSON.stringify(s[k as keyof CommercialSnapshot]),
      ),
    });
  } else if (c.action === "state") {
    must(c.state, "Falta estado.");
    assertCommercialTransition(o.estado, c.state, c.reason, c.evidence);
    const today = (
      await tx().execute(
        sql`select (now() at time zone 'America/Managua')::date::text as day`,
      )
    )[0].day as string;
    if (c.state === "aceptada")
      must(
        !s.vigenteHasta || s.vigenteHasta >= today,
        "La oferta está vencida.",
      );
    if (c.state === "vencida")
      must(
        s.vigenteHasta && s.vigenteHasta < today,
        "La vigencia aún no ha vencido.",
      );
    o.estado = c.state;
    await tx().execute(
      sql`update comercial_origenes set estado=${o.estado},actualizado_en=now() where empresa_id=${user.empresaId}::uuid and id=${o.id}::uuid`,
    );
    await mirrorQuote(o, s);
    await event(user, c, o, device, c.state);
  } else if (c.action === "convert") {
    const [prior] = await tx().execute(
      sql`select venta_id from comercial_conversiones where empresa_id=${user.empresaId}::uuid and origen_id=${o.id}::uuid and revision=${o.version}`,
    );
    if (prior)
      return {
        ok: true,
        document: await doc(user, c, o),
        ventaId: String(prior.venta_id),
      };
    must(
      o.estado === "aceptada",
      "Debes aceptar esta revisión antes de convertir.",
    );
    must(c.settlement, "Indica almacén y cobro/crédito.");
    const [companyCurrency] = await tx().execute(
      sql`select moneda from empresas where id=${user.empresaId}::uuid`,
    );
    must(
      companyCurrency?.moneda === s.moneda,
      "La moneda operativa cambió. Crea y acepta una nueva revisión; no se aplicará un tipo de cambio implícito.",
    );
    const items = [];
    for (const line of s.items) {
      const sessions=await tx().execute(sql`select s.id,c.nombre as nombre from sesiones_caja s join cajas c on c.id=s.caja_id and c.empresa_id=s.empresa_id where s.empresa_id=${user.empresaId}::uuid and c.sucursal_id=${c.sucursalId}::uuid and s.estado='abierta' order by c.nombre,c.id`);
    const [p] = await tx().execute(
        sql`select costo_promedio as costo from productos where id=${line.productoId}::uuid and empresa_id=${user.empresaId}::uuid and activo and eliminado_en is null`,
      );
      must(p, "Producto ya no disponible; crea una revisión.");
      items.push({ ...line, costoUnitario: Number(p.costo) });
    }
    const result = await procesarVenta(
      {
        sucursalId: o.sucursal_id,
        clienteId: s.clienteId ?? "",
        items: items.map(
          ({
            productoId,
            cantidad,
            precioUnitario,
            descuento,
            impuesto,
            costoUnitario,
          }) => ({
            productoId,
            cantidad,
            precioUnitario,
            descuento,
            impuesto,
            costoUnitario,
          }),
        ),
        ...c.settlement,
        notas: `${c.kind} ${c.id} revisión ${o.version}`,
      },
      c.requestId,
    );
    if (!result.ok) return result;
    await tx().execute(
      sql`insert into comercial_conversiones(empresa_id,origen_id,revision,venta_id,usuario_id,device_id,request_id) values(${user.empresaId}::uuid,${o.id}::uuid,${o.version},${result.ventaId}::uuid,${user.id}::uuid,${device}::uuid,${c.requestId}::uuid)`,
    );
    o.estado = "convertida";
    o.venta_id = result.ventaId;
    await tx().execute(
      sql`update comercial_origenes set estado='convertida',venta_id=${result.ventaId}::uuid,actualizado_en=now() where id=${o.id}::uuid and empresa_id=${user.empresaId}::uuid`,
    );
    await mirrorQuote(o, s);
    await event(user, c, o, device, "convert", { ventaId: result.ventaId });
  } else if (c.action === "pdf" || c.action === "print")
    await event(
      user,
      c,
      o,
      device,
      c.action === "pdf" ? "pdf_generacion_solicitada" : "impresion_solicitada",
    );
  return {
    ok: true,
    document: await doc(user, c, o),
    ...(o.venta_id ? { ventaId: o.venta_id } : {}),
  };
}
