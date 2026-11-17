import { sql } from "drizzle-orm";
import { dbConEmpresa } from "./db";
import { currentBusinessContext, businessEventDate } from "./business-context";
import type { SessionUser } from "./actions/session-helpers";
import { cajaMovimientos, cajaRevisiones } from "./db/schema";
import { randomUUID } from "node:crypto";
import { dinero } from "./contabilidad/helpers";

export class CashSessionError extends Error {}

export type CashSession = { id:string; caja_id:string; sucursal_id:string; estado:string;
  monto_inicial:string; monto_final_esperado:string|null; monto_final_real:string|null;
  diferencia:string|null; abierta_en:Date; cerrada_en:Date|null; notas:string|null };

export async function cashSession(user: SessionUser, id: string): Promise<CashSession> {
  const [row] = await dbConEmpresa(user.empresaId, tx => tx.execute(sql`
    SELECT s.*,c.sucursal_id FROM sesiones_caja s JOIN cajas c ON c.id=s.caja_id AND c.empresa_id=s.empresa_id
    JOIN sucursales b ON b.id=c.sucursal_id AND b.empresa_id=c.empresa_id
    WHERE s.id=${id}::uuid AND s.empresa_id=${user.empresaId}::uuid
      AND (NOT EXISTS(SELECT 1 FROM usuario_sucursales u JOIN sucursales b ON b.id=u.sucursal_id
            WHERE u.usuario_id=${user.id}::uuid AND b.empresa_id=s.empresa_id)
        OR EXISTS(SELECT 1 FROM usuario_sucursales u WHERE u.usuario_id=${user.id}::uuid AND u.sucursal_id=c.sucursal_id))
    FOR UPDATE OF s
  `));
  if (!row) throw new CashSessionError("Turno no disponible para esta empresa, sucursal o usuario.");
  const context = currentBusinessContext();
  if (context?.sucursalIds && !context.sucursalIds.includes(String(row.sucursal_id))) throw new CashSessionError("Sucursal no autorizada.");
  return row as unknown as CashSession;
}

export async function saleCashSession(user: SessionUser, branch: string, requested?: string): Promise<CashSession> {
  const context = currentBusinessContext();
  const desktop = context?.identity?.type === "venta";
  let id = requested;
  if (!id) {
    // Legacy Desktop operations must resolve against their original timestamp, never today's open shift.
    const event = businessEventDate().toISOString();
    const rows = await dbConEmpresa(user.empresaId, tx => tx.execute(sql`
      SELECT s.id FROM sesiones_caja s JOIN cajas c ON c.id=s.caja_id AND c.empresa_id=s.empresa_id
      WHERE s.empresa_id=${user.empresaId}::uuid AND c.sucursal_id=${branch}::uuid
        AND ${desktop ? sql`s.abierta_en<=${event}::timestamptz AND (s.cerrada_en IS NULL OR s.cerrada_en>=${event}::timestamptz)` : sql`s.estado='abierta'`}
    `));
    if (rows.length !== 1) throw new CashSessionError("Selecciona el turno original de caja. La operación se conserva para revisión.");
    id = String(rows[0].id);
  }
  const session = await cashSession(user,id);
  if (session.sucursal_id !== branch) throw new CashSessionError("El turno no corresponde a la sucursal.");
  if (!desktop && session.estado !== "abierta") throw new CashSessionError("El turno ya fue cerrado.");
  if (desktop && !context?.eventDate) throw new CashSessionError("La operación offline necesita su fecha original.");
  if (desktop && businessEventDate() < new Date(session.abierta_en)) throw new CashSessionError("La venta es anterior a la apertura del turno.");
  return session;
}

export async function cashEntry(user: SessionUser, session: CashSession, sourceType: string,
  sourceId: string, amount: number, detail: Record<string,unknown> = {}, kind = sourceType) {
  const context=currentBusinessContext();
  if(context?.identity?.type==="caja_movimiento" && businessEventDate()<new Date(session.abierta_en))throw new CashSessionError("La operación es anterior a la apertura del turno.");
  return dbConEmpresa(user.empresaId, async tx => {
    const [entry]=await tx.insert(cajaMovimientos).values({
      id: businessCashEntryId(sourceType) ?? randomUUID(),
      empresaId:user.empresaId,sucursalId:session.sucursal_id,sesionId:session.id,
      tipo:kind,origenTipo:sourceType,origenId:sourceId,monto:dinero(amount).toFixed(4),
      usuarioId:user.id,deviceId:context?.deviceId,ocurridoEn:businessEventDate(),detalle:detail,
    }).returning();
    if (session.estado==="cerrada") await tx.insert(cajaRevisiones).values({
      empresaId:user.empresaId,sucursalId:session.sucursal_id,sesionId:session.id,movimientoId:entry.id,
      motivo:kind==="cierre_reintento" ? "Conteo alternativo después del cierre." : "Operación recibida después del cierre.",
    });
    return entry;
  });
}
function businessCashEntryId(type:string) {
  return currentBusinessContext()?.localIds?.[`cash:${type}`]?.[0];
}

export async function cashTotals(user: SessionUser, session: CashSession) {
  const [totals]=await dbConEmpresa(user.empresaId,tx=>tx.execute(sql`
    SELECT
      coalesce((SELECT sum(p.monto) FROM pagos_venta p JOIN ventas v ON v.id=p.venta_id
        JOIN formas_pago f ON f.id=p.forma_pago_id AND f.empresa_id=v.empresa_id
        WHERE v.empresa_id=${user.empresaId}::uuid AND v.sesion_caja_id=${session.id}::uuid
          AND v.anulado_en IS NULL AND v.estado!='anulada'
          AND (p.payment_source='cash' OR (p.payment_source='legacy' AND upper(f.codigo) IN ('EFE','EFECTIVO')))
          AND NOT EXISTS(SELECT 1 FROM caja_movimientos m WHERE m.empresa_id=v.empresa_id AND m.origen_tipo='venta' AND m.origen_id=v.id)),0)
      +coalesce((SELECT sum(m.monto) FROM caja_movimientos m WHERE m.empresa_id=${user.empresaId}::uuid
        AND m.sesion_id=${session.id}::uuid),0) AS efectivo,
      (SELECT count(*)::int FROM caja_revisiones WHERE empresa_id=${user.empresaId}::uuid
        AND sesion_id=${session.id}::uuid AND resuelta_en IS NULL) AS pendientes
  `));
  return { efectivo:dinero(Number(totals.efectivo)),esperado:dinero(Number(session.monto_inicial)+Number(totals.efectivo)),pendientes:Number(totals.pendientes) };
}
