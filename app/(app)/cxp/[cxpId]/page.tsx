import { notFound } from "next/navigation";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  cuentasPorPagar, proveedores, compras, pagosProveedor, cuentasFinancieras } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PagoForm } from "@/components/cxp/PagoForm";
import { formatearMoneda, formatearFecha } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

export default async function CxPDetallePage({
  params,
}: {
  params: Promise<{ cxpId: string }>;
}) {
  const [{ cxpId }, user] = await Promise.all([params, requireSession()]);

  const cxpPromise = db
    .select({
      id: cuentasPorPagar.id,
      proveedorId: cuentasPorPagar.proveedorId,
      proveedorNombre: proveedores.razonSocial,
      proveedorTelefono: proveedores.telefono,
      compraNumero: compras.numeroFactura,
      compraFecha: compras.fecha,
      fechaEmision: cuentasPorPagar.fechaEmision,
      fechaVencimiento: cuentasPorPagar.fechaVencimiento,
      monto: cuentasPorPagar.monto,
      saldo: cuentasPorPagar.saldo,
      estado: cuentasPorPagar.estado,
      notas: cuentasPorPagar.notas,
    })
    .from(cuentasPorPagar)
    .innerJoin(proveedores, eq(proveedores.id, cuentasPorPagar.proveedorId))
    .leftJoin(compras, eq(compras.id, cuentasPorPagar.compraId))
    .where(
      and(
        eq(cuentasPorPagar.id, cxpId),
        eq(cuentasPorPagar.empresaId, user.empresaId),
      ),
    )
    .limit(1);

  const pagosPromise = db
    .select({
      id: pagosProveedor.id,
      fecha: pagosProveedor.fecha,
      monto: pagosProveedor.monto,
      referencia: pagosProveedor.referencia,
      notas: pagosProveedor.notas,
      cuentaNombre: cuentasFinancieras.nombre,
    })
    .from(pagosProveedor)
    .leftJoin(cuentasFinancieras, eq(cuentasFinancieras.id, pagosProveedor.cuentaFinancieraId))
    .where(and(eq(pagosProveedor.cxpId, cxpId), eq(pagosProveedor.empresaId, user.empresaId)))
    .orderBy(desc(pagosProveedor.fecha));

  const cuentasPromise = db
    .select({ id: cuentasFinancieras.id, nombre: cuentasFinancieras.nombre, tipo: cuentasFinancieras.tipo })
    .from(cuentasFinancieras)
    .where(and(eq(cuentasFinancieras.empresaId, user.empresaId), eq(cuentasFinancieras.activa, true)));

  const [empresa, cxpRows, pagos, cuentasList] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    cxpPromise,
    pagosPromise,
    cuentasPromise,
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const cxp = cxpRows[0];

  if (!cxp) notFound();

  const hoy = new Date().toISOString().slice(0, 10);
  const estaVencida = cxp.estado !== "pagada" && cxp.fechaVencimiento < hoy;
  const montoOriginal = parseFloat(cxp.monto);
  const saldoPendiente = parseFloat(cxp.saldo);
  const pagado = montoOriginal - saldoPendiente;
  const pctPagado = montoOriginal > 0 ? (pagado / montoOriginal) * 100 : 0;

  function estadoBadge() {
    if (estaVencida) return <Badge variant="error">Vencida</Badge>;
    if (cxp.estado === "pagada") return <Badge variant="success">Pagada</Badge>;
    if (cxp.estado === "parcial") return <Badge variant="warning">Parcial</Badge>;
    return <Badge variant="neutral">Pendiente</Badge>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title={cxp.proveedorNombre}
        subtitle={
          cxp.compraNumero
            ? `Factura ${cxp.compraNumero}`
            : `Vencimiento ${formatearFecha(cxp.fechaVencimiento, pais)}`
        }
        actions={
          <div className="flex items-center gap-2">
            {estadoBadge()}
            <Link href="/cxp" className="atria-btn atria-btn-secondary atria-btn-sm">
              ← Volver
            </Link>
          </div>
        }
      />

      <Card>
        <CardHeader title="Resumen de la deuda" />
        <CardBody>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Dato label="Emisión" valor={formatearFecha(cxp.fechaEmision, pais)} />
            <Dato
              label="Vencimiento"
              valor={formatearFecha(cxp.fechaVencimiento, pais)}
              className={estaVencida ? "text-[color:var(--color-error)] font-semibold" : ""}
            />
            <Dato label="Monto original" valor={formatearMoneda(montoOriginal, pais)} />
            <Dato
              label="Saldo pendiente"
              valor={formatearMoneda(saldoPendiente, pais)}
              className={
                saldoPendiente > 0
                  ? "font-bold text-[color:var(--color-warning)]"
                  : "text-[color:var(--color-success)]"
              }
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

          {cxp.proveedorTelefono && (
            <p className="mt-3 text-small text-[color:var(--color-text-muted)]">
              Tel: {cxp.proveedorTelefono}
            </p>
          )}
        </CardBody>
      </Card>

      {pagos.length > 0 && (
        <Card>
          <CardHeader title="Historial de pagos" />
          <div className="divide-y divide-[color:var(--color-border)]">
            {pagos.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-small font-medium">
                    {p.cuentaNombre ?? "Cuenta desconocida"}
                    {p.referencia && (
                      <span className="ml-2 text-[color:var(--color-text-muted)]">
                        · {p.referencia}
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-[color:var(--color-text-muted)]">
                    {formatearFecha(p.fecha, pais)}
                    {p.notas && ` · ${p.notas}`}
                  </div>
                </div>
                <span className="font-semibold text-[color:var(--color-error)]">
                  -{formatearMoneda(parseFloat(p.monto), pais)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {cxp.estado !== "pagada" && (
        <PagoForm
          cxpId={cxpId}
          saldoPendiente={saldoPendiente}
          pais={pais}
          cuentasFinancieras={cuentasList.map((c) => ({
            value: c.id,
            label: `${c.nombre} (${c.tipo})`,
          }))}
        />
      )}

      {cxp.estado === "pagada" && (
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
