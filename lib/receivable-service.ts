import { invalidarModulos } from "./redis/cache";
import { MODULOS } from "./redis/keys";
import { randomUUID, createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  executeBusinessAction,
  executeBusinessRead,
  revalidateBusinessPath,
} from "./business-action";
import { currentBusinessContext } from "./business-context";
import { inAuthenticatedUserContext } from "./authenticated-user-context";
import type { SessionUser } from "./actions/session-helpers";
import { getAccessContext } from "./server-access";
import { storedCommand, recoverStored, commandHash } from "./stored-command";
import {
  receivableCommandSchema,
  allocateCents,
  remainingPortion,
  type ReceivableCommand,
  type ReceivableResult,
} from "./receivable-core";
import {
  crearAsiento,
  type PartidaAsiento,
} from "./contabilidad/motor-asientos";
import { resolverCuentasClave } from "./contabilidad/helpers";
import { cashSession, cashEntry } from "./cash-service";
import { confirmManualPayment, manualPaymentKind } from "./pos-payment";
import {
  captureInternalDocument,
  internalReceiptLegend,
} from "./internal-document";
import { fechaISOEnZona, fechaMediodiaUTC } from "./dates";
import { posMoney } from "./pos-money";
import { inputMessage } from "./document-display";
import type { PrintableDocument } from "./commercial-pdf";
const ctx = () => {
  const c = currentBusinessContext();
  if (!c) throw new Error("Falta transacción comercial.");
  return c;
};
function must(v: unknown, m: string): asserts v {
  if (!v) throw new Error(m);
}
const permission: Record<ReceivableCommand["action"], string> = {
  list: "cxc.ver",
  customer: "cxc.ver",
  sale: "ventas.ver",
  configure: "cxc.configurar",
  advance: "cxc.anticipar",
  apply: "cxc.aplicar",
  refund: "cxc.reembolsar",
  collect: "cxc.cobrar",
  creditNote: "venta.nota_credito",
  recover: "cxc.ver",
};
export async function executeReceivables(
  user: SessionUser,
  input: unknown,
  device: string | null = null,
  branches?: string[],
): Promise<ReceivableResult> {
  try {
    const c = receivableCommandSchema.parse(input),
      reader = ["list", "customer", "sale"].includes(c.action);
    const completed = await inAuthenticatedUserContext(user, () =>
      (reader ? executeBusinessRead : executeBusinessAction)(user, async () => {
        if (device) ctx().deviceId = device;
        if (branches) ctx().sucursalIds = branches;
        const access = await getAccessContext(user);
        must(
          !access.suscripcionBloqueada &&
            access.plan.features[
              c.action === "sale" || c.action === "creditNote"
                ? "facturacion"
                : "cuentas_por_cobrar"
            ] &&
            access.permisos.includes(permission[c.action]),
          "No tienes el permiso requerido para esta operación.",
        );
        if (c.action === "creditNote") {
          if (c.cancel)
            must(
              access.permisos.includes("venta.anular"),
              "Sin permiso para anular.",
            );
          if (c.lines?.some((l) => l.reingresar))
            must(
              access.permisos.includes("venta.devolver"),
              "Sin permiso para reingresar productos.",
            );
        }
        if (branches)
          must(
            branches.includes(c.sucursalId),
            "Sucursal no autorizada para el dispositivo.",
          );
        const [branch] = await ctx().tx.execute(
          sql`select s.id from sucursales s join usuarios u on u.id=${user.id}::uuid and u.empresa_id=s.empresa_id and u.activo and u.eliminado_en is null where s.id=${c.sucursalId}::uuid and s.empresa_id=${user.empresaId}::uuid and s.activa and s.eliminado_en is null and (not exists(select 1 from usuario_sucursales us join sucursales b on b.id=us.sucursal_id where us.usuario_id=u.id and b.empresa_id=s.empresa_id) or exists(select 1 from usuario_sucursales us where us.usuario_id=u.id and us.sucursal_id=s.id))`,
        );
        must(branch, "Sucursal no autorizada.");
        const scope = {
          branch: c.sucursalId,
          kind: "cxc_avanzada",
          requestId: c.requestId,
        };
        const result =
          c.action === "recover"
            ? await recoverStored<ReceivableResult>(
                scope,
                c.attemptId ?? c.requestId,
              )
            : reader
              ? await execute(user, c, device)
              : await storedCommand(scope, c, async () => {
                  const result = await execute(user, c, device);
                  return result.ok
                    ? {
                        ...result,
                        confirmation: {
                          version: 1 as const,
                          empresaId: user.empresaId,
                          userId: user.id,
                          sucursalId: c.sucursalId,
                          requestId: c.requestId,
                          hash: commandHash(c),
                        },
                      }
                    : result;
                });
        if (result.ok) {
          for (const path of [
            "/cxc",
            "/cxc/avanzada",
            "/ventas",
            "/facturas",
            "/contabilidad",
            "/tesoreria",
            "/inventario",
          ])
            if (!reader) revalidateBusinessPath(path);
          return { ...result, permissions: access.permisos };
        }
        return result;
      }),
    );
    if (completed.ok && !reader)
      await invalidarModulos(user.empresaId, [
        MODULOS.DASHBOARD,
        MODULOS.CONTABILIDAD,
        MODULOS.REPORTES,
      ]);
    return completed;
  } catch (e) {
    return {
      ok: false,
      error: inputMessage(e, "No se pudo completar la operación financiera."),
    };
  }
}
async function customer(user: SessionUser, id?: string) {
  must(id, "Selecciona un cliente.");
  const [r] = await ctx().tx.execute(
    sql`select id,nombre,identificacion_fiscal from clientes where id=${id}::uuid and empresa_id=${user.empresaId}::uuid and activo and eliminado_en is null`,
  );
  must(r, "Cliente no autorizado o inactivo.");
  return r as {
    id: string;
    nombre: string;
    identificacion_fiscal: string | null;
  };
}
async function day(user: SessionUser) {
  const [r] = await ctx().tx.execute(
    sql`select zona_horaria from empresas where id=${user.empresaId}::uuid`,
  );
  return fechaISOEnZona(new Date(), String(r.zona_horaria));
}
async function liability(user: SessionUser, id?: string) {
  const [row] = await ctx().tx.execute(
    sql`select a.id from catalogo_cuentas a where a.empresa_id=${user.empresaId}::uuid and a.id=${id ?? null}::uuid and a.tipo='pasivo' and a.activa and a.es_detalle and a.permite_movimiento`,
  );
  must(
    row,
    "Configura una cuenta de pasivo válida para anticipos y créditos de clientes. No se crearán cuentas ficticias.",
  );
  return String(row.id);
}
async function configured(user: SessionUser) {
  const [r] = await ctx().tx.execute(
    sql`select cuenta_pasivo_id from cxc_configuracion where empresa_id=${user.empresaId}::uuid`,
  );
  return liability(user, r ? String(r.cuenta_pasivo_id) : undefined);
}
async function receivable(user: SessionUser, c: ReceivableCommand) {
  must(c.cxcId, "Selecciona una cuenta por cobrar.");
  const [r] = await ctx().tx.execute(
    sql`select x.*,v.sucursal_id,v.numero from cuentas_por_cobrar x join ventas v on v.id=x.venta_id and v.empresa_id=x.empresa_id where x.id=${c.cxcId}::uuid and x.empresa_id=${user.empresaId}::uuid and v.sucursal_id=${c.sucursalId}::uuid for update of x`,
  );
  must(r, "Cuenta por cobrar no encontrada en esta sucursal.");
  return r;
}
async function financial(
  user: SessionUser,
  c: ReceivableCommand,
  outgoing = false,
) {
  if (outgoing)
    must(
      (await getAccessContext(user)).permisos.includes("cxc.reembolsar"),
      "Sin permiso para reembolsar fondos.",
    );
  must(c.formaPagoId, "Selecciona la forma de pago.");
  const [r] = await ctx().tx.execute(
    sql`select f.id,f.codigo,a.cuenta_contable_id,a.moneda,a.tipo from formas_pago f join cuentas_financieras a on a.id=f.cuenta_financiera_id and a.empresa_id=f.empresa_id join catalogo_cuentas p on p.id=a.cuenta_contable_id and p.empresa_id=a.empresa_id where f.id=${c.formaPagoId}::uuid and f.empresa_id=${user.empresaId}::uuid and f.activa and a.activa and (a.sucursal_id is null or a.sucursal_id=${c.sucursalId}::uuid) and p.activa and p.es_detalle and p.permite_movimiento and p.tipo='activo'`,
  );
  must(
    r,
    "Forma de pago sin cuenta financiera/contable válida para esta sucursal.",
  );
  const code = String(r.codigo).toUpperCase(),
    kind = manualPaymentKind(code);
  must(
    kind !== "unsupported" || ["TRA", "TRANSFERENCIA"].includes(code),
    "Esta forma de pago requiere un proveedor que ARCA aún no verifica.",
  );
  must(
    c.confirmed,
    "Confirma el movimiento real; no se presume aprobación del proveedor.",
  );
  if (kind === "card")
    confirmManualPayment(code, {
      terminalApproved: true,
      terminalIndependent: c.terminalIndependent,
      terminalAuthorization: c.terminalAuthorization,
    });
  if (kind === "card" || kind === "unsupported")
    must(
      c.referencia.trim(),
      outgoing
        ? "Registra la referencia del reembolso confirmado."
        : "Registra la referencia del pago confirmado.",
    );
  const turn =
    kind === "cash"
      ? await cashSession(
          user,
          c.sesionCajaId ?? "00000000-0000-0000-0000-000000000000",
        )
      : null;
  if (turn)
    must(
      turn.sucursal_id === c.sucursalId && turn.estado === "abierta",
      "Selecciona el turno de caja original abierto de esta sucursal.",
    );
  return {
    account: String(r.cuenta_contable_id),
    currency: String(r.moneda),
    turn,
    evidence: {
      source:
        kind === "cash"
          ? "cash"
          : kind === "card"
            ? "external_terminal_manual"
            : "bank_transfer_confirmed_manual",
      confirmedBy: user.id,
      reference: c.referencia,
      terminalAuthorization: c.terminalAuthorization ?? null,
    },
  };
}
async function journal(
  user: SessionUser,
  c: ReceivableCommand,
  id: string,
  fecha: string,
  partidas: PartidaAsiento[],
  concepto: string,
) {
  const ids = [...new Set(partidas.map((p) => p.cuentaId))];
  const rows = await ctx().tx.execute(
    sql`select id from catalogo_cuentas where empresa_id=${user.empresaId}::uuid and id=any(ARRAY(select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))::uuid[]) and activa and es_detalle and permite_movimiento`,
  );
  must(
    rows.length === ids.length,
    "Una cuenta contable está deshabilitada o no pertenece a la empresa.",
  );
  return crearAsiento(ctx().tx, {
    empresaId: user.empresaId,
    sucursalId: c.sucursalId,
    fecha: fechaMediodiaUTC(fecha),
    concepto,
    origen: "manual",
    referenciaTabla: "cxc_eventos",
    referenciaId: id,
    partidas,
    usuarioId: user.id,
  });
}
async function document(
  user: SessionUser,
  c: ReceivableCommand,
  client: { nombre: unknown; identificacion_fiscal?: unknown } | null,
  numero: string,
  fecha: string,
  total: number,
  kind: PrintableDocument["kind"],
  items?: PrintableDocument["snapshot"]["items"],
  base?: number,
  tax = 0,
): Promise<PrintableDocument> {
  const issuer = await captureInternalDocument(c.sucursalId);
  return {
    id: c.requestId,
    origenId: c.requestId,
    kind,
    numero,
    version: 1,
    estado: "registrado",
    ventaId: c.ventaId ?? null,
    events: [],
    revisions: [],
    snapshot: {
      sucursalId: c.sucursalId,
      clienteId: c.clienteId ?? null,
      fecha,
      vigenteHasta: null,
      moneda: String(issuer.moneda),
      issuer: issuer.issuer as PrintableDocument["snapshot"]["issuer"],
      cliente: client
        ? {
            nombre: String(client.nombre),
            identificacion:
              typeof client.identificacion_fiscal === "string"
                ? client.identificacion_fiscal
                : null,
          }
        : null,
      vendedor: user.nombre,
      condicionesPago: "",
      condicionesComerciales: "",
      observaciones: c.motivo || c.referencia,
      items: items ?? [
        {
          nombre: c.motivo || "Movimiento de cliente",
          cantidad: 1,
          precioUnitario: total,
          descuento: 0,
          tasa: 0,
          subtotal: total,
          impuesto: 0,
          total,
        },
      ],
      amounts: {
        subtotal: base ?? total,
        descuentoTotal: posMoney(
          (items ?? []).reduce((a, i) => a + i.descuento, 0),
        ),
        impuesto: tax,
        total,
        ingresoNeto: base ?? total,
      },
      documental: {
        schemaVersion: 1,
        clase: "comprobante_interno",
        fiscal: false,
        serie: null,
        autorizacion: null,
        ejemplar: "original",
        pie: internalReceiptLegend,
      },
    },
  };
}
async function readList(
  user: SessionUser,
  c: ReceivableCommand,
): Promise<ReceivableResult> {
  const tx = ctx().tx,
    tenant = user.empresaId;
  const credits = await tx.execute(
    sql`select r.id,r.cliente_id as "clienteId",p.nombre as cliente,r.numero,r.moneda,r.monto::float8,r.saldo::float8,r.tipo,r.fecha::text from cxc_creditos r join clientes p on p.id=r.cliente_id and p.empresa_id=r.empresa_id where r.empresa_id=${tenant}::uuid and r.sucursal_id=${c.sucursalId}::uuid order by r.fecha desc,r.id limit 500`,
  );
  const clients = await tx.execute(
    sql`select id,nombre from clientes where empresa_id=${tenant}::uuid and activo and eliminado_en is null order by nombre,id limit 1000`,
  );
  const methods = await tx.execute(
    sql`select f.id,f.nombre,f.codigo from formas_pago f join cuentas_financieras a on a.id=f.cuenta_financiera_id and a.empresa_id=f.empresa_id where f.empresa_id=${tenant}::uuid and f.activa and a.activa and (a.sucursal_id is null or a.sucursal_id=${c.sucursalId}::uuid) order by f.nombre,f.id`,
  );
  const sessions = await tx.execute(
    sql`select s.id,c.nombre||' · '||s.abierta_en::text as nombre from sesiones_caja s join cajas c on c.id=s.caja_id and c.empresa_id=s.empresa_id where s.empresa_id=${tenant}::uuid and c.sucursal_id=${c.sucursalId}::uuid and s.estado='abierta' order by c.nombre`,
  );
  const liabilities = await tx.execute(
    sql`select id,codigo||' · '||nombre as nombre from catalogo_cuentas where empresa_id=${tenant}::uuid and tipo='pasivo' and activa and es_detalle and permite_movimiento order by codigo`,
  );
  const [config] = await tx.execute(
    sql`select cuenta_pasivo_id from cxc_configuracion where empresa_id=${tenant}::uuid`,
  );
  const cxc = await tx.execute(
    sql`select x.id,x.cliente_id as "clienteId",v.numero,x.saldo::float8 from cuentas_por_cobrar x join ventas v on v.id=x.venta_id and v.empresa_id=x.empresa_id where x.empresa_id=${tenant}::uuid and v.sucursal_id=${c.sucursalId}::uuid and x.saldo>0 order by x.fecha_vencimiento,x.id limit 1000`,
  );
  const receipts = await tx.execute(
    sql`select id,numero,tipo,fecha::text,cliente_id as "clienteId" from cxc_eventos where empresa_id=${tenant}::uuid and sucursal_id=${c.sucursalId}::uuid and tipo in('anticipo','aplicacion','reembolso','cobro') order by creado_en desc,id limit 500`,
  );
  return {
    ok: true,
    credits: [...credits],
    receipts: [...receipts],
    options: {
      clients: [...clients],
      methods: [...methods],
      sessions: [...sessions],
      liabilities: [...liabilities],
      configured: config ? String(config.cuenta_pasivo_id) : null,
      cxc: [...cxc],
    },
  } as ReceivableResult;
}
async function readCustomer(
  user: SessionUser,
  c: ReceivableCommand,
): Promise<ReceivableResult> {
  const client = await customer(user, c.clienteId),
    fecha = await day(user),
    tx = ctx().tx;
  const rows = await tx.execute(sql`with entries as (
 select x.id,'factura'::text tipo,v.numero,x.fecha_emision fecha,x.monto as monto,null::text referencia,v.asiento_id from cuentas_por_cobrar x join ventas v on v.id=x.venta_id and v.empresa_id=x.empresa_id where x.empresa_id=${user.empresaId}::uuid and x.cliente_id=${c.clienteId}::uuid and v.sucursal_id=${c.sucursalId}::uuid
 union all select a.id,'abono',v.numero,a.fecha,-a.monto,a.referencia,a.asiento_id from abonos_cliente a join cuentas_por_cobrar x on x.id=a.cxc_id and x.empresa_id=a.empresa_id join ventas v on v.id=x.venta_id and v.empresa_id=x.empresa_id where a.empresa_id=${user.empresaId}::uuid and x.cliente_id=${c.clienteId}::uuid and v.sucursal_id=${c.sucursalId}::uuid
 union all select e.id,e.tipo,e.numero,e.fecha,-e.monto,e.referencia,e.asiento_id from cxc_eventos e where e.empresa_id=${user.empresaId}::uuid and e.sucursal_id=${c.sucursalId}::uuid and e.cliente_id=${c.clienteId}::uuid and e.tipo in('aplicacion','nota_reduccion')
 ) select id,tipo,numero,fecha::text,monto::float8,referencia,asiento_id as "asientoId" from entries order by fecha,id limit 5001`);
  must(
    rows.length <= 5000,
    "Este estado de cuenta excede 5,000 movimientos; requiere una exportación paginada antes de mostrar totales completos.",
  );
  const aging = await tx.execute(
    sql`select case when x.fecha_vencimiento>=${fecha}::date then 'Por vencer' when ${fecha}::date-x.fecha_vencimiento<=30 then '1–30 días' when ${fecha}::date-x.fecha_vencimiento<=60 then '31–60 días' when ${fecha}::date-x.fecha_vencimiento<=90 then '61–90 días' else 'Más de 90 días' end as bucket,sum(x.saldo)::float8 as amount,count(*)::int as count from cuentas_por_cobrar x join ventas v on v.id=x.venta_id and v.empresa_id=x.empresa_id where x.empresa_id=${user.empresaId}::uuid and x.cliente_id=${c.clienteId}::uuid and v.sucursal_id=${c.sucursalId}::uuid and x.saldo>0 group by 1`,
  );
  const closing = posMoney(aging.reduce((a, r) => a + Number(r.amount), 0)),
    history = posMoney(rows.reduce((a, r) => a + Number(r.monto), 0));
  return {
    ok: true,
    customer: {
      id: String(client.id),
      nombre: String(client.nombre),
      opening: 0,
      closing,
      events: [...rows],
      aging: [...aging],
      unreconciled: posMoney(closing - history),
    },
  } as ReceivableResult;
}
async function sourceSale(user: SessionUser, c: ReceivableCommand) {
  must(c.ventaId, "Selecciona la venta.");
  const tx = ctx().tx;
  const [sale] = await tx.execute(
    sql`select v.*,p.nombre as cliente,f.snapshot from ventas v left join clientes p on p.id=v.cliente_id and p.empresa_id=v.empresa_id left join facturas f on f.venta_id=v.id and f.empresa_id=v.empresa_id where v.id=${c.ventaId}::uuid and v.empresa_id=${user.empresaId}::uuid and v.sucursal_id=${c.sucursalId}::uuid ${c.action === "creditNote" ? sql`for update of v` : sql``}`,
  );
  must(sale, "Venta no disponible en esta sucursal.");
  const lines = await tx.execute(
    sql`select d.*,p.nombre,p.tipo,p.maneja_lotes,p.maneja_series,coalesce((select sum(n.cantidad) from nota_credito_detalle n join notas_credito h on h.id=n.nota_id and h.empresa_id=${user.empresaId}::uuid where n.venta_detalle_id=d.id),0) as devuelta from venta_detalle d join productos p on p.id=d.producto_id and p.empresa_id=${user.empresaId}::uuid where d.venta_id=${sale.id}::uuid order by d.id`,
  );
  const notes = await tx.execute(
    sql`select id,numero,fecha::text,total,tipo,snapshot from notas_credito where empresa_id=${user.empresaId}::uuid and venta_id=${sale.id}::uuid`,
  );
  const movements = await tx.execute(
    sql`select producto_id,almacen_id,sum(cantidad) as cantidad,min(costo_unitario) as costo_min,max(costo_unitario) as costo_max from movimientos_inventario where empresa_id=${user.empresaId}::uuid and referencia_tabla='ventas' and referencia_id=${sale.id}::uuid and tipo='salida_venta' group by producto_id,almacen_id`,
  );
  return { sale, lines, notes, movements };
}
function canReturn(
  line: Record<string, unknown>,
  all: Record<string, unknown>[],
  movements: Record<string, unknown>[],
) {
  const found = movements.filter((m) => m.producto_id === line.producto_id);
  return (
    line.tipo === "simple" &&
    !line.maneja_lotes &&
    !line.maneja_series &&
    !line.lote_id &&
    found.length === 1 &&
    Math.abs(
      -Number(found[0].cantidad) -
        all
          .filter((i) => i.producto_id === line.producto_id)
          .reduce((a, i) => a + Number(i.cantidad), 0),
    ) < 0.0001 &&
    Number(found[0].costo_min) === Number(found[0].costo_max) &&
    Number(found[0].costo_min) === Number(line.costo_unitario)
  );
}
async function readSale(
  user: SessionUser,
  c: ReceivableCommand,
): Promise<ReceivableResult> {
  const { sale, lines, notes, movements } = await sourceSale(user, c),
    snapshot = sale.snapshot as Record<string, unknown> | null,
    metadata = snapshot?.documentContext as { moneda?: string } | undefined;
  return {
    ok: true,
    sale: {
      id: String(sale.id),
      numero: String(sale.numero),
      clienteId: sale.cliente_id ? String(sale.cliente_id) : null,
      cliente: String(sale.cliente ?? "Consumidor final"),
      moneda: metadata?.moneda ?? null,
      total: Number(sale.total),
      credited: posMoney(notes.reduce((a, n) => a + Number(n.total), 0)),
      cancelled: notes.some((n) => n.tipo === "anulacion"),
      notes: notes.map((n) => ({
        id: String(n.id),
        numero: String(n.numero),
        fecha: String(n.fecha),
        tipo: String(n.tipo ?? "historica"),
        total: Number(n.total),
      })),
      lines: lines.map((l) => ({
        id: String(l.id),
        nombre: String(l.nombre),
        cantidad: Number(l.cantidad),
        available: Number(l.cantidad) - Number(l.devuelta),
        precio: Number(l.precio_unitario),
        reingresable: canReturn(l, lines, movements),
      })),
    },
  };
}
async function creditNote(
  user: SessionUser,
  c: ReceivableCommand,
  device: string | null,
): Promise<ReceivableResult> {
  const tx = ctx().tx,
    { sale, lines, notes, movements } = await sourceSale(user, c);
  must(c.motivo.trim(), "Indica el motivo de la nota/anulación.");
  must(c.lines?.length, "Selecciona las líneas.");
  must(
    new Set(c.lines.map((l) => l.lineId)).size === c.lines.length,
    "No repitas la misma línea.",
  );
  must(
    !sale.anulado_en &&
      sale.estado !== "anulada" &&
      !notes.some((n) => n.tipo === "anulacion"),
    "La venta ya fue anulada.",
  );
  must(
    !notes.some((n) => !n.snapshot),
    "Existen notas históricas sin trazabilidad por línea. Requiere conciliación explícita.",
  );
  const snapshot = sale.snapshot as Record<string, unknown> | null,
    metadata = snapshot?.documentContext as { moneda?: string } | undefined;
  must(
    metadata?.moneda,
    "La moneda histórica no está congelada. Requiere revisión; no se asumirá la moneda actual.",
  );
  const issuer = await captureInternalDocument(c.sucursalId);
  must(
    issuer.moneda === metadata.moneda,
    "La moneda operativa cambió; se necesita un flujo de conciliación multimoneda.",
  );
  const lineDiscounts = lines.reduce((a, l) => a + Number(l.descuento), 0),
    global = posMoney(Number(sale.descuento) - lineDiscounts);
  must(global >= 0, "Descuento original inconsistente.");
  const discounts = allocateCents(
      global,
      lines.map((l) => Number(l.subtotal)),
    ),
    originalBases = lines.map((l, i) =>
      posMoney(Number(l.subtotal) - discounts[i]),
    );
  must(
    Math.abs(
      posMoney(
        originalBases.reduce((a, b) => a + b, 0) +
          lines.reduce((a, l) => a + Number(l.impuesto), 0),
      ) - Number(sale.total),
    ) < 0.005,
    "El detalle original no concilia con la venta. No se reconstruirá automáticamente.",
  );
  const selected = c.lines.map((input) => {
    const index = lines.findIndex((l) => l.id === input.lineId);
    must(index >= 0, "Línea ajena a esta venta.");
    const l = lines[index],
      quantity = Number(l.cantidad),
      returned = Number(l.devuelta);
    must(
      input.cantidad <= quantity - returned + 0.0000001,
      "La devolución supera la cantidad disponible.",
    );
    if (input.reingresar)
      must(
        canReturn(l, lines, movements),
        "No existe trazabilidad suficiente para reingresar este producto/costo.",
      );
    const base = remainingPortion(
        originalBases[index],
        quantity,
        returned,
        input.cantidad,
      ),
      tax = remainingPortion(
        Number(l.impuesto),
        quantity,
        returned,
        input.cantidad,
      ),
      cost = input.reingresar
        ? Math.round(input.cantidad * Number(l.costo_unitario) * 10000) / 10000
        : 0;
    return { line: l, input, base, tax, cost, total: posMoney(base + tax) };
  });
  if (c.cancel)
    must(
      lines.every((l) => {
        if (Number(l.cantidad) - Number(l.devuelta) <= 0.0000001) return true;
        const selectedLine = selected.find((i) => i.line.id === l.id);
        return (
          selectedLine &&
          Math.abs(
            selectedLine.input.cantidad -
              (Number(l.cantidad) - Number(l.devuelta)),
          ) < 0.0000001
        );
      }),
      "La anulación requiere todas las cantidades pendientes de acreditar.",
    );
  const amount = posMoney(selected.reduce((a, i) => a + i.total, 0)),
    base = posMoney(selected.reduce((a, i) => a + i.base, 0)),
    tax = posMoney(selected.reduce((a, i) => a + i.tax, 0)),
    cost = Math.round(selected.reduce((a, i) => a + i.cost, 0) * 10000) / 10000;
  must(
    amount > 0 &&
      amount <=
        Number(sale.total) -
          notes.reduce((a, n) => a + Number(n.total), 0) +
          0.0001,
    "El crédito excede el importe original pendiente.",
  );
  const [pending] = await tx.execute(
    sql`select id from transferencias_pendientes where empresa_id=${user.empresaId}::uuid and venta_id=${sale.id}::uuid and status='pending_verification' limit 1`,
  );
  must(
    !pending,
    "Resuelve primero la transferencia pendiente para no acreditar y confirmar el mismo importe.",
  );
  const [x] = await tx.execute(
    sql`select * from cuentas_por_cobrar where empresa_id=${user.empresaId}::uuid and venta_id=${sale.id}::uuid for update`,
  );
  const reduction = posMoney(Math.min(amount, Number(x?.saldo ?? 0))),
    paid = posMoney(amount - reduction),
    client = sale.cliente_id
      ? await customer(user, String(sale.cliente_id))
      : null;
  c = { ...c, clienteId: client ? String(client.id) : undefined };
  const pay = paid > 0 && c.formaPagoId ? await financial(user, c, true) : null;
  let liabilityId: string | undefined;
  if (paid > 0 && !pay) {
    must(
      client,
      "Selecciona un reembolso real para una venta a consumidor final. No se inventará un cliente.",
    );
    liabilityId = await configured(user);
  }
  if (pay)
    must(pay.currency === metadata.moneda, "El reembolso usa otra moneda.");
  const accounts = await resolverCuentasClave(tx, user.empresaId, [
    "DEVOLUCIONES_VENTAS",
    "IVA_DEBITO",
    "CXC_CLIENTES",
    "INVENTARIO",
    "COSTO_VENTAS",
  ]);
  const parts: PartidaAsiento[] = [
    { cuentaId: accounts.DEVOLUCIONES_VENTAS, debe: base, haber: 0 },
  ];
  if (tax) parts.push({ cuentaId: accounts.IVA_DEBITO, debe: tax, haber: 0 });
  if (reduction)
    parts.push({ cuentaId: accounts.CXC_CLIENTES, debe: 0, haber: reduction });
  if (paid)
    parts.push({
      cuentaId: pay?.account ?? liabilityId!,
      debe: 0,
      haber: paid,
    });
  if (cost)
    parts.push(
      { cuentaId: accounts.INVENTARIO, debe: cost, haber: 0 },
      { cuentaId: accounts.COSTO_VENTAS, debe: 0, haber: cost },
    );
  const id = randomUUID(),
    eventId = randomUUID(),
    numero = `NC-${id}`,
    fecha = await day(user),
    posting = await journal(
      user,
      c,
      eventId,
      fecha,
      parts,
      `${c.cancel ? "Anulación" : "Nota de crédito"} ${String(sale.numero)} · ${c.motivo}`,
    );
  const doc = await document(
    user,
    c,
    client,
    numero,
    fecha,
    amount,
    "nota_credito",
    selected.map((i) => ({
      productoId: String(i.line.producto_id),
      nombre: String(i.line.nombre),
      cantidad: i.input.cantidad,
      precioUnitario: Number(i.line.precio_unitario),
      descuento: posMoney(
        i.input.cantidad * Number(i.line.precio_unitario) - i.base,
      ),
      tasa: 0,
      subtotal: i.base,
      impuesto: i.tax,
      total: i.total,
    })),
    base,
    tax,
  );
  doc.id = id;
  doc.origenId = String(sale.id);
  doc.ventaId = String(sale.id);
  doc.snapshot.condicionesComerciales = `Compensa ${String(sale.numero)}. ${reduction.toFixed(2)} reduce deuda; ${paid.toFixed(2)} ${pay ? "reembolsado con confirmación" : "queda como crédito de cliente"}. El documento original permanece intacto.`;
  await tx.execute(
    sql`insert into notas_credito(id,empresa_id,venta_id,numero,fecha,motivo,subtotal,impuesto,total,usuario_id,asiento_id,sucursal_id,snapshot,tipo) values(${id}::uuid,${user.empresaId}::uuid,${sale.id}::uuid,${numero},${fecha}::date,${c.motivo},${base},${tax},${amount},${user.id}::uuid,${posting}::uuid,${c.sucursalId}::uuid,${JSON.stringify(doc)}::jsonb,${c.cancel ? "anulacion" : "credito"})`,
  );
  for (const i of selected) {
    await tx.execute(
      sql`insert into nota_credito_detalle(nota_id,producto_id,cantidad,precio_unitario,subtotal,venta_detalle_id,impuesto,total,costo,reingresada) values(${id}::uuid,${i.line.producto_id}::uuid,${i.input.cantidad},${i.line.precio_unitario},${i.base},${i.line.id}::uuid,${i.tax},${i.total},${i.cost},${i.input.reingresar})`,
    );
    if (i.input.reingresar) {
      const source = movements.find(
        (m) => m.producto_id === i.line.producto_id,
      )!;
      await tx.execute(
        sql`insert into movimientos_inventario(empresa_id,producto_id,almacen_id,tipo,cantidad,costo_unitario,referencia_tabla,referencia_id,usuario_id) values(${user.empresaId}::uuid,${i.line.producto_id}::uuid,${source.almacen_id}::uuid,'devolucion_cliente',${i.input.cantidad},${i.line.costo_unitario},'notas_credito',${id},${user.id}::uuid)`,
      );
      const [exists] = await tx.execute(
        sql`update existencias set cantidad=cantidad+${i.input.cantidad},actualizado_en=now() where empresa_id=${user.empresaId}::uuid and producto_id=${i.line.producto_id}::uuid and almacen_id=${source.almacen_id}::uuid returning id`,
      );
      must(
        exists,
        "La existencia de origen ya no está disponible. Requiere revisión.",
      );
      const [stock] = await tx.execute(
        sql`select coalesce(sum(cantidad),0)::float8 as cantidad from existencias where empresa_id=${user.empresaId}::uuid and producto_id=${i.line.producto_id}::uuid`,
      );
      const after = Number(stock.cantidad);
      must(
        after - i.input.cantidad >= 0,
        "El stock negativo requiere conciliación de costo antes de reingresar.",
      );
      await tx.execute(
        sql`update productos set costo_promedio=round((costo_promedio*${after - i.input.cantidad}+${i.cost})/${after},4),actualizado_en=now() where id=${i.line.producto_id}::uuid and empresa_id=${user.empresaId}::uuid`,
      );
    }
  }
  if (reduction)
    await tx.execute(
      sql`update cuentas_por_cobrar set saldo=saldo-${reduction},estado=case when saldo-${reduction}=0 then 'pagada'::cxc_estado else 'parcial'::cxc_estado end where id=${x.id}::uuid and empresa_id=${user.empresaId}::uuid`,
    );
  let creditId: string | undefined;
  if (paid && !pay) {
    creditId = randomUUID();
    await newCredit(
      user,
      c,
      device,
      creditId,
      id,
      "nota_credito",
      numero,
      fecha,
      paid,
      liabilityId!,
      posting,
      metadata.moneda,
    );
  }
  if (pay?.turn)
    await cashEntry(
      user,
      pay.turn,
      "nota_credito",
      id,
      -paid,
      { ventaId: sale.id, evidence: pay.evidence },
      "devolucion",
    );
  await event(user, c, device, {
    id: eventId,
    type: "nota_credito",
    numero,
    fecha,
    amount,
    journal: posting,
    client: client ? String(client.id) : null,
    credit: creditId,
    note: id,
    snapshot: doc,
    evidence: pay?.evidence,
  });
  if (reduction)
    await tx.execute(
      sql`insert into cxc_eventos(id,empresa_id,sucursal_id,cliente_id,tipo,numero,cxc_id,nota_id,fecha,monto,motivo,usuario_id,device_id,correlation_id,asiento_id,snapshot) values(${randomUUID()}::uuid,${user.empresaId}::uuid,${c.sucursalId}::uuid,${sale.cliente_id}::uuid,'nota_reduccion',${numero},${x.id}::uuid,${id}::uuid,${fecha}::date,${reduction},${c.motivo},${user.id}::uuid,${device}::uuid,${randomUUID()}::uuid,${posting}::uuid,${JSON.stringify(doc)}::jsonb)`,
    );
  const [log] = await tx.execute(
    sql`select to_regclass('desktop_change_log') as present`,
  );
  if (log.present)
    await tx.execute(
      sql`insert into desktop_change_log(empresa_id,entity_type,entity_id) values(${user.empresaId}::uuid,'settings.ajustes_comerciales',${id})`,
    );
  return { ok: true, id, asientoId: posting, documentId: eventId };
}
async function event(
  user: SessionUser,
  c: ReceivableCommand,
  device: string | null,
  data: {
    id: string;
    type: string;
    numero: string;
    fecha: string;
    amount: number;
    journal: string;
    client?: string | null;
    credit?: string;
    cxc?: string;
    note?: string;
    snapshot: PrintableDocument;
    evidence?: unknown;
  },
) {
  if (data.snapshot.kind !== "nota_credito") {
    data.snapshot.id = data.id;
    data.snapshot.origenId = data.id;
  }
  await ctx().tx.execute(
    sql`insert into cxc_eventos(id,empresa_id,sucursal_id,cliente_id,tipo,numero,credito_id,cxc_id,nota_id,fecha,monto,referencia,motivo,usuario_id,device_id,correlation_id,asiento_id,snapshot,datos) values(${data.id}::uuid,${user.empresaId}::uuid,${c.sucursalId}::uuid,${data.client ?? null}::uuid,${data.type},${data.numero},${data.credit ?? null}::uuid,${data.cxc ?? null}::uuid,${data.note ?? null}::uuid,${data.fecha}::date,${data.amount},${c.referencia || null},${c.motivo},${user.id}::uuid,${device}::uuid,${c.requestId}::uuid,${data.journal}::uuid,${JSON.stringify(data.snapshot)}::jsonb,${JSON.stringify(data.evidence ?? {})}::jsonb)`,
  );
  await ctx().tx.execute(
    sql`insert into auditoria(empresa_id,usuario_id,accion,tabla,registro_id,datos_despues) values(${user.empresaId}::uuid,${user.id}::uuid,${"cxc." + data.type},'cxc_eventos',${data.id},${JSON.stringify({ sucursalId: c.sucursalId, device, correlationId: c.requestId, asientoId: data.journal, monto: data.amount, referencia: c.referencia })}::jsonb)`,
  );
}
async function newCredit(
  user: SessionUser,
  c: ReceivableCommand,
  device: string | null,
  id: string,
  origin: string,
  type: string,
  numero: string,
  fecha: string,
  monto: number,
  account: string,
  asientoId: string,
  currency: string,
) {
  must(c.clienteId, "El crédito pendiente requiere un cliente identificado.");
  await ctx().tx.execute(
    sql`insert into cxc_creditos(id,empresa_id,sucursal_id,cliente_id,tipo,origen_id,numero,moneda,monto,saldo,cuenta_pasivo_id,fecha,usuario_id,device_id,asiento_id) values(${id}::uuid,${user.empresaId}::uuid,${c.sucursalId}::uuid,${c.clienteId}::uuid,${type},${origin}::uuid,${numero},${currency},${monto},${monto},${account}::uuid,${fecha}::date,${user.id}::uuid,${device}::uuid,${asientoId}::uuid)`,
  );
}
async function execute(
  user: SessionUser,
  c: ReceivableCommand,
  device: string | null,
): Promise<ReceivableResult> {
  const tx = ctx().tx;
  if (c.action === "configure") {
    const account = await liability(user, c.cuentaPasivoId);
    await tx.execute(
      sql`insert into cxc_configuracion(empresa_id,cuenta_pasivo_id,usuario_id) values(${user.empresaId}::uuid,${account}::uuid,${user.id}::uuid) on conflict(empresa_id) do update set cuenta_pasivo_id=excluded.cuenta_pasivo_id,usuario_id=excluded.usuario_id,actualizado_en=now()`,
    );
    await tx.execute(
      sql`insert into auditoria(empresa_id,usuario_id,accion,tabla,registro_id,datos_despues) values(${user.empresaId}::uuid,${user.id}::uuid,'cxc.configurar','cxc_configuracion',${user.empresaId},${JSON.stringify({ account, device, correlationId: c.requestId })}::jsonb)`,
    );
    return { ok: true };
  }
  if (c.action === "list") return readList(user, c);
  if (c.action === "customer") return readCustomer(user, c);
  if (c.action === "sale") return readSale(user, c);
  if (c.action === "creditNote") return creditNote(user, c, device);
  const client = await customer(user, c.clienteId),
    fecha = await day(user),
    id = randomUUID(),
    number = `RC-${id}`,
    monto = c.monto;
  must(monto, "Indica el importe.");
  const parts: PartidaAsiento[] = [];
  let creditId: string | undefined,
    cxcId: string | undefined,
    payment: Awaited<ReturnType<typeof financial>> | undefined;
  if (c.action === "advance") {
    const account = await configured(user);
    payment = await financial(user, c);
    const issuer = await captureInternalDocument(c.sucursalId);
    must(
      payment.currency === issuer.moneda,
      "La cuenta financiera usa otra moneda.",
    );
    parts.push(
      { cuentaId: payment.account, debe: monto, haber: 0 },
      { cuentaId: account, debe: 0, haber: monto },
    );
    const posting = await journal(
      user,
      c,
      id,
      fecha,
      parts,
      "Anticipo de cliente " + number,
    );
    creditId = randomUUID();
    await newCredit(
      user,
      c,
      device,
      creditId,
      id,
      "anticipo",
      number,
      fecha,
      monto,
      account,
      posting,
      payment.currency,
    );
    if (payment.turn)
      await cashEntry(user, payment.turn, "anticipo_cliente", id, monto, {
        evidence: payment.evidence,
      });
    const snapshot = await document(
      user,
      c,
      client,
      number,
      fecha,
      monto,
      "recibo_pago",
    );
    await event(user, c, device, {
      id,
      type: "anticipo",
      numero: number,
      fecha,
      amount: monto,
      journal: posting,
      client: String(client.id),
      credit: creditId,
      snapshot,
      evidence: payment.evidence,
    });
    return { ok: true, id: creditId, asientoId: posting, documentId: id };
  }
  must(
    c.action === "apply" || c.action === "refund" || c.action === "collect",
    "Acción financiera no disponible.",
  );
  if (c.action === "collect") {
    // Existing collection engine remains authoritative; stable command wraps its transaction.
    const x = await receivable(user, c);
    must(x.cliente_id === client.id, "El cliente no corresponde al saldo.");
    must(monto <= Number(x.saldo), "El cobro supera el saldo.");
    const [source] = await tx.execute(
      sql`select snapshot->'documentContext'->>'moneda' as moneda from facturas where empresa_id=${user.empresaId}::uuid and venta_id=${x.venta_id}::uuid`,
    );
    const originalCurrency = source?.moneda;
    must(
      originalCurrency,
      "El comprobante histórico no acredita su moneda. Usa el flujo de revisión existente.",
    );
    payment = await financial(user, c);
    must(
      manualPaymentKind(
        String(
          (
            await tx.execute(
              sql`select codigo from formas_pago where id=${c.formaPagoId}::uuid`,
            )
          )[0].codigo,
        ),
      ) === "cash",
      "Usa el cobro existente para otros métodos; esta ruta confirma efectivo con turno explícito.",
    );
    must(
      payment.currency === originalCurrency &&
        (await captureInternalDocument(c.sucursalId)).moneda ===
          originalCurrency,
      "El cobro utiliza otra moneda; requiere conciliación.",
    );
    const { registrarAbono } = await import("./actions/cxc");
    const result = await registrarAbono({
      cxcId: c.cxcId,
      formaPagoId: c.formaPagoId,
      monto,
      fecha,
      sesionCajaId: c.sesionCajaId,
      referencia: c.referencia,
      notas: c.motivo,
    });
    must(result.ok, result.ok ? "" : result.error);
    const [posted] = await tx.execute(
      sql`select asiento_id from abonos_cliente where id=${result.abonoId}::uuid and empresa_id=${user.empresaId}::uuid`,
    );
    must(posted?.asiento_id, "El cobro no confirmó su asiento.");
    const snapshot = await document(
      user,
      c,
      client,
      number,
      fecha,
      monto,
      "recibo_pago",
    );
    await event(user, c, device, {
      id,
      type: "cobro",
      numero: number,
      fecha,
      amount: monto,
      journal: String(posted.asiento_id),
      client: String(client.id),
      cxc: c.cxcId,
      snapshot,
      evidence: payment.evidence,
    });
    return {
      ok: true,
      id: result.abonoId,
      asientoId: String(posted.asiento_id),
      documentId: id,
    };
  }
  must(c.id, "Selecciona el anticipo/crédito.");
  const [credit] = await tx.execute(
    sql`select * from cxc_creditos where id=${c.id}::uuid and empresa_id=${user.empresaId}::uuid and sucursal_id=${c.sucursalId}::uuid for update`,
  );
  must(
    credit && credit.cliente_id === client.id,
    "Crédito no autorizado para este cliente y sucursal.",
  );
  must(
    monto <= Number(credit.saldo),
    "El importe supera el crédito disponible.",
  );
  const creditAccount = await liability(user, String(credit.cuenta_pasivo_id));
  creditId = String(credit.id);
  must(
    (await captureInternalDocument(c.sucursalId)).moneda === credit.moneda,
    "La moneda operativa cambió; requiere conciliación multimoneda.",
  );
  if (c.action === "apply") {
    const x = await receivable(user, c);
    must(x.cliente_id === client.id, "El cliente no coincide.");
    must(monto <= Number(x.saldo), "La aplicación supera la deuda.");
    const [invoice] = await tx.execute(
      sql`select snapshot->'documentContext'->>'moneda' as moneda from facturas where empresa_id=${user.empresaId}::uuid and venta_id=${x.venta_id}::uuid`,
    );
    must(
      invoice?.moneda === credit.moneda,
      "La factura no acredita la misma moneda; requiere revisión.",
    );
    const accounts = await resolverCuentasClave(tx, user.empresaId, [
      "CXC_CLIENTES",
    ]);
    parts.push(
      { cuentaId: creditAccount, debe: monto, haber: 0 },
      { cuentaId: accounts.CXC_CLIENTES, debe: 0, haber: monto },
    );
    cxcId = String(x.id);
    await tx.execute(
      sql`update cuentas_por_cobrar set saldo=saldo-${monto},estado=case when saldo-${monto}=0 then 'pagada'::cxc_estado else 'parcial'::cxc_estado end where id=${cxcId}::uuid and empresa_id=${user.empresaId}::uuid`,
    );
  } else {
    payment = await financial(user, c, true);
    must(payment.currency === credit.moneda, "El reembolso usa otra moneda.");
    parts.push(
      { cuentaId: creditAccount, debe: monto, haber: 0 },
      { cuentaId: payment.account, debe: 0, haber: monto },
    );
  }
  const posting = await journal(
    user,
    c,
    id,
    fecha,
    parts,
    c.action === "apply"
      ? "Aplicación de crédito de cliente"
      : "Reembolso confirmado de cliente",
  );
  await tx.execute(
    sql`update cxc_creditos set saldo=saldo-${monto} where id=${creditId}::uuid and empresa_id=${user.empresaId}::uuid`,
  );
  if (payment?.turn)
    await cashEntry(
      user,
      payment.turn,
      "reembolso_cliente",
      id,
      -monto,
      { creditoId: creditId, evidence: payment.evidence },
      "devolucion",
    );
  const snapshot = await document(
    user,
    c,
    client,
    number,
    fecha,
    monto,
    "recibo_pago",
  );
  await event(user, c, device, {
    id,
    type: c.action === "apply" ? "aplicacion" : "reembolso",
    numero: number,
    fecha,
    amount: monto,
    journal: posting,
    client: String(client.id),
    credit: creditId,
    cxc: cxcId,
    snapshot,
    evidence: payment?.evidence,
  });
  return { ok: true, id, asientoId: posting, documentId: id };
}

/** Sources are server-owned, company/branch scoped, and copied into immutable document emissions. */
export async function receivableDocumentSource(
  user: SessionUser,
  kind: string,
  id: string,
  branch: string,
): Promise<PrintableDocument> {
  const tx = ctx().tx;
  if (kind === "nota_credito" || kind === "recibo") {
    const rows =
      kind === "nota_credito"
        ? await tx.execute(
            sql`select snapshot from notas_credito where id=${id}::uuid and empresa_id=${user.empresaId}::uuid and sucursal_id=${branch}::uuid`,
          )
        : await tx.execute(
            sql`select snapshot from cxc_eventos where id=${id}::uuid and empresa_id=${user.empresaId}::uuid and sucursal_id=${branch}::uuid`,
          );
    must(
      rows[0]?.snapshot,
      "Documento sin snapshot congelado o fuera de esta sucursal.",
    );
    return rows[0].snapshot as PrintableDocument;
  }
  must(kind === "estado_cuenta", "Tipo de documento no soportado.");
  const c = receivableCommandSchema.parse({
      action: "customer",
      requestId: randomUUID(),
      sucursalId: branch,
      clienteId: id,
    }),
    result = await readCustomer(user, c);
  must(result.ok && result.customer, "Estado de cuenta no encontrado.");
  const data = result.customer;
  const client = await customer(user, id),
    fecha = await day(user),
    pdf = await document(
      user,
      c,
      client,
      `EC-${id}-${fecha}`,
      fecha,
      data.closing,
      "estado_cuenta",
      data.events.map((e) => ({
        nombre: `${e.fecha} · ${e.tipo} · ${e.numero}`,
        cantidad: 1,
        precioUnitario: e.monto,
        descuento: 0,
        tasa: 0,
        subtotal: e.monto,
        impuesto: 0,
        total: e.monto,
      })),
    );
  pdf.id = id;
  pdf.origenId = id;
  pdf.estado = createHash("sha256").update(JSON.stringify(data)).digest("hex");
  pdf.snapshot.condicionesComerciales = `Saldo actual por cobrar: ${data.closing.toFixed(2)}. Antigüedad: ${data.aging.map((a) => `${a.bucket}: ${a.amount.toFixed(2)}`).join("; ")}. Diferencia entre historial y saldo: ${data.unreconciled.toFixed(2)}${data.unreconciled ? " — requiere conciliación; no se reparó ningún registro." : ""}`;
  return pdf;
}
