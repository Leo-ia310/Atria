import { normalizeSupplierDocument } from "./supplier-document-identity";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  executeBusinessAction,
  executeBusinessRead,
  revalidateBusinessPath,
} from "./business-action";
import { currentBusinessContext, inBusinessContext } from "./business-context";
import { inAuthenticatedUserContext } from "./authenticated-user-context";
import type { SessionUser } from "./actions/session-helpers";
import { getAccessContext } from "./server-access";
import { storedCommand, recoverStored, commandHash } from "./stored-command";
import {
  procurementEffect,
  procurementSchema,
  offerAmounts,
  remainingPortion,
  type ProcurementCommand,
  type ProcurementResult,
  type PurchaseConfig,
  type OfferInput,
} from "./procurement-core";
import { captureInternalDocument } from "./internal-document";
import { applyPurchaseInventory } from "./purchase-inventory";
import { procesarCompraBusiness } from "./purchase-business";
import { registrarPagoBusiness } from "./payable-business";
import {
  crearAsiento,
  type PartidaAsiento,
} from "./contabilidad/motor-asientos";
import {
  resolverCuentasClave,
  PeriodoCerradoError,
  CuentaClaveNoEncontradaError,
} from "./contabilidad/helpers";
import { fechaISOEnZona, fechaMediodiaUTC } from "./dates";
import { posMoney } from "./pos-money";
import { inputMessage } from "./document-display";
import { invalidarModulos } from "./redis/cache";
import { MODULOS } from "./redis/keys";
type Row = Record<string, unknown>;
type Line = {
  id: string;
  rfqLineId: string;
  productoId: string;
  nombre: string;
  cantidad: number;
  base: number;
  tax: number;
};
type OrderSnapshot = {
  numero: string;
  issuer: Row;
  proveedorId: string;
  proveedor: string;
  moneda: string;
  tipoCambio: number;
  functionalCurrency: string;
  items: Line[];
  offer: OfferInput;
  total: number;
};
type ReceiptSnapshot = {
  evidencia?: string;
  motivo?: string;
  numero: string;
  fecha: string;
  policy: PurchaseConfig;
  items: Array<{
    id: string;
    ocLineId: string;
    productoId: string;
    nombre: string;
    aceptada: number;
    rechazada: number;
    motivo: string;
    base: number;
    tax: number;
    unbilledQty: number;
    unbilledBase: number;
  }>;
  assignments: Array<{
    receiptLineId: string;
    invoiceLineId: string;
    qty: number;
    invoiceBase: number;
    receiptBase: number;
    transitAccountId: string;
  }>;
  order: OrderSnapshot;
  almacenId: string;
};
const context = () => {
  const c = currentBusinessContext();
  if (!c) throw new Error("Falta transacción de abastecimiento.");
  return c;
};
const tx = () => context().tx;
function must(v: unknown, m: string): asserts v {
  if (!v) throw new Error(m);
}
const n = (v: unknown) => Number(v ?? 0),
  s = (v: unknown) => String(v ?? "");
const money = (values: number[]) => posMoney(values.reduce((a, b) => a + b, 0));
class ProcurementAccessError extends Error {}
function requireProcurementAccess(
  allowed: unknown,
  message: string,
): asserts allowed {
  if (!allowed) throw new ProcurementAccessError(message);
}
const permissions: Record<ProcurementCommand["action"], string[]> = {
  list: ["rfq.ver", "cxp.ver"],
  rfq: ["rfq.ver"],
  order: ["rfq.ver"],
  statement: ["cxp.ver"],
  createRFQ: ["rfq.crear"],
  sendRFQ: ["rfq.enviar"],
  offer: ["oferta_proveedor.registrar"],
  select: ["oferta_proveedor.comparar"],
  approveOffer: ["oferta_proveedor.aprobar"],
  rejectOffer: ["oferta_proveedor.rechazar"],
  createPO: ["orden_compra.crear"],
  approvePO: ["orden_compra.aprobar"],
  receive: ["recepcion.crear"],
  invoice: ["cxp.configurar"],
  return: ["recepcion.devolver"],
  postReceipt: ["cxp.configurar"],
  postReturn: ["cxp.configurar"],
  pay: ["cxp.pagar"],
  configure: ["cxp.configurar"],
  recover: ["rfq.ver", "cxp.ver"],
};
export async function executeProcurement(
  user: SessionUser,
  raw: unknown,
  device: string | null = null,
  branches?: string[],
): Promise<ProcurementResult> {
  // Until the registry has been checked under the root lock, a rejection cannot
  // prove that an earlier attempt was not committed. Commit failures are unknown too.
  let preserveAttempt = true;
  try {
    const c = procurementSchema.parse(raw),
      read = ["list", "rfq", "order", "statement"].includes(c.action);
    preserveAttempt = !read;
    const result = await inAuthenticatedUserContext(user, () =>
      (read ? executeBusinessRead : executeBusinessAction)(user, async () => {
        if (device) context().deviceId = device;
        if (branches) context().sucursalIds = branches;
        if (!read)
          for (const path of [
            "/compras",
            "/compras/abastecimiento",
            "/inventario",
            "/cxp",
            "/tesoreria",
            "/contabilidad",
          ])
            revalidateBusinessPath(path);
        const access = await getAccessContext(user);
        requireProcurementAccess(
          !access.suscripcionBloqueada &&
            access.plan.features.gestion_proveedores,
          "Tu plan no permite abastecimiento.",
        );
        if (branches)
          must(
            branches.includes(c.sucursalId),
            "Sucursal no autorizada para este dispositivo.",
          );
        await assertBranch(user, c.sucursalId);
        const authorizeAction = () => {
          const required =
            c.action === "offer" && c.id ? "oferta_proveedor.editar" : null;
          requireProcurementAccess(
            required
              ? access.permisos.includes(required)
              : permissions[c.action].some((p) => access.permisos.includes(p)),
            "No tienes el permiso requerido.",
          );
        };
        const canReadResult = (
          effect: Extract<ProcurementResult, { ok: true }>["effect"],
        ) =>
          effect === "invoice" || effect === "payment"
            ? access.permisos.includes("cxp.ver")
            : effect === "configuration"
              ? ["rfq.ver", "cxp.ver"].some((p) => access.permisos.includes(p))
              : access.permisos.includes("rfq.ver");
        if (read || c.action === "recover") authorizeAction();
        else {
          const [prior] = await tx().execute(
            sql`select request_id from comercial_intentos where empresa_id=${user.empresaId}::uuid and usuario_id=${user.id}::uuid and request_id=${c.requestId}::uuid`,
          );
          preserveAttempt = Boolean(prior);
        }
        const scope = {
          branch: c.sucursalId,
          kind: "abastecimiento",
          requestId: c.requestId,
        };
        const r =
          c.action === "recover"
            ? await recoverStored<ProcurementResult>(
                scope,
                c.attemptId ?? c.requestId,
              )
            : read
              ? await execute(user, c, device, access.permisos)
              : await storedCommand(scope, c, async () => {
                  authorizeAction();
                  requireProcurementAccess(
                    canReadResult(procurementEffect(c.action)),
                    "Sin permiso para consultar el documento de origen.",
                  );
                  const value = await execute(user, c, device, access.permisos);
                  return value.ok
                    ? {
                        ...value,
                        confirmation: {
                          version: 1 as const,
                          empresaId: user.empresaId,
                          userId: user.id,
                          sucursalId: c.sucursalId,
                          requestId: c.requestId,
                          hash: commandHash(c),
                        },
                      }
                    : value;
                });
        if (!read && r.ok && !r.discarded)
          requireProcurementAccess(
            canReadResult(r.effect),
            "Sin permiso para recuperar el documento de origen. Conserva el intento hasta recuperar autorización.",
          );
        if (!read && r.ok) preserveAttempt = true; // The outer transaction still has to COMMIT.
        return r.ok ? { ...r, permissions: access.permisos } : r;
      }),
    );
    if (result.ok && !read)
      try {
        await invalidarModulos(user.empresaId, [
          MODULOS.DASHBOARD,
          MODULOS.CONTABILIDAD,
          MODULOS.REPORTES,
        ]);
      } catch {
        console.error(
          "[abastecimiento] Invalidación pendiente tras confirmar operación.",
        );
      }
    return result;
  } catch (error) {
    return {
      ok: false,
      error: inputMessage(error, "No se pudo completar abastecimiento."),
      ...(preserveAttempt ? { requiresRecovery: true } : {}),
      ...(error instanceof ProcurementAccessError
        ? { authorizationDenied: true }
        : {}),
    };
  }
}
async function assertBranch(user: SessionUser, branch: string) {
  const rows = await tx().execute(
    sql`select s.id from sucursales s join usuarios u on u.id=${user.id}::uuid and u.empresa_id=s.empresa_id and u.activo and u.eliminado_en is null where s.id=${branch}::uuid and s.empresa_id=${user.empresaId}::uuid and s.activa and s.eliminado_en is null and (not exists(select 1 from usuario_sucursales us join sucursales a on a.id=us.sucursal_id where us.usuario_id=u.id and a.empresa_id=s.empresa_id) or exists(select 1 from usuario_sucursales us where us.usuario_id=u.id and us.sucursal_id=s.id))`,
  );
  must(rows.length, "Sucursal no autorizada.");
}
async function today(user: SessionUser) {
  const [r] = await tx().execute(
    sql`select zona_horaria from empresas where id=${user.empresaId}::uuid`,
  );
  return fechaISOEnZona(new Date(), s(r.zona_horaria));
}
async function audit(
  user: SessionUser,
  c: ProcurementCommand,
  device: string | null,
  id: string,
  action: string,
  datos: unknown = {},
  revision?: number,
) {
  await tx().execute(
    sql`insert into abast_eventos(empresa_id,sucursal_id,entity_id,accion,revision,datos,usuario_id,device_id,correlation_id) values(${user.empresaId}::uuid,${c.sucursalId}::uuid,${id}::uuid,${action},${revision ?? null},${JSON.stringify(datos)}::jsonb,${user.id}::uuid,${device}::uuid,${c.requestId}::uuid)`,
  );
  await tx().execute(
    sql`insert into auditoria(empresa_id,usuario_id,accion,tabla,registro_id,datos_despues) values(${user.empresaId}::uuid,${user.id}::uuid,${"abastecimiento." + action},'abastecimiento',${id},${JSON.stringify({ branch: c.sucursalId, device, correlationId: c.requestId, revision, datos })}::jsonb)`,
  );
}
async function supplier(user: SessionUser, id?: string, operational = true) {
  must(id, "Selecciona un proveedor.");
  const [r] = await tx().execute(
    sql`select id,coalesce(nombre_comercial,razon_social) as nombre from proveedores where id=${id}::uuid and empresa_id=${user.empresaId}::uuid and (${!operational} or (activo and eliminado_en is null))`,
  );
  must(r, "Proveedor no autorizado o inactivo.");
  return r;
}
async function product(user: SessionUser, id: string) {
  const [p] = await tx().execute(
    sql`select * from productos where id=${id}::uuid and empresa_id=${user.empresaId}::uuid and activo and eliminado_en is null`,
  );
  must(p, "Producto no autorizado.");
  return p;
}
async function warehouse(
  user: SessionUser,
  id: string | undefined,
  branch: string,
) {
  must(id, "Selecciona un almacén.");
  const [r] = await tx().execute(
    sql`select id from almacenes where id=${id}::uuid and empresa_id=${user.empresaId}::uuid and sucursal_id=${branch}::uuid and activo`,
  );
  must(r, "Almacén de otra empresa o sucursal.");
  return id;
}
async function config(user: SessionUser): Promise<PurchaseConfig> {
  const [r] = await tx().execute(
    sql`select * from abast_config where empresa_id=${user.empresaId}::uuid`,
  );
  must(r, "Configura explícitamente el tratamiento de recepción sin factura.");
  return {
    policy: r.policy as PurchaseConfig["policy"],
    grniAccountId: r.grni_account_id ? s(r.grni_account_id) : null,
    transitAccountId: r.transit_account_id ? s(r.transit_account_id) : null,
    claimAccountId: r.claim_account_id ? s(r.claim_account_id) : null,
    varianceAccountId: r.variance_account_id ? s(r.variance_account_id) : null,
  };
}
class ProcurementAccountingError extends Error {}
async function account(
  user: SessionUser,
  id: string | null | undefined,
  type: string,
) {
  if (!id)
    throw new ProcurementAccountingError(`Falta configurar cuenta de ${type}.`);
  const [r] = await tx().execute(
    sql`select id from catalogo_cuentas where id=${id}::uuid and empresa_id=${user.empresaId}::uuid and activa and es_detalle and permite_movimiento and (${type === "variacion"} and tipo in ('gasto','ingreso') or tipo::text=${type})`,
  );
  if (!r)
    throw new ProcurementAccountingError(
      `Cuenta ${id} no válida para ${type}.`,
    );
  return id;
}
async function journal(
  user: SessionUser,
  c: ProcurementCommand,
  id: string,
  date: string,
  parts: PartidaAsiento[],
  concept: string,
) {
  return crearAsiento(tx(), {
    empresaId: user.empresaId,
    sucursalId: c.sucursalId,
    fecha: fechaMediodiaUTC(date),
    origen: "manual",
    referenciaTabla: "abastecimiento",
    referenciaId: id,
    concepto: concept,
    usuarioId: user.id,
    partidas: parts.filter((p) => p.debe || p.haber),
  });
}
async function rfq(user: SessionUser, c: ProcurementCommand, id?: string) {
  must(id ?? c.rfqId ?? c.id, "Selecciona RFQ.");
  const [r] = await tx().execute(
    sql`select * from abast_rfq where empresa_id=${user.empresaId}::uuid and sucursal_id=${c.sucursalId}::uuid and id=${id ?? c.rfqId ?? c.id}::uuid ${["list", "rfq"].includes(c.action) ? sql`` : sql`for update`}`,
  );
  must(r, "RFQ no encontrada en esta sucursal.");
  return r;
}
async function order(user: SessionUser, c: ProcurementCommand) {
  must(c.orderId ?? c.id, "Selecciona OC.");
  const [r] = await tx().execute(
    sql`select a.*,o.sucursal_id,o.proveedor_id,o.numero,o.estado from abast_oc a join ordenes_compra o on o.id=a.id and o.empresa_id=a.empresa_id where a.id=${c.orderId ?? c.id}::uuid and a.empresa_id=${user.empresaId}::uuid and o.sucursal_id=${c.sucursalId}::uuid ${c.action === "order" ? sql`` : sql`for update of a,o`}`,
  );
  must(r, "OC no encontrada en esta sucursal.");
  return r;
}
async function history(user: SessionUser, c: ProcurementCommand, id: string) {
  return [
    ...(await tx().execute(
      sql`select e.accion,u.nombre as usuario,e.creado_en::text as fecha,e.datos from abast_eventos e join usuarios u on u.id=e.usuario_id where e.empresa_id=${user.empresaId}::uuid and e.sucursal_id=${c.sucursalId}::uuid and e.entity_id=${id}::uuid order by e.creado_en,e.id`,
    )),
  ];
}
async function detail(
  user: SessionUser,
  c: ProcurementCommand,
  perms: string[],
): Promise<ProcurementResult> {
  if (c.action === "rfq") {
    const r = await rfq(user, c),
      offers = perms.includes("oferta_proveedor.ver")
        ? [
            ...(await tx().execute(
              sql`select o.id,o.proveedor_id as "proveedorId",coalesce(p.nombre_comercial,p.razon_social) as proveedor,o.revision,o.estado,v.snapshot from abast_ofertas o join abast_oferta_revisiones v on v.empresa_id=o.empresa_id and v.oferta_id=o.id and v.revision=o.revision join proveedores p on p.id=o.proveedor_id and p.empresa_id=o.empresa_id where o.empresa_id=${user.empresaId}::uuid and o.rfq_id=${r.id}::uuid order by proveedor,o.id`,
            )),
          ]
        : [];
    return {
      ok: true,
      detail: {
        header: {
          id: s(r.id),
          numero: s(r.numero),
          estado: s(r.estado),
          version: n(r.version),
        },
        snapshot: {
          ...(r.snapshot as Row),
          selectedOfferId: r.selected_offer_id,
          selectedRevision: r.selected_revision,
          selectionReason: r.selection_reason,
          approved: r.approved,
        },
        offers,
        history: (await history(user, c, s(r.id))).map((e) =>
          perms.includes("oferta_proveedor.ver") ? e : { ...e, datos: {} },
        ),
      },
    } as unknown as ProcurementResult;
  }
  const r = await order(user, c),
    snapshot = r.snapshot as OrderSnapshot;
  const lines = await tx().execute(
    sql`select d.id,p.nombre,d.cantidad::float8 as ordered,d.cantidad_recibida::float8 as accepted,coalesce((select sum(f.cantidad) from abast_factura_detalle f where f.empresa_id=${user.empresaId}::uuid and f.oc_line_id=d.id),0)::float8 as invoiced,(d.cantidad-d.cantidad_recibida)::float8 as available,coalesce((select sum(l.devuelta) from abast_recepcion_detalle l where l.empresa_id=${user.empresaId}::uuid and l.oc_line_id=d.id),0)::float8 as returned from orden_compra_detalle d join productos p on p.id=d.producto_id and p.empresa_id=${user.empresaId}::uuid where d.orden_id=${r.id}::uuid order by d.id`,
  );
  const receipts = [];
  for (const h of await tx().execute(
    sql`select id,numero,accounting_status from abast_recepciones where empresa_id=${user.empresaId}::uuid and orden_id=${r.id}::uuid order by creado_en,id`,
  )) {
    const items = [
      ...(await tx().execute(
        sql`select d.id,p.nombre,d.aceptada::float8 as accepted,d.devuelta::float8 as returned from abast_recepcion_detalle d join orden_compra_detalle l on l.id=d.oc_line_id join productos p on p.id=l.producto_id where d.empresa_id=${user.empresaId}::uuid and d.recepcion_id=${h.id}::uuid order by d.id`,
      )),
    ];
    receipts.push({
      id: h.id,
      numero: h.numero,
      accountingStatus: h.accounting_status,
      items,
    });
  }
  return {
    ok: true,
    detail: {
      header: {
        id: s(r.id),
        numero: s(r.numero),
        estado: r.aprobada ? s(r.estado) : "pendiente_aprobacion",
        version: n(r.version),
      },
      snapshot: snapshot as unknown as Row,
      lines: [...lines],
      receipts,
      history: (await history(user, c, s(r.id))).map((e) =>
        perms.includes("oferta_proveedor.ver") ? e : { ...e, datos: {} },
      ),
    },
  } as unknown as ProcurementResult;
}
async function execute(
  user: SessionUser,
  c: ProcurementCommand,
  device: string | null,
  perms: string[],
): Promise<ProcurementResult> {
  if (c.action === "list") return list(user, c, perms);
  if (c.action === "rfq" || c.action === "order") return detail(user, c, perms);
  if (c.action === "statement") return statement(user, c);
  if (c.action === "receive") return receive(user, c, device);
  if (c.action === "invoice") return invoice(user, c, device);
  if (c.action === "return") return returnGoods(user, c, device);
  if (c.action === "postReceipt") return postReceipt(user, c, device);
  if (c.action === "postReturn") return postReturn(user, c, device);
  if (c.action === "pay") return pay(user, c, device);
  if (c.action === "approvePO") {
    const o = await order(user, c);
    if (o.aprobada) return { ok: true, id: s(o.id), effect: "commercial" };
    must(c.expectedVersion === n(o.version), "La OC cambió.");
    await tx().execute(
      sql`update abast_oc set aprobada=true,version=version+1 where id=${o.id}::uuid and empresa_id=${user.empresaId}::uuid`,
    );
    await tx().execute(
      sql`update ordenes_compra set estado='enviada' where id=${o.id}::uuid and empresa_id=${user.empresaId}::uuid`,
    );
    await audit(user, c, device, s(o.id), "oc_aprobada", {}, n(o.version) + 1);
    return { ok: true, id: s(o.id), effect: "commercial" };
  }
  if (c.action === "configure") {
    must(c.config, "Elige política explícitamente.");
    for (const [id, type] of [
      [c.config.grniAccountId, "pasivo"],
      [c.config.transitAccountId, "activo"],
      [c.config.claimAccountId, "activo"],
      [c.config.varianceAccountId, "variacion"],
    ] as const)
      if (id) await account(user, id, type);
    await tx().execute(
      sql`insert into abast_config(empresa_id,policy,grni_account_id,transit_account_id,claim_account_id,variance_account_id,version,usuario_id) values(${user.empresaId}::uuid,${c.config.policy},${c.config.grniAccountId}::uuid,${c.config.transitAccountId}::uuid,${c.config.claimAccountId}::uuid,${c.config.varianceAccountId}::uuid,1,${user.id}::uuid) on conflict(empresa_id) do update set policy=excluded.policy,grni_account_id=excluded.grni_account_id,transit_account_id=excluded.transit_account_id,claim_account_id=excluded.claim_account_id,variance_account_id=excluded.variance_account_id,version=abast_config.version+1,usuario_id=excluded.usuario_id,actualizado_en=now()`,
    );
    await audit(user, c, device, user.empresaId, "configuracion", c.config);
    return { ok: true, effect: "configuration" };
  }
  if (c.action === "createRFQ") {
    must(c.rfq, "Completa la solicitud.");
    for (const id of c.rfq.proveedorIds) await supplier(user, id);
    const items = [];
    for (const line of c.rfq.items) {
      const p = await product(user, line.productoId);
      items.push({ ...line, id: randomUUID(), nombre: s(p.nombre) });
    }
    const id = randomUUID(),
      numero = `RFQ-${id}`,
      snapshot = {
        ...c.rfq,
        numero,
        items,
        issuer: await captureInternalDocument(c.sucursalId),
        fecha: await today(user),
        preparadoPor: user.nombre,
      };
    await tx().execute(
      sql`insert into abast_rfq(id,empresa_id,sucursal_id,numero,snapshot,usuario_id,device_id) values(${id}::uuid,${user.empresaId}::uuid,${c.sucursalId}::uuid,${numero},${JSON.stringify(snapshot)}::jsonb,${user.id}::uuid,${device}::uuid)`,
    );
    await audit(user, c, device, id, "rfq_creada", { snapshot }, 1);
    return { ok: true, id, effect: "commercial" };
  }
  const r = await rfq(user, c),
    snapshot = r.snapshot as {
      items: Array<{
        id: string;
        productoId: string;
        nombre: string;
        cantidad: number;
      }>;
      proveedorIds: string[];
      vigenteHasta: string;
    };
  if (c.action === "sendRFQ") {
    must(
      c.proveedorIds?.length &&
        new Set(c.proveedorIds).size === c.proveedorIds.length &&
        c.medio &&
        c.evidencia.trim(),
      "Selecciona destinatarios, medio y evidencia de entrega/intento.",
    );
    for (const id of c.proveedorIds) {
      must(
        snapshot.proveedorIds.includes(id),
        "Proveedor fuera de la solicitud.",
      );
      await supplier(user, id);
      await tx().execute(
        sql`insert into abast_envios(id,empresa_id,sucursal_id,rfq_id,proveedor_id,medio,evidencia,usuario_id,device_id,correlation_id) values(${randomUUID()}::uuid,${user.empresaId}::uuid,${c.sucursalId}::uuid,${r.id}::uuid,${id}::uuid,${c.medio},${c.evidencia},${user.id}::uuid,${device}::uuid,${c.requestId}::uuid)`,
      );
    }
    await audit(user, c, device, s(r.id), "solicitudes_entrega_registrada", {
      proveedores: c.proveedorIds,
      medio: c.medio,
      evidencia: c.evidencia,
    });
    return { ok: true, id: s(r.id), effect: "commercial" };
  }
  if (c.action === "offer") {
    must(c.offer && c.proveedorId, "Completa la oferta.");
    must(
      snapshot.proveedorIds.includes(c.proveedorId),
      "El proveedor no fue invitado.",
    );
    await supplier(user, c.proveedorId);
    must(
      c.offer.items.length === snapshot.items.length &&
        c.offer.items.every((i) =>
          snapshot.items.some(
            (l) => l.id === i.rfqLineId && l.cantidad === i.cantidad,
          ),
        ),
      "La oferta debe cubrir exactamente las líneas/cantidades solicitadas para compararse.",
    );
    const [existing] = await tx().execute(
      sql`select * from abast_ofertas where empresa_id=${user.empresaId}::uuid and rfq_id=${r.id}::uuid and proveedor_id=${c.proveedorId}::uuid for update`,
    );
    must(!c.id || existing?.id === c.id, "Oferta de otro origen.");
    if (existing)
      must(
        c.id === existing.id && c.expectedVersion === n(existing.revision),
        "La oferta cambió. Recarga su revisión.",
      );
    const [converted] = await tx().execute(
      sql`select id from abast_oc where empresa_id=${user.empresaId}::uuid and rfq_id=${r.id}::uuid`,
    );
    must(
      !converted,
      "La oferta ya originó una OC; utiliza una nueva RFQ para renegociar.",
    );
    const issuer = await captureInternalDocument(c.sucursalId),
      amounts = offerAmounts(c.offer, s(issuer.moneda)),
      id = existing ? s(existing.id) : randomUUID(),
      revision = existing ? n(existing.revision) + 1 : 1,
      offerSnapshot = {
        ...c.offer,
        ...amounts,
        issuer,
        proveedorId: c.proveedorId,
        preparedBy: user.nombre,
        fecha: await today(user),
      };
    if (existing)
      await tx().execute(
        sql`update abast_ofertas set revision=${revision},estado='registrada' where id=${id}::uuid and empresa_id=${user.empresaId}::uuid`,
      );
    else
      await tx().execute(
        sql`insert into abast_ofertas(id,empresa_id,rfq_id,proveedor_id) values(${id}::uuid,${user.empresaId}::uuid,${r.id}::uuid,${c.proveedorId}::uuid)`,
      );
    await tx().execute(
      sql`insert into abast_oferta_revisiones(empresa_id,oferta_id,revision,snapshot,usuario_id,device_id) values(${user.empresaId}::uuid,${id}::uuid,${revision},${JSON.stringify(offerSnapshot)}::jsonb,${user.id}::uuid,${device}::uuid)`,
    );
    if (r.selected_offer_id === id)
      await tx().execute(
        sql`update abast_rfq set selected_offer_id=null,selected_revision=null,selection_reason=null,approved=false,version=version+1,estado='abierta' where id=${r.id}::uuid and empresa_id=${user.empresaId}::uuid`,
      );
    await audit(
      user,
      c,
      device,
      s(r.id),
      "oferta_revision",
      { ofertaId: id, proveedor: c.proveedorId, snapshot: offerSnapshot },
      revision,
    );
    return { ok: true, id, effect: "commercial" };
  }
  must(c.offerId, "Selecciona una oferta.");
  const [o] = await tx().execute(
    sql`select o.*,v.snapshot from abast_ofertas o join abast_oferta_revisiones v on v.empresa_id=o.empresa_id and v.oferta_id=o.id and v.revision=o.revision where o.id=${c.offerId}::uuid and o.empresa_id=${user.empresaId}::uuid and o.rfq_id=${r.id}::uuid for update of o`,
  );
  must(o && n(o.revision) === c.revision, "Revisión de oferta obsoleta.");
  const offer = o.snapshot as Omit<OfferInput, "items"> &
    ReturnType<typeof offerAmounts>;
  if (c.action === "createPO") {
    const [previous] = await tx().execute(
      sql`select id,oferta_id,revision from abast_oc where empresa_id=${user.empresaId}::uuid and rfq_id=${r.id}::uuid`,
    );
    if (previous) {
      must(
        previous.oferta_id === o.id && n(previous.revision) === c.revision,
        "La RFQ ya tiene otra OC.",
      );
      return { ok: true, id: s(previous.id), effect: "commercial" };
    }
  }
  if (
    c.action === "approveOffer" &&
    r.approved &&
    r.selected_offer_id === o.id &&
    n(r.selected_revision) === c.revision
  )
    return { ok: true, id: s(o.id), effect: "commercial" };
  if (c.action !== "createPO")
    must(
      c.expectedVersion === n(r.version),
      "La selección cambió. Recarga la RFQ.",
    );
  if (c.action === "select") {
    must(
      perms.includes("oferta_proveedor.ver") && c.motivo.trim(),
      "Se requiere acceso a ofertas y justificación de selección.",
    );
    const comparison = await tx().execute(
      sql`select o.id,o.revision,v.snapshot from abast_ofertas o join abast_oferta_revisiones v on v.empresa_id=o.empresa_id and v.oferta_id=o.id and v.revision=o.revision where o.empresa_id=${user.empresaId}::uuid and o.rfq_id=${r.id}::uuid order by o.id`,
    );
    must(
      !r.approved,
      "La selección ya está aprobada; no se sustituye silenciosamente.",
    );
    await tx().execute(
      sql`update abast_rfq set selected_offer_id=${o.id}::uuid,selected_revision=${c.revision},selection_reason=${c.motivo},version=version+1,estado='seleccionada' where id=${r.id}::uuid and empresa_id=${user.empresaId}::uuid`,
    );
    await audit(
      user,
      c,
      device,
      s(r.id),
      "comparacion_y_seleccion",
      { comparison, ganador: o.id, revision: c.revision, motivo: c.motivo },
      c.revision,
    );
    return { ok: true, id: s(o.id), effect: "commercial" };
  }
  if (c.action === "rejectOffer") {
    must(c.motivo.trim(), "Indica motivo de rechazo.");
    must(!r.approved, "Una aprobación vigente no se revoca silenciosamente.");
    await tx().execute(
      sql`update abast_ofertas set estado='rechazada' where id=${o.id}::uuid and empresa_id=${user.empresaId}::uuid`,
    );
    if (r.selected_offer_id === o.id)
      await tx().execute(
        sql`update abast_rfq set selected_offer_id=null,selected_revision=null,selection_reason=null,version=version+1,estado='abierta' where id=${r.id}::uuid and empresa_id=${user.empresaId}::uuid`,
      );
    await audit(
      user,
      c,
      device,
      s(r.id),
      "oferta_rechazada",
      { ofertaId: o.id, motivo: c.motivo },
      c.revision,
    );
    return { ok: true, id: s(o.id), effect: "commercial" };
  }
  must(
    r.selected_offer_id === o.id && n(r.selected_revision) === c.revision,
    "Selecciona y justifica esta revisión antes de aprobar.",
  );
  must(
    offer.vigenteHasta >= (await today(user)),
    "La oferta venció. Registra una revisión vigente.",
  );
  if (c.action === "approveOffer") {
    must(o.estado !== "rechazada", "La oferta está rechazada.");
    await tx().execute(
      sql`update abast_rfq set approved=true,version=version+1,estado='aprobada' where id=${r.id}::uuid and empresa_id=${user.empresaId}::uuid`,
    );
    await tx().execute(
      sql`update abast_ofertas set estado='aprobada' where id=${o.id}::uuid and empresa_id=${user.empresaId}::uuid`,
    );
    await audit(
      user,
      c,
      device,
      s(r.id),
      "oferta_aprobada",
      { ofertaId: o.id, revision: c.revision },
      c.revision,
    );
    return { ok: true, id: s(o.id), effect: "commercial" };
  }
  must(c.action === "createPO" && r.approved, "La oferta no está aprobada.");
  const currentIssuer = await captureInternalDocument(c.sucursalId);
  must(
    currentIssuer.moneda === offer.functionalCurrency,
    "La moneda funcional cambió; revisa la oferta.",
  );
  const vendor = await supplier(user, s(o.proveedor_id)),
    id = randomUUID(),
    numero = `OC-${id}`;
  const items = offer.items.map((l) => {
    const original = snapshot.items.find((i) => i.id === l.rfqLineId)!;
    return {
      id: randomUUID(),
      rfqLineId: l.rfqLineId,
      productoId: original.productoId,
      nombre: original.nombre,
      cantidad: l.cantidad,
      base: l.functionalBase,
      tax: l.functionalTax,
    };
  });
  const frozen: OrderSnapshot = {
    numero,
    issuer: currentIssuer,
    proveedorId: s(o.proveedor_id),
    proveedor: s(vendor.nombre),
    moneda: offer.moneda,
    tipoCambio: offer.tipoCambio,
    functionalCurrency: offer.functionalCurrency,
    items,
    offer,
    total: offer.total,
  };
  await tx().execute(
    sql`insert into ordenes_compra(id,empresa_id,sucursal_id,proveedor_id,numero,fecha,subtotal,impuesto,total,usuario_id,notas) values(${id}::uuid,${user.empresaId}::uuid,${c.sucursalId}::uuid,${o.proveedor_id}::uuid,${numero},${await today(user)}::date,${offer.base},${offer.tax},${offer.total},${user.id}::uuid,${r.selection_reason})`,
  );
  for (const l of items)
    await tx().execute(
      sql`insert into orden_compra_detalle(id,orden_id,producto_id,cantidad,costo_unitario,impuesto,subtotal) values(${l.id}::uuid,${id}::uuid,${l.productoId}::uuid,${l.cantidad},${l.base / l.cantidad},${l.tax},${l.base})`,
    );
  await tx().execute(
    sql`insert into abast_oc(id,empresa_id,rfq_id,oferta_id,revision,snapshot) values(${id}::uuid,${user.empresaId}::uuid,${r.id}::uuid,${o.id}::uuid,${c.revision},${JSON.stringify(frozen)}::jsonb)`,
  );
  await tx().execute(
    sql`update abast_ofertas set estado='convertida' where id=${o.id}::uuid and empresa_id=${user.empresaId}::uuid`,
  );
  await audit(
    user,
    c,
    device,
    id,
    "oc_creada",
    { rfqId: r.id, ofertaId: o.id, revision: c.revision, snapshot: frozen },
    1,
  );
  return { ok: true, id, effect: "commercial" };
}

async function receivingPlan(user: SessionUser, snap: ReceiptSnapshot) {
  const [mapping] = await tx().execute(
    sql`select valor from configuraciones where empresa_id=${user.empresaId}::uuid and clave='cuentas_clave'`,
  );
  if (mapping && typeof (mapping.valor as Row)?.INVENTARIO !== "string")
    throw new ProcurementAccountingError("Mapeo de inventario incompleto.");
  const keys = await resolverCuentasClave(tx(), user.empresaId, ["INVENTARIO"]),
    inventory = await account(user, keys.INVENTARIO, "activo");
  const parts: PartidaAsiento[] = [];
  let debit = 0,
    credit = 0;
  const grniByLine: Record<
    string,
    { qty: number; base: number; account: string }
  > = {};
  for (const a of snap.assignments) {
    await account(user, a.transitAccountId, "activo");
    parts.push({ cuentaId: a.transitAccountId, debe: 0, haber: a.invoiceBase });
    credit += a.invoiceBase;
    debit += a.receiptBase;
  }
  for (const l of snap.items) {
    if (
      snap.policy.policy === "mercancia_recibida_no_facturada" &&
      l.unbilledQty
    ) {
      const grni = await account(user, snap.policy.grniAccountId, "pasivo");
      parts.push({ cuentaId: grni, debe: 0, haber: l.unbilledBase });
      credit += l.unbilledBase;
      debit += l.unbilledBase;
      grniByLine[l.id] = {
        qty: l.unbilledQty,
        base: l.unbilledBase,
        account: grni,
      };
    }
  }
  if (debit)
    parts.push({ cuentaId: inventory, debe: money([debit]), haber: 0 });
  const diff = posMoney(credit - debit);
  if (diff) {
    const variance = await account(
      user,
      snap.policy.varianceAccountId,
      "variacion",
    );
    parts.push({
      cuentaId: variance,
      debe: Math.max(0, diff),
      haber: Math.max(0, -diff),
    });
  }
  return { parts, inventory, grniByLine };
}
async function tryAccounting<T>(
  fn: () => Promise<T>,
): Promise<{ value: T } | { error: string }> {
  try {
    return {
      value: await tx().transaction((inner) =>
        inBusinessContext({ ...context(), tx: inner }, fn),
      ),
    };
  } catch (e) {
    if (
      e instanceof ProcurementAccountingError ||
      e instanceof CuentaClaveNoEncontradaError ||
      e instanceof PeriodoCerradoError
    )
      return { error: e.message };
    throw e;
  }
}
async function receive(
  user: SessionUser,
  c: ProcurementCommand,
  device: string | null,
): Promise<ProcurementResult> {
  const o = await order(user, c),
    snap = o.snapshot as OrderSnapshot;
  must(o.aprobada, "Aprueba la OC antes de recibir.");
  await warehouse(user, c.almacenId, c.sucursalId);
  const policy = await config(user);
  must(
    c.lines?.length &&
      new Set(c.lines.map((l) => l.lineId)).size === c.lines.length,
    "Selecciona líneas sin repetir.",
  );
  const fecha = c.fecha ?? (await today(user));
  must(
    fecha <= (await today(user)),
    "La recepción no puede confirmarse en el futuro.",
  );
  const id = randomUUID(),
    numero = `REC-${id}`,
    items: ReceiptSnapshot["items"] = [],
    assignments: ReceiptSnapshot["assignments"] = [];
  for (const input of c.lines) {
    const l = snap.items.find((l) => l.id === input.lineId);
    must(l, "Línea ajena a esta OC.");
    const [state] = await tx().execute(
      sql`select cantidad_recibida from orden_compra_detalle where id=${l.id}::uuid and orden_id=${o.id}::uuid for update`,
    );
    const accepted = input.aceptada ?? 0,
      rejected = input.rechazada ?? 0;
    must(
      accepted + rejected > 0 &&
        accepted <= l.cantidad - n(state.cantidad_recibida) + 0.0000001,
      "La cantidad aceptada supera lo pendiente de la OC.",
    );
    if (rejected)
      must(input.motivo.trim(), "Indica por qué se rechazó mercancía.");
    const p = await product(user, l.productoId);
    must(
      ["simple", "variante"].includes(s(p.tipo)) &&
        !p.maneja_lotes &&
        !p.maneja_series,
      "Este producto necesita un flujo de lotes/series o componentes; no se inventará trazabilidad.",
    );
    const lineId = randomUUID(),
      base = accepted
        ? remainingPortion(
            l.base,
            l.cantidad,
            n(state.cantidad_recibida),
            accepted,
          )
        : 0,
      tax = accepted
        ? remainingPortion(
            l.tax,
            l.cantidad,
            n(state.cantidad_recibida),
            accepted,
          )
        : 0;
    let allocated = 0;
    const billed = await tx().execute(
      sql`select f.*,coalesce((select sum(a.cantidad) from abast_asignaciones a where a.empresa_id=f.empresa_id and a.factura_line_id=f.id),0) as assigned from abast_factura_detalle f join abast_facturas h on h.id=f.factura_id and h.empresa_id=f.empresa_id where f.empresa_id=${user.empresaId}::uuid and f.oc_line_id=${l.id}::uuid order by h.creado_en,f.id for update of f`,
    );
    for (const f of billed) {
      const q = Math.min(accepted - allocated, n(f.cantidad) - n(f.assigned));
      if (q <= 0) continue;
      const invoiceBase = remainingPortion(
          n(f.base),
          n(f.cantidad),
          n(f.assigned),
          q,
        ),
        receiptBase = remainingPortion(base, accepted, allocated, q);
      must(
        f.transit_account_id,
        "La factura previa no tiene cuenta de mercancía en tránsito. Requiere revisión.",
      );
      assignments.push({
        receiptLineId: lineId,
        invoiceLineId: s(f.id),
        qty: q,
        invoiceBase,
        receiptBase,
        transitAccountId: s(f.transit_account_id),
      });
      allocated += q;
    }
    items.push({
      id: lineId,
      ocLineId: l.id,
      productoId: l.productoId,
      nombre: l.nombre,
      aceptada: accepted,
      rechazada: rejected,
      motivo: input.motivo,
      base,
      tax,
      unbilledQty: accepted - allocated,
      unbilledBase: posMoney(
        base -
          assignments
            .filter((a) => a.receiptLineId === lineId)
            .reduce((a, l) => a + l.receiptBase, 0),
      ),
    });
  }
  const frozen: ReceiptSnapshot = {
    evidencia: c.evidencia,
    motivo: c.motivo,
    numero,
    fecha,
    policy,
    items,
    assignments,
    order: snap,
    almacenId: c.almacenId!,
  };
  await tx().execute(
    sql`insert into abast_recepciones(id,empresa_id,sucursal_id,orden_id,almacen_id,numero,fecha,snapshot,accounting_status,usuario_id,device_id) values(${id}::uuid,${user.empresaId}::uuid,${c.sucursalId}::uuid,${o.id}::uuid,${c.almacenId}::uuid,${numero},${fecha}::date,${JSON.stringify(frozen)}::jsonb,'pendiente',${user.id}::uuid,${device}::uuid)`,
  );
  for (const l of items) {
    await tx().execute(
      sql`insert into abast_recepcion_detalle(id,empresa_id,recepcion_id,orden_id,oc_line_id,aceptada,rechazada,base,impuesto) values(${l.id}::uuid,${user.empresaId}::uuid,${id}::uuid,${o.id}::uuid,${l.ocLineId}::uuid,${l.aceptada},${l.rechazada},${l.base},${l.tax})`,
    );
    await tx().execute(
      sql`update orden_compra_detalle set cantidad_recibida=cantidad_recibida+${l.aceptada} where orden_id=${o.id}::uuid and id=${l.ocLineId}::uuid`,
    );
  }
  for (const a of assignments)
    await tx().execute(
      sql`insert into abast_asignaciones(id,empresa_id,recepcion_line_id,factura_line_id,cantidad,invoice_base,receipt_base) values(${randomUUID()}::uuid,${user.empresaId}::uuid,${a.receiptLineId}::uuid,${a.invoiceLineId}::uuid,${a.qty},${a.invoiceBase},${a.receiptBase})`,
    );
  const physical = items.filter((l) => l.aceptada > 0);
  if (physical.length)
    await applyPurchaseInventory(tx(), {
      empresaId: user.empresaId,
      usuarioId: user.id,
      almacenId: c.almacenId!,
      referenciaTabla: "abast_recepciones",
      referenciaId: id,
      items: physical.map((l) => ({
        productoId: l.productoId,
        cantidad: l.aceptada,
        costoUnitario: l.base / l.aceptada,
      })),
    });
  const outcome = await completeReceiptAccounting(user, c, id, frozen, fecha);
  await tx().execute(
    sql`update ordenes_compra set estado=case when exists(select 1 from orden_compra_detalle d where d.orden_id=${o.id}::uuid and d.cantidad_recibida<d.cantidad) then 'parcial'::orden_compra_estado else 'recibida'::orden_compra_estado end where id=${o.id}::uuid and empresa_id=${user.empresaId}::uuid`,
  );
  await audit(user, c, device, id, "recepcion_confirmada", {
    snapshot: frozen,
    accounting: outcome,
  });
  return { ok: true, id, effect: "receipt", ...outcome };
}
async function completeReceiptAccounting(
  user: SessionUser,
  c: ProcurementCommand,
  id: string,
  snap: ReceiptSnapshot,
  fecha: string,
) {
  const needs =
    snap.assignments.some((a) => a.invoiceBase !== 0 || a.receiptBase !== 0) ||
    (snap.policy.policy === "mercancia_recibida_no_facturada" &&
      snap.items.some((l) => l.unbilledBase > 0));
  if (!needs) {
    const status = snap.items.some((l) => l.base > 0)
      ? "sin_reconocimiento_hasta_factura"
      : "sin_efectos";
    await tx().execute(
      sql`update abast_recepciones set accounting_status=${status},accounting_reason=null where id=${id}::uuid and empresa_id=${user.empresaId}::uuid`,
    );
    return { accountingStatus: status };
  }
  const outcome = await tryAccounting(async () => {
    const plan = await receivingPlan(user, snap),
      asientoId = plan.parts.length
        ? await journal(
            user,
            c,
            id,
            fecha,
            plan.parts,
            "Recepción " + snap.numero,
          )
        : undefined;
    return { plan, asientoId };
  });
  if ("error" in outcome) {
    await tx().execute(
      sql`update abast_recepciones set accounting_status='pendiente',accounting_reason=${outcome.error} where id=${id}::uuid and empresa_id=${user.empresaId}::uuid`,
    );
    return { accountingStatus: "pendiente", reason: outcome.error };
  }
  const { plan, asientoId } = outcome.value;
  for (const [lineId, a] of Object.entries(plan.grniByLine))
    await tx().execute(
      sql`update abast_recepcion_detalle set grni_qty=${a.qty},grni_base=${a.base} where empresa_id=${user.empresaId}::uuid and id=${lineId}::uuid`,
    );
  await tx().execute(
    sql`update abast_recepciones set accounting_status='contabilizada',accounting_reason=null,asiento_id=${asientoId ?? null}::uuid,accounting_meta=${JSON.stringify({ grniByLine: plan.grniByLine, inventory: plan.inventory })}::jsonb where id=${id}::uuid and empresa_id=${user.empresaId}::uuid`,
  );
  return { accountingStatus: "contabilizada", asientoId };
}
async function postReceipt(
  user: SessionUser,
  c: ProcurementCommand,
  device: string | null,
): Promise<ProcurementResult> {
  must(
    c.id && c.motivo.trim(),
    "Selecciona recepción y motivo de conciliación.",
  );
  const [r] = await tx().execute(
    sql`select * from abast_recepciones where empresa_id=${user.empresaId}::uuid and sucursal_id=${c.sucursalId}::uuid and id=${c.id}::uuid for update`,
  );
  must(r, "Recepción no encontrada.");
  if (r.accounting_status !== "pendiente")
    return {
      ok: true,
      id: c.id,
      accountingStatus: s(r.accounting_status),
      asientoId: r.asiento_id ? s(r.asiento_id) : undefined,
      effect: "receipt",
    };
  const frozen = r.snapshot as ReceiptSnapshot,
    current = await config(user),
    resolved = {
      ...frozen,
      policy: {
        ...frozen.policy,
        grniAccountId: frozen.policy.grniAccountId ?? current.grniAccountId,
        varianceAccountId:
          frozen.policy.varianceAccountId ?? current.varianceAccountId,
      },
    };
  const date = c.fecha ?? frozen.fecha;
  must(
    date >= frozen.fecha && date <= (await today(user)),
    "Fecha contable de conciliación inválida.",
  );
  const result = await completeReceiptAccounting(user, c, c.id, resolved, date);
  await audit(user, c, device, c.id, "recepcion_contabilizacion_revisada", {
    motivo: c.motivo,
    fecha: date,
    resolvedPolicy: resolved.policy,
    result,
  });
  return { ok: true, id: c.id, effect: "receipt", ...result };
}

async function inventoryAccount(user: SessionUser) {
  const keys = await resolverCuentasClave(tx(), user.empresaId, ["INVENTARIO"]);
  return account(user, keys.INVENTARIO, "activo");
}
/** Returned GRNI and billed GRNI consume a single cumulative cost allocation. */
async function returnedGrni(user: SessionUser, lineId: string) {
  const [r] = await tx().execute(
    sql`select coalesce(sum((i->>'grniQty')::numeric),0) as qty,count(*) filter(where (i->>'grni')::numeric>0 and not(i ? 'grniQty')) as unknown from abast_devoluciones d cross join lateral jsonb_array_elements(d.snapshot->'items') i where d.empresa_id=${user.empresaId}::uuid and i->>'lineId'=${lineId}`,
  );
  must(
    !n(r.unknown),
    "Una devolución anterior requiere conciliación de cantidades GRNI; no se reconstruirá automáticamente.",
  );
  return n(r.qty);
}
async function invoice(
  user: SessionUser,
  c: ProcurementCommand,
  device: string | null,
): Promise<ProcurementResult> {
  const o = await order(user, c),
    snap = o.snapshot as OrderSnapshot;
  must(o.aprobada, "OC pendiente de aprobación.");
  must(
    c.numero && c.fecha && c.fechaVencimiento && c.evidencia,
    "Registra documento, fechas y referencia del original.",
  );
  must(
    c.fecha <= (await today(user)) && c.fechaVencimiento >= c.fecha,
    "Fechas inválidas.",
  );
  must(
    c.lines?.length &&
      new Set(c.lines.map((l) => l.lineId)).size === c.lines.length,
    "Líneas inválidas.",
  );
  const almacenId = await warehouse(user, c.almacenId, c.sucursalId),
    cfg = await config(user);
  const normalize = normalizeSupplierDocument,
    docKey = JSON.stringify([normalize(c.serie), normalize(c.numero)]),
    fingerprint = commandHash({
      orderId: o.id,
      fecha: c.fecha,
      vencimiento: c.fechaVencimiento,
      lines: c.lines,
      importe: c.importeDeclarado,
      numero: normalize(c.numero),
      serie: normalize(c.serie),
      evidencia: c.evidencia,
      tipo: c.tipoDocumento,
      almacenId,
    });
  const [prior] = await tx().execute(
    sql`select * from abast_facturas where empresa_id=${user.empresaId}::uuid and proveedor_id=${snap.proveedorId}::uuid and doc_key=${docKey}`,
  );
  if (prior) {
    must(
      (prior.snapshot as Row).fingerprint === fingerprint,
      "Ese documento del proveedor ya existe con otro contenido. Revisa el original.",
    );
    return {
      ok: true,
      id: s(prior.id),
      compraId: s(prior.compra_id),
      cxpId: s(prior.cxp_id),
      effect: "invoice",
    };
  }
  const legacy = await tx().execute(
    sql`select id,numero_factura from compras where empresa_id=${user.empresaId}::uuid and proveedor_id=${snap.proveedorId}::uuid and numero_factura is not null and not exists(select 1 from abast_facturas f where f.compra_id=compras.id and f.empresa_id=compras.empresa_id)`,
  );
  must(
    !legacy.some(
      (r) => normalize(s(r.numero_factura)) === normalize(c.numero!),
    ),
    "Existe una compra con ese número. No se reconstruirá ni duplicará su obligación.",
  );
  const issuer = await captureInternalDocument(c.sucursalId);
  must(
    issuer.moneda === snap.functionalCurrency,
    "Moneda funcional modificada. Revisión requerida.",
  );
  const id = randomUUID(),
    lines: Array<{
      id: string;
      line: Line;
      qty: number;
      base: number;
      tax: number;
      transit: string | null;
    }> = [],
    allocations: Array<{
      receiptLine: string;
      invoiceLine: string;
      qty: number;
      invoiceBase: number;
      receiptBase: number;
      grniQty: number;
      grniBase: number;
    }> = [],
    debits: Array<{ cuentaId: string; monto: number }> = [];
  for (const input of c.lines) {
    const l = snap.items.find((l) => l.id === input.lineId);
    must(l && input.cantidad, "Línea/cantidad inválida.");
    const [previous] = await tx().execute(
      sql`select coalesce(sum(cantidad),0) as qty from abast_factura_detalle where empresa_id=${user.empresaId}::uuid and oc_line_id=${l.id}::uuid`,
    );
    const [pendingReturn] = await tx().execute(
      sql`select d.id from abast_devoluciones d join abast_recepciones h on h.id=d.recepcion_id and h.empresa_id=d.empresa_id where d.empresa_id=${user.empresaId}::uuid and h.orden_id=${o.id}::uuid and d.accounting_status='pendiente' limit 1`,
    );
    must(
      !pendingReturn,
      "Resuelve la contabilización de la devolución antes de facturar.",
    );
    const qty = input.cantidad;
    must(
      qty <= l.cantidad - n(previous.qty) + 0.0000001,
      "Factura supera cantidad ordenada.",
    );
    const base = remainingPortion(l.base, l.cantidad, n(previous.qty), qty),
      tax = remainingPortion(l.tax, l.cantidad, n(previous.qty), qty),
      lineId = randomUUID();
    let allocated = 0;
    const receipts = await tx().execute(
      sql`select d.*,h.accounting_status,h.accounting_meta,coalesce((select sum(a.cantidad) from abast_asignaciones a where a.empresa_id=d.empresa_id and a.recepcion_line_id=d.id),0) as assigned,coalesce((select sum(a.grni_qty) from abast_asignaciones a where a.empresa_id=d.empresa_id and a.recepcion_line_id=d.id),0) as assigned_grni from abast_recepcion_detalle d join abast_recepciones h on h.id=d.recepcion_id and h.empresa_id=d.empresa_id where d.empresa_id=${user.empresaId}::uuid and d.oc_line_id=${l.id}::uuid order by h.creado_en,d.id for update of d`,
    );
    for (const r of receipts) {
      const returnedGRNI = await returnedGrni(user, s(r.id));
      const q = Math.min(
        qty - allocated,
        n(r.aceptada) - n(r.devuelta) - n(r.assigned),
      );
      if (q <= 0) continue;
      must(
        r.accounting_status !== "pendiente",
        "Conciliación contable pendiente en una recepción. Resuélvela antes de facturar.",
      );
      const ib = remainingPortion(base, qty, allocated, q),
        rb = remainingPortion(
          n(r.base),
          n(r.aceptada),
          n(r.assigned) + n(r.devuelta),
          q,
        ),
        gq = Math.min(
          q,
          Math.max(0, n(r.grni_qty) - n(r.assigned_grni) - returnedGRNI),
        ),
        gb = gq
          ? remainingPortion(
              n(r.grni_base),
              n(r.grni_qty),
              n(r.assigned_grni) + returnedGRNI,
              gq,
            )
          : 0;
      if (gq) {
        const meta = r.accounting_meta as {
            grniByLine?: Record<string, { account: string }>;
          },
          aid = await account(
            user,
            meta.grniByLine?.[s(r.id)]?.account,
            "pasivo",
          );
        debits.push({ cuentaId: aid, monto: gb });
      }
      if (q > gq)
        debits.push({
          cuentaId: await inventoryAccount(user),
          monto: posMoney(rb - gb),
        });
      allocations.push({
        receiptLine: s(r.id),
        invoiceLine: lineId,
        qty: q,
        invoiceBase: ib,
        receiptBase: rb,
        grniQty: gq,
        grniBase: gb,
      });
      allocated += q;
    }
    let transit: string | null = null;
    if (allocated < qty) {
      const [physical] = await tx().execute(
        sql`select d.cantidad_recibida,coalesce((select sum(f.cantidad-coalesce((select sum(a.cantidad) from abast_asignaciones a where a.empresa_id=f.empresa_id and a.factura_line_id=f.id),0)) from abast_factura_detalle f where f.empresa_id=${user.empresaId}::uuid and f.oc_line_id=d.id),0) as prior_transit from orden_compra_detalle d where d.id=${l.id}::uuid and d.orden_id=${o.id}::uuid`,
      );
      must(
        qty - allocated <=
          Math.max(
            0,
            l.cantidad -
              n(physical.cantidad_recibida) -
              n(physical.prior_transit),
          ) +
            0.0000001,
        "El documento incluye mercancía devuelta sin facturar. Concilia con el proveedor antes de crear la obligación; no se registrará como mercancía en tránsito.",
      );
      transit = await account(user, cfg.transitAccountId, "activo");
      debits.push({
        cuentaId: transit,
        monto: posMoney(
          base -
            allocations
              .filter((a) => a.invoiceLine === lineId)
              .reduce((v, a) => v + a.invoiceBase, 0),
        ),
      });
    }
    lines.push({ id: lineId, line: l, qty, base, tax, transit });
  }
  const base = money(lines.map((l) => l.base)),
    tax = money(lines.map((l) => l.tax)),
    total = posMoney(base + tax);
  must(
    total > 0,
    "Un documento sin importe no origina una obligación financiera en este flujo.",
  );
  must(
    c.importeDeclarado === total,
    "El total declarado no coincide con la OC aprobada (incluye flete e impuestos).",
  );
  const variance = posMoney(base - money(debits.map((d) => d.monto)));
  if (variance)
    debits.push({
      cuentaId: await account(user, cfg.varianceAccountId, "variacion"),
      monto: variance,
    });
  const result = await procesarCompraBusiness(
    {
      proveedorId: snap.proveedorId,
      almacenId,
      numeroFactura: c.numero,
      fecha: c.fecha,
      esCredito: true,
      diasCredito: Math.max(
        1,
        Math.round(
          (Date.parse(c.fechaVencimiento) - Date.parse(c.fecha)) / 86400000,
        ),
      ),
      items: lines.map((l) => ({
        productoId: l.line.productoId,
        cantidad: l.qty,
        costoUnitario: l.base / l.qty,
        impuesto: l.tax,
      })),
      notas: "Documento de proveedor: " + c.tipoDocumento,
    },
    user,
    {
      ordenId: s(o.id),
      accountingDebits: debits,
      fechaVencimiento: c.fechaVencimiento,
      lineAmounts: lines.map((l) => l.base),
    },
  );
  must(result.ok, result.ok ? "" : result.error);
  const [cxp] = await tx().execute(
    sql`select id from cuentas_por_pagar where empresa_id=${user.empresaId}::uuid and compra_id=${result.compraId}::uuid`,
  );
  must(cxp, "Compra sin obligación financiera.");
  await tx().execute(
    sql`insert into abast_facturas(id,empresa_id,sucursal_id,orden_id,proveedor_id,compra_id,cxp_id,doc_key,numero,serie,fecha,vencimiento,moneda,tipo_cambio,functional_currency,snapshot,usuario_id,device_id) values(${id}::uuid,${user.empresaId}::uuid,${c.sucursalId}::uuid,${o.id}::uuid,${snap.proveedorId}::uuid,${result.compraId}::uuid,${cxp.id}::uuid,${docKey},${c.numero},${c.serie},${c.fecha}::date,${c.fechaVencimiento}::date,${snap.moneda},${snap.tipoCambio},${snap.functionalCurrency},${JSON.stringify({ fingerprint, numero: c.numero, serie: c.serie, tipo: c.tipoDocumento, evidencia: c.evidencia, order: snap, lines, allocations, base, tax, total, issuer })}::jsonb,${user.id}::uuid,${device}::uuid)`,
  );
  for (const l of lines)
    await tx().execute(
      sql`insert into abast_factura_detalle(id,empresa_id,factura_id,orden_id,oc_line_id,cantidad,base,impuesto,transit_account_id) values(${l.id}::uuid,${user.empresaId}::uuid,${id}::uuid,${o.id}::uuid,${l.line.id}::uuid,${l.qty},${l.base},${l.tax},${l.transit}::uuid)`,
    );
  for (const a of allocations)
    await tx().execute(
      sql`insert into abast_asignaciones(id,empresa_id,recepcion_line_id,factura_line_id,cantidad,invoice_base,receipt_base,grni_qty,grni_base) values(${randomUUID()}::uuid,${user.empresaId}::uuid,${a.receiptLine}::uuid,${a.invoiceLine}::uuid,${a.qty},${a.invoiceBase},${a.receiptBase},${a.grniQty},${a.grniBase})`,
    );
  await audit(user, c, device, id, "factura_proveedor_registrada", {
    compraId: result.compraId,
    cxpId: cxp.id,
    asientoId: result.asientoId,
    recepciones: allocations,
  });
  return {
    ok: true,
    id,
    compraId: result.compraId,
    cxpId: s(cxp.id),
    asientoId: result.asientoId,
    effect: "invoice",
  };
}
type ReturnSnapshot = {
  evidencia?: string;
  motivo?: string;
  fecha: string;
  numero: string;
  receiptId: string;
  policy: PurchaseConfig;
  items: Array<{
    lineId: string;
    productoId: string;
    qty: number;
    cost: number;
    claim: number;
    grni: number;
    grniQty: number;
    grniAccount: string | null;
    unrecognized: number;
  }>;
  almacenId: string;
};
async function returnGoods(
  user: SessionUser,
  c: ProcurementCommand,
  device: string | null,
): Promise<ProcurementResult> {
  must(
    c.id && c.lines?.length && c.motivo && c.evidencia,
    "Selecciona recepción, cantidades, motivo y evidencia.",
  );
  must(
    new Set(c.lines.map((l) => l.lineId)).size === c.lines.length,
    "No repitas líneas.",
  );
  const [r] = await tx().execute(
    sql`select * from abast_recepciones where empresa_id=${user.empresaId}::uuid and sucursal_id=${c.sucursalId}::uuid and id=${c.id}::uuid for update`,
  );
  must(r, "Recepción no encontrada.");
  await warehouse(user, s(r.almacen_id), c.sucursalId);
  must(
    r.accounting_status !== "pendiente",
    "Resuelve la contabilización de la recepción antes de devolver.",
  );
  const source = r.snapshot as ReceiptSnapshot,
    policy = await config(user),
    items: ReturnSnapshot["items"] = [],
    id = randomUUID(),
    fecha = c.fecha ?? (await today(user));
  must(
    fecha >= s(r.fecha) && fecha <= (await today(user)),
    "Fecha de devolución inválida.",
  );
  for (const input of c.lines) {
    const [l] = await tx().execute(
      sql`select d.*,p.producto_id as product from abast_recepcion_detalle d join orden_compra_detalle p on p.id=d.oc_line_id where d.id=${input.lineId}::uuid and d.empresa_id=${user.empresaId}::uuid and d.recepcion_id=${r.id}::uuid for update of d`,
    );
    must(
      l && input.cantidad && input.cantidad <= n(l.aceptada) - n(l.devuelta),
      "Cantidad superior a lo recibido disponible.",
    );
    const qty = input.cantidad,
      [stock] = await tx().execute(
        sql`select e.cantidad,p.costo_promedio from existencias e join productos p on p.id=e.producto_id and p.empresa_id=e.empresa_id where e.empresa_id=${user.empresaId}::uuid and e.almacen_id=${r.almacen_id}::uuid and e.producto_id=${l.product}::uuid for update of e,p`,
      );
    must(
      stock && n(stock.cantidad) >= qty,
      "Existencias insuficientes para confirmar devolución.",
    );
    const [a] = await tx().execute(
      sql`select coalesce(sum(cantidad),0) as qty,coalesce(sum(grni_qty),0) as gqty from abast_asignaciones where empresa_id=${user.empresaId}::uuid and recepcion_line_id=${l.id}::uuid`,
    );
    const returnedGRNI = await returnedGrni(user, s(l.id));
    const unbilled = Math.max(0, n(l.aceptada) - n(a.qty) - n(l.devuelta)),
      uq = Math.min(qty, unbilled),
      gq = Math.min(uq, Math.max(0, n(l.grni_qty) - n(a.gqty) - returnedGRNI)),
      grni = gq
        ? remainingPortion(
            n(l.grni_base),
            n(l.grni_qty),
            n(a.gqty) + returnedGRNI,
            gq,
          )
        : 0,
      claim =
        qty > uq
          ? remainingPortion(
              n(l.base),
              n(l.aceptada),
              n(l.devuelta) + uq,
              qty - uq,
            )
          : 0;
    items.push({
      lineId: s(l.id),
      productoId: s(l.product),
      qty,
      cost: posMoney(qty * n(stock.costo_promedio)),
      claim,
      grni,
      grniQty: gq,
      grniAccount:
        (
          r.accounting_meta as {
            grniByLine?: Record<string, { account: string }>;
          }
        ).grniByLine?.[s(l.id)]?.account ?? null,
      unrecognized: uq - gq,
    });
    await tx().execute(
      sql`update abast_recepcion_detalle set devuelta=devuelta+${qty} where id=${l.id}::uuid and empresa_id=${user.empresaId}::uuid`,
    );
    // Serialize identical products and keep aggregate stock checks correct within the same return.
    await applyPurchaseInventory(tx(), {
      empresaId: user.empresaId,
      usuarioId: user.id,
      almacenId: s(r.almacen_id),
      referenciaTabla: "abast_devoluciones",
      referenciaId: id,
      tipo: "devolucion_proveedor",
      items: [
        {
          productoId: s(l.product),
          cantidad: -qty,
          costoUnitario: n(stock.costo_promedio),
        },
      ],
    });
  }
  const frozen: ReturnSnapshot = {
    evidencia: c.evidencia,
    motivo: c.motivo,
    fecha,
    numero: "DEV-" + id,
    receiptId: c.id,
    policy,
    items,
    almacenId: s(r.almacen_id),
  };
  await tx().execute(
    sql`insert into abast_devoluciones(id,empresa_id,sucursal_id,recepcion_id,numero,fecha,snapshot,accounting_status,usuario_id,device_id) values(${id}::uuid,${user.empresaId}::uuid,${c.sucursalId}::uuid,${r.id}::uuid,${frozen.numero},${fecha}::date,${JSON.stringify(frozen)}::jsonb,'pendiente',${user.id}::uuid,${device}::uuid)`,
  );
  const result = await completeReturnAccounting(user, c, id, frozen, fecha);
  await audit(user, c, device, id, "devolucion_confirmada", {
    snapshot: frozen,
    motivo: c.motivo,
    evidencia: c.evidencia,
    accounting: result,
    obligacion: "sin_reduccion_automatica",
  });
  return { ok: true, id, effect: "return", ...result };
}
async function completeReturnAccounting(
  user: SessionUser,
  c: ProcurementCommand,
  id: string,
  snap: ReturnSnapshot,
  fecha: string,
) {
  const result = await tryAccounting(async () => {
    const parts: PartidaAsiento[] = [];
    let recognized = 0;
    for (const l of snap.items) {
      if (l.grni) {
        parts.push({
          cuentaId: await account(user, l.grniAccount, "pasivo"),
          debe: l.grni,
          haber: 0,
        });
        recognized += l.grni;
      }
      if (l.claim) {
        parts.push({
          cuentaId: await account(user, snap.policy.claimAccountId, "activo"),
          debe: l.claim,
          haber: 0,
        });
        recognized += l.claim;
      }
    }
    if (!recognized) return undefined;
    const cost = money(
        snap.items.map((l) =>
          posMoney((l.cost * (l.qty - l.unrecognized)) / l.qty),
        ),
      ),
      inventory = await inventoryAccount(user);
    parts.push({ cuentaId: inventory, debe: 0, haber: cost });
    const diff = posMoney(cost - recognized);
    if (diff)
      parts.push({
        cuentaId: await account(
          user,
          snap.policy.varianceAccountId,
          "variacion",
        ),
        debe: Math.max(0, diff),
        haber: Math.max(0, -diff),
      });
    return journal(user, c, id, fecha, parts, "Devolución " + snap.numero);
  });
  const status =
      "error" in result
        ? "pendiente"
        : result.value
          ? "contabilizada"
          : "sin_reconocimiento_hasta_factura",
    reason = "error" in result ? result.error : undefined,
    asientoId = "value" in result ? result.value : undefined;
  await tx().execute(
    sql`update abast_devoluciones set accounting_status=${status},accounting_reason=${reason ?? null},asiento_id=${asientoId ?? null}::uuid where empresa_id=${user.empresaId}::uuid and id=${id}::uuid`,
  );
  return { accountingStatus: status, reason, asientoId };
}
async function postReturn(
  user: SessionUser,
  c: ProcurementCommand,
  device: string | null,
): Promise<ProcurementResult> {
  must(c.id && c.motivo, "Selecciona devolución y motivo.");
  const [r] = await tx().execute(
    sql`select * from abast_devoluciones where empresa_id=${user.empresaId}::uuid and sucursal_id=${c.sucursalId}::uuid and id=${c.id}::uuid for update`,
  );
  must(r, "Devolución no encontrada.");
  if (r.accounting_status !== "pendiente")
    return {
      ok: true,
      id: c.id,
      effect: "return",
      accountingStatus: s(r.accounting_status),
    };
  const snap = r.snapshot as ReturnSnapshot,
    current = await config(user),
    fecha = c.fecha ?? snap.fecha;
  must(
    fecha >= snap.fecha && fecha <= (await today(user)),
    "Fecha de conciliación inválida.",
  );
  const result = await completeReturnAccounting(
    user,
    c,
    c.id,
    {
      ...snap,
      policy: {
        ...snap.policy,
        claimAccountId: snap.policy.claimAccountId ?? current.claimAccountId,
        varianceAccountId:
          snap.policy.varianceAccountId ?? current.varianceAccountId,
      },
    },
    fecha,
  );
  await audit(user, c, device, c.id, "devolucion_contabilizacion_revisada", {
    result,
    motivo: c.motivo,
    fecha,
  });
  return { ok: true, id: c.id, effect: "return", ...result };
}
async function pay(
  user: SessionUser,
  c: ProcurementCommand,
  device: string | null,
): Promise<ProcurementResult> {
  must(
    c.cxpId &&
      c.cuentaFinancieraId &&
      c.monto &&
      c.confirmado &&
      c.paymentSource,
    "Selecciona deuda, importe y confirma el pago real.",
  );
  const [debt] = await tx().execute(
    sql`select d.*,p.sucursal_id from cuentas_por_pagar d join compras p on p.id=d.compra_id and p.empresa_id=d.empresa_id where d.empresa_id=${user.empresaId}::uuid and d.id=${c.cxpId}::uuid and p.sucursal_id=${c.sucursalId}::uuid for update of d`,
  );
  must(debt, "Cuenta por pagar fuera de esta sucursal.");
  const [f] = await tx().execute(
    sql`select f.* from cuentas_financieras f join empresas e on e.id=f.empresa_id where f.empresa_id=${user.empresaId}::uuid and f.id=${c.cuentaFinancieraId}::uuid and f.activa and (f.sucursal_id is null or f.sucursal_id=${c.sucursalId}::uuid) and f.moneda=e.moneda`,
  );
  must(f, "Cuenta financiera inactiva, de otra sucursal o moneda.");
  const fecha = c.fecha ?? (await today(user));
  must(
    fecha >= s(debt.fecha_emision) && fecha <= (await today(user)),
    "Fecha de pago inválida.",
  );
  if (f.tipo === "caja") {
    must(
      c.paymentSource === "cash" && c.sesionCajaId,
      "El efectivo requiere el turno original.",
    );
    const [turn] = await tx().execute(
      sql`select s.id from sesiones_caja s join cajas ca on ca.id=s.caja_id and ca.empresa_id=s.empresa_id where s.id=${c.sesionCajaId}::uuid and s.empresa_id=${user.empresaId}::uuid and ca.sucursal_id=${c.sucursalId}::uuid and s.estado='abierta' and ca.cuenta_financiera_id=${f.id}::uuid`,
    );
    must(turn, "Turno de caja no válido.");
  } else {
    must(
      c.paymentSource !== "cash" && c.evidencia,
      "Registra referencia de confirmación bancaria real.",
    );
    if (c.paymentSource === "external_terminal_manual")
      must(
        c.terminalIndependiente && c.autorizacion,
        "Registra autorización del datáfono independiente.",
      );
  }
  const result = await registrarPagoBusiness(
    {
      cxpId: c.cxpId,
      cuentaFinancieraId: c.cuentaFinancieraId,
      monto: c.monto,
      fecha,
      referencia: c.evidencia,
      notas: c.motivo,
      sesionCajaId: c.sesionCajaId,
    },
    user,
  );
  must(result.ok, result.ok ? "" : result.error);
  const [p] = await tx().execute(
    sql`select asiento_id from pagos_proveedor where empresa_id=${user.empresaId}::uuid and id=${result.pagoId}::uuid`,
  );
  await audit(user, c, device, result.pagoId, "pago_registrado", {
    cxpId: c.cxpId,
    paymentSource: c.paymentSource,
    autorizacion: c.autorizacion,
    evidencia: c.evidencia,
    monto: c.monto,
    asientoId: p.asiento_id,
  });
  return {
    ok: true,
    id: result.pagoId,
    asientoId: s(p.asiento_id),
    cxpId: c.cxpId,
    effect: "payment",
  };
}
async function statement(
  user: SessionUser,
  c: ProcurementCommand,
): Promise<ProcurementResult> {
  const vendor = await supplier(user, c.proveedorId, false),
    date = await today(user),
    [e] = await tx().execute(
      sql`select moneda from empresas where id=${user.empresaId}::uuid`,
    );
  const documents = [
    ...(await tx().execute(
      sql`select d.id,coalesce(p.numero_factura,'—') as numero,d.fecha_emision::text as fecha,d.fecha_vencimiento::text as vencimiento,d.monto::float8 as monto,d.saldo::float8 as saldo from cuentas_por_pagar d join compras p on p.id=d.compra_id and p.empresa_id=d.empresa_id where d.empresa_id=${user.empresaId}::uuid and d.proveedor_id=${vendor.id}::uuid and p.sucursal_id=${c.sucursalId}::uuid order by d.fecha_emision,d.id`,
    )),
  ] as Array<{
    id: string;
    numero: string;
    fecha: string;
    vencimiento: string;
    monto: number;
    saldo: number;
  }>;
  const payments = [
    ...(await tx().execute(
      sql`select a.id,a.fecha::text,a.monto::float8,a.referencia,a.asiento_id as "asientoId" from pagos_proveedor a join cuentas_por_pagar d on d.id=a.cxp_id and d.empresa_id=a.empresa_id join compras p on p.id=d.compra_id and p.empresa_id=d.empresa_id where a.empresa_id=${user.empresaId}::uuid and d.proveedor_id=${vendor.id}::uuid and p.sucursal_id=${c.sucursalId}::uuid order by a.fecha,a.id`,
    )),
  ] as Array<{
    id: string;
    fecha: string;
    monto: number;
    referencia: string | null;
    asientoId: string | null;
  }>;
  const buckets = [
      "Al día",
      "1–30 días",
      "31–60 días",
      "61–90 días",
      "Más de 90 días",
    ],
    aging = buckets.map((bucket) => ({ bucket, total: 0, count: 0 }));
  for (const d of documents) {
    if (d.saldo <= 0) continue;
    const days = Math.floor(
        (Date.parse(date) - Date.parse(d.vencimiento)) / 86400000,
      ),
      i = days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4;
    aging[i].total = posMoney(aging[i].total + d.saldo);
    aging[i].count++;
  }
  const [claims] = await tx().execute(
    sql`select coalesce(sum((i->>'claim')::numeric),0) as amount from abast_devoluciones d join abast_recepciones r on r.id=d.recepcion_id and r.empresa_id=d.empresa_id join ordenes_compra o on o.id=r.orden_id and o.empresa_id=r.empresa_id cross join lateral jsonb_array_elements(d.snapshot->'items') i where d.empresa_id=${user.empresaId}::uuid and d.sucursal_id=${c.sucursalId}::uuid and o.proveedor_id=${vendor.id}::uuid`,
  );
  return {
    ok: true,
    statement: {
      proveedor: s(vendor.nombre),
      currency: s(e.moneda),
      saldo: money(documents.map((d) => d.saldo)),
      aging,
      documents,
      payments,
      pendingClaims: n(claims.amount),
    },
  };
}
async function list(
  user: SessionUser,
  c: ProcurementCommand,
  perms: string[],
): Promise<ProcurementResult> {
  const see = perms.includes("rfq.ver"),
    debt = perms.includes("cxp.ver");
  const rfqs = see
    ? [
        ...(await tx().execute(
          sql`select id,numero,estado,version,snapshot->>'titulo' as nombre,creado_en::date::text as fecha from abast_rfq where empresa_id=${user.empresaId}::uuid and sucursal_id=${c.sucursalId}::uuid order by creado_en desc,id limit 500`,
        )),
      ]
    : [];
  const orders = see
    ? [
        ...(await tx().execute(
          sql`select a.id,o.numero,case when a.aprobada then o.estado::text else 'pendiente_aprobacion' end as estado,a.version,o.fecha::text,o.total::float8,coalesce(p.nombre_comercial,p.razon_social) as nombre from abast_oc a join ordenes_compra o on o.id=a.id and o.empresa_id=a.empresa_id join proveedores p on p.id=o.proveedor_id and p.empresa_id=o.empresa_id where a.empresa_id=${user.empresaId}::uuid and o.sucursal_id=${c.sucursalId}::uuid order by o.fecha desc,o.id limit 500`,
        )),
      ]
    : [];
  const receipts = see
    ? [
        ...(await tx().execute(
          sql`select id,numero,'confirmada' as estado,1 as version,fecha::text,accounting_status as "accountingStatus",accounting_reason as reason from abast_recepciones where empresa_id=${user.empresaId}::uuid and sucursal_id=${c.sucursalId}::uuid order by creado_en desc,id limit 500`,
        )),
      ]
    : [];
  const returns = see
    ? [
        ...(await tx().execute(
          sql`select id,numero,'confirmada' as estado,1 as version,fecha::text,accounting_status as "accountingStatus",accounting_reason as reason from abast_devoluciones where empresa_id=${user.empresaId}::uuid and sucursal_id=${c.sucursalId}::uuid order by creado_en desc,id limit 500`,
        )),
      ]
    : [];
  const invoices = debt
    ? [
        ...(await tx().execute(
          sql`select f.id,f.numero,d.estado,1 as version,f.fecha::text,d.monto::float8 as total from abast_facturas f join cuentas_por_pagar d on d.id=f.cxp_id and d.empresa_id=f.empresa_id where f.empresa_id=${user.empresaId}::uuid and f.sucursal_id=${c.sucursalId}::uuid order by f.creado_en desc,f.id limit 500`,
        )),
      ]
    : [];
  const products = [
    ...(await tx().execute(
      sql`select id,nombre from productos where empresa_id=${user.empresaId}::uuid and activo and eliminado_en is null order by nombre,id limit 2000`,
    )),
  ];
  const suppliers = [
    ...(await tx().execute(
      sql`select p.id,coalesce(p.nombre_comercial,p.razon_social)||case when p.activo and p.eliminado_en is null then '' else ' (inactivo)' end as nombre,(p.activo and p.eliminado_en is null) as active from proveedores p where p.empresa_id=${user.empresaId}::uuid and ((p.activo and p.eliminado_en is null) or exists(select 1 from cuentas_por_pagar d join compras c on c.id=d.compra_id and c.empresa_id=d.empresa_id where d.empresa_id=p.empresa_id and d.proveedor_id=p.id and c.sucursal_id=${c.sucursalId}::uuid)) order by nombre,p.id limit 2000`,
    )),
  ];
  const warehouses = [
    ...(await tx().execute(
      sql`select id,nombre from almacenes where empresa_id=${user.empresaId}::uuid and sucursal_id=${c.sucursalId}::uuid and activo order by nombre,id`,
    )),
  ];
  const accounts = perms.includes("cxp.configurar")
    ? [
        ...(await tx().execute(
          sql`select id,codigo||' · '||nombre as nombre,tipo::text from catalogo_cuentas where empresa_id=${user.empresaId}::uuid and activa and es_detalle and permite_movimiento order by codigo,id`,
        )),
      ]
    : [];
  const financial = perms.includes("cxp.pagar")
    ? [
        ...(await tx().execute(
          sql`select id,nombre,tipo::text,moneda::text from cuentas_financieras where empresa_id=${user.empresaId}::uuid and activa and (sucursal_id is null or sucursal_id=${c.sucursalId}::uuid) order by nombre,id`,
        )),
      ]
    : [];
  const sessions = perms.includes("cxp.pagar")
    ? [
        ...(await tx().execute(
          sql`select s.id,c.nombre from sesiones_caja s join cajas c on c.id=s.caja_id and c.empresa_id=s.empresa_id where s.empresa_id=${user.empresaId}::uuid and c.sucursal_id=${c.sucursalId}::uuid and s.estado='abierta' order by c.nombre,s.id`,
        )),
      ]
    : [];
  const [e] = await tx().execute(
      sql`select moneda from empresas where id=${user.empresaId}::uuid`,
    ),
    [cfg] = await tx().execute(
      sql`select * from abast_config where empresa_id=${user.empresaId}::uuid`,
    );
  return {
    ok: true,
    rfqs,
    orders,
    receipts,
    returns,
    invoices,
    options: {
      products,
      suppliers,
      warehouses,
      accounts,
      financial,
      sessions,
      currency: s(e.moneda),
      config: cfg
        ? {
            policy: cfg.policy,
            grniAccountId: cfg.grni_account_id,
            transitAccountId: cfg.transit_account_id,
            claimAccountId: cfg.claim_account_id,
            varianceAccountId: cfg.variance_account_id,
          }
        : null,
    },
  } as unknown as ProcurementResult;
}
