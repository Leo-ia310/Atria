import { notFound } from "next/navigation";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  cuentasPorCobrar, clientes, ventas, abonosCliente, formasPago } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AbonoForm } from "@/components/cxc/AbonoForm";
import { formatearMoneda, formatearFecha } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

export default async function CxCDetallePage({
  params,
}: {
  params: Promise<{ cxcId: string }>;
}) {
  const [{ cxcId }, user] = await Promise.all([params, requireSession()]);

  const cxcPromise = db
    .select({
      id: cuentasPorCobrar.id,
      clienteId: cuentasPorCobrar.clienteId,
      clienteNombre: clientes.nombre,
      clienteTelefono: clientes.telefono,
      ventaNumero: ventas.numero,
      ventaFecha: ventas.fecha,
      fechaEmision: cuentasPorCobrar.fechaEmision,
      fechaVencimiento: cuentasPorCobrar.fechaVencimiento,
      monto: cuentasPorCobrar.monto,
      saldo: cuentasPorCobrar.saldo,
      estado: cuentasPorCobrar.estado,
      notas: cuentasPorCobrar.notas,
    })
    .from(cuentasPorCobrar)
    .innerJoin(clientes, eq(clientes.id, cuentasPorCobrar.clienteId))
    .leftJoin(ventas, eq(ventas.id, cuentasPorCobrar.ventaId))
    .where(
      and(
        eq(cuentasPorCobrar.id, cxcId),
        eq(cuentasPorCobrar.empresaId, user.empresaId),
      ),
    )
    .limit(1);

  const abonosPromise = db
    .select({
      id: abonosCliente.id,
      fecha: abonosCliente.fecha,
      monto: abonosCliente.monto,
      referencia: abonosCliente.referencia,
      notas: abonosCliente.notas,
      formaPago: formasPago.nombre,
    })
    .from(abonosCliente)
    .innerJoin(formasPago, eq(formasPago.id, abonosCliente.formaPagoId))
    .where(and(eq(abonosCliente.cxcId, cxcId), eq(abonosCliente.empresaId, user.empresaId)))
    .orderBy(desc(abonosCliente.fecha));

  const formasPagoPromise = db
    .select({ id: formasPago.id, nombre: formasPago.nombre })
    .from(formasPago)
    .where(and(eq(formasPago.empresaId, user.empresaId), eq(formasPago.activa, true)));

  const [empresa, cxcRows, abonos, formasPagoList] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    cxcPromise,
    abonosPromise,
    formasPagoPromise,
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const cxc = cxcRows[0];

  if (!cxc) notFound();

  const hoy = new Date().toISOString().slice(0, 10);
  const estaVencida = cxc.estado !== "pagada" && cxc.fechaVencimiento < hoy;
  const montoOriginal = parseFloat(cxc.monto);
  const saldoPendiente = parseFloat(cxc.saldo);
  const pagado = montoOriginal - saldoPendiente;
  const pctPagado = montoOriginal > 0 ? (pagado / montoOriginal) * 100 : 0;

  function estadoBadge() {
    if (estaVencida) return <Badge variant="error">Vencida</Badge>;
    if (cxc.estado === "pagada") return <Badge variant="success">Pagada</Badge>;
    if (cxc.estado === "parcial") return <Badge variant="warning">Parcial</Badge>;
    return <Badge variant="neutral">Pendiente</Badge>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title={cxc.clienteNombre}
        subtitle={
          cxc.ventaNumero
            ? `Venta ${cxc.ventaNumero}`
            : `Vencimiento ${formatearFecha(cxc.fechaVencimiento, pais)}`
        }
        actions={
          <div className="flex items-center gap-2">
            {estadoBadge()}
            <Link
              href="/cxc"
              className="atria-btn atria-btn-secondary atria-btn-sm"
            >
              ← Volver
            </Link>
          </div>
        }
      />

      <Card>
        <CardHeader title="Resumen de la deuda" />
        <CardBody>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Dato label="Emisión" valor={formatearFecha(cxc.fechaEmision, pais)} />
            <Dato
              label="Vencimiento"
              valor={formatearFecha(cxc.fechaVencimiento, pais)}
              className={estaVencida ? "text-[color:var(--color-error)] font-semibold" : ""}
            />
            <Dato label="Monto original" valor={formatearMoneda(montoOriginal, pais)} />
            <Dato
              label="Saldo pendiente"
              valor={formatearMoneda(saldoPendiente, pais)}
              className={saldoPendiente > 0 ? "font-bold text-[color:var(--color-warning)]" : "text-[color:var(--color-success)]"}
            />
          </div>

          {montoOriginal > 0 && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-[12px] text-[color:var(--color-text-muted)]">
                <span>Progreso de pago</span>
                <span>{pctPagado.toFixed(0)}% pagado</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-2)]">
                <div
                  className="h-full rounded-full bg-[color:var(--color-success)] transition-all"
                  style={{ width: `${Math.min(pctPagado, 100)}%` }}
                />
              </div>
            </div>
          )}

          {cxc.clienteTelefono && (
            <p className="mt-3 text-small text-[color:var(--color-text-muted)]">
              Tel: {cxc.clienteTelefono}
            </p>
          )}
        </CardBody>
      </Card>

      {abonos.length > 0 && (
        <Card>
          <CardHeader title="Historial de abonos" />
          <div className="divide-y divide-[color:var(--color-border)]">
            {abonos.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-small font-medium">
                    {a.formaPago}
                    {a.referencia && (
                      <span className="ml-2 text-[color:var(--color-text-muted)]">
                        · {a.referencia}
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-[color:var(--color-text-muted)]">
                    {formatearFecha(a.fecha, pais)}
                    {a.notas && ` · ${a.notas}`}
                  </div>
                </div>
                <span className="font-semibold text-[color:var(--color-success)]">
                  +{formatearMoneda(parseFloat(a.monto), pais)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {cxc.estado !== "pagada" && (
        <AbonoForm
          cxcId={cxcId}
          saldoPendiente={saldoPendiente}
          pais={pais}
          formasPago={formasPagoList.map((f) => ({ value: f.id, label: f.nombre }))}
        />
      )}

      {cxc.estado === "pagada" && (
        <div className="rounded-md border border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/10 p-4 text-center text-small text-[color:var(--color-success)]">
          Deuda saldada completamente. Sin balance pendiente.
        </div>
      )}
    </div>
  );
}

function Dato({
  label,
  valor,
  className,
}: {
  label: string;
  valor: string;
  className?: string;
}) {
  return (
    <div>
      <div className="text-label mb-0.5">{label}</div>
      <div className={`text-small font-medium ${className ?? ""}`}>{valor}</div>
    </div>
  );
}
