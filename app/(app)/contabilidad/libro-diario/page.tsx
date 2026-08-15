import Link from "next/link";
import { BookOpen } from "lucide-react";
import { and, desc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  asientosContables, asientoPartidas, catalogoCuentas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatearMoneda, formatearFecha } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { BotonExportarExcel } from "@/components/ui/BotonExportarExcel";

export default async function LibroDiarioPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const params = await searchParams;
  const user = await requireSession();

  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const sucursalIds = selectedSucursalIds(scope);

  const filtros: SQL[] = [eq(asientosContables.empresaId, user.empresaId)];
  if (params.desde) filtros.push(gte(asientosContables.fecha, params.desde));
  if (params.hasta) filtros.push(lte(asientosContables.fecha, params.hasta));
  if (sucursalIds) filtros.push(inArray(asientosContables.sucursalId, sucursalIds));

  const asientos = await db
    .select({
      id: asientosContables.id,
      numero: asientosContables.numero,
      fecha: asientosContables.fecha,
      concepto: asientosContables.concepto,
      origen: asientosContables.origen,
      referenciaTabla: asientosContables.referenciaTabla,
      referenciaId: asientosContables.referenciaId,
      totalDebe: asientosContables.totalDebe,
      estado: asientosContables.estado,
    })
    .from(asientosContables)
    .where(and(...filtros))
    .orderBy(desc(asientosContables.fecha), desc(asientosContables.numero))
    .limit(200);

  const filtroActivo = Boolean(params.desde || params.hasta);

  const filterBar = (
    <form method="GET" className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-0.5">
        <span className="text-label">Desde</span>
        <input
          type="date"
          name="desde"
          defaultValue={params.desde ?? ""}
          className="arca-input py-1.5 text-small"
        />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-label">Hasta</span>
        <input
          type="date"
          name="hasta"
          defaultValue={params.hasta ?? ""}
          className="arca-input py-1.5 text-small"
        />
      </label>
      <button type="submit" className="arca-btn arca-btn-secondary arca-btn-sm">
        Filtrar
      </button>
      {filtroActivo && (
        <Link href="/contabilidad/libro-diario" className="arca-btn arca-btn-ghost arca-btn-sm">
          Limpiar
        </Link>
      )}
    </form>
  );

  const header = (
    <PageHeader
      title="Libro Diario"
      subtitle={`${asientos.length} asiento(s)${filtroActivo ? " (filtrado)" : ""}${scope.visible ? ` - ${scope.etiqueta}` : ""}`}
      actions={
        <div className="flex flex-wrap items-end gap-3">
          {filterBar}
          <BotonExportarExcel
            recurso="libro-diario"
            params={{ desde: params.desde, hasta: params.hasta }}
          />
          <Link
            href="/contabilidad/libro-mayor"
            className="arca-btn arca-btn-secondary arca-btn-sm"
          >
            Libro mayor →
          </Link>
        </div>
      }
    />
  );

  if (asientos.length === 0) {
    return (
      <div>
        {header}
        <Card>
          <EmptyState
            icon={BookOpen}
            titulo="Sin asientos en este rango"
            descripcion={
              filtroActivo
                ? "Prueba otro rango de fechas o limpia el filtro."
                : "Cada venta, compra o gasto genera asientos automáticamente. Empieza haciendo una operación."
            }
          />
        </Card>
      </div>
    );
  }

  // Single query for all partidas of the loaded asientos — no duplicates, no cross-tenant leakage
  const ids = asientos.map((a) => a.id);
  const todasLasPartidas = await db
    .select({
      asientoId: asientoPartidas.asientoId,
      codigo: catalogoCuentas.codigo,
      cuenta: catalogoCuentas.nombre,
      descripcion: asientoPartidas.descripcion,
      debe: asientoPartidas.debe,
      haber: asientoPartidas.haber,
      orden: asientoPartidas.orden,
    })
    .from(asientoPartidas)
    .innerJoin(catalogoCuentas, eq(catalogoCuentas.id, asientoPartidas.cuentaId))
    .where(inArray(asientoPartidas.asientoId, ids));

  const partidasPorAsiento = new Map<string, typeof todasLasPartidas>();
  for (const p of todasLasPartidas) {
    const arr = partidasPorAsiento.get(p.asientoId) ?? [];
    arr.push(p);
    partidasPorAsiento.set(p.asientoId, arr);
  }

  return (
    <div>
      {header}

      <div className="space-y-3">
        {asientos.map((a) => {
          const ps = (partidasPorAsiento.get(a.id) ?? []).sort((x, y) => x.orden - y.orden);
          return (
            <div key={a.id} className="arca-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-small font-semibold">{a.numero}</span>
                    <Badge variant="neutral">{a.origen}</Badge>
                    {a.estado === "anulado" && <Badge variant="error">Anulado</Badge>}
                  </div>
                  {a.referenciaTabla === "ventas" && a.referenciaId && (
                    <Link
                      href={`/ventas/${a.referenciaId}`}
                      className="mt-1 inline-flex text-[12px] text-[color:var(--color-secondary)] hover:underline"
                    >
                      Ver venta relacionada
                    </Link>
                  )}
                  <div className="mt-0.5 text-[12px] text-[color:var(--color-text-muted)]">
                    {formatearFecha(a.fecha, pais)} · {a.concepto}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-label">Total</div>
                  <div className="text-base font-semibold">
                    {formatearMoneda(parseFloat(a.totalDebe), pais)}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-small">
                  <thead className="border-b border-[color:var(--color-border)]">
                    <tr className="text-label">
                      <th className="px-4 py-2 text-left">Cuenta</th>
                      <th className="px-4 py-2 text-left">Detalle</th>
                      <th className="px-4 py-2 text-right">Debe</th>
                      <th className="px-4 py-2 text-right">Haber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ps.map((p, i) => (
                      <tr
                        key={i}
                        className="border-b border-[color:var(--color-border)] last:border-b-0"
                      >
                        <td className="px-4 py-2">
                          <span className="font-mono text-[12px] text-[color:var(--color-text-muted)]">
                            {p.codigo}
                          </span>{" "}
                          <span className="font-medium">{p.cuenta}</span>
                        </td>
                        <td className="px-4 py-2 text-[color:var(--color-text-muted)]">
                          {p.descripcion}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          {parseFloat(p.debe) > 0 ? formatearMoneda(parseFloat(p.debe), pais) : ""}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          {parseFloat(p.haber) > 0 ? formatearMoneda(parseFloat(p.haber), pais) : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
