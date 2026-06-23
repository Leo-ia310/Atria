import Link from "next/link";
import { BookOpen } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  asientosContables,
  asientoPartidas,
  catalogoCuentas,
  empresas,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatearMoneda, formatearFecha } from "@/lib/utils";

export default async function LibroDiarioPage() {
  const user = await requireSession();
  const [empresa] = await db
    .select({ pais: empresas.pais })
    .from(empresas)
    .where(eq(empresas.id, user.empresaId))
    .limit(1);
  const pais = empresa?.pais ?? "NI";

  const asientos = await db
    .select({
      id: asientosContables.id,
      numero: asientosContables.numero,
      fecha: asientosContables.fecha,
      concepto: asientosContables.concepto,
      origen: asientosContables.origen,
      totalDebe: asientosContables.totalDebe,
      estado: asientosContables.estado,
    })
    .from(asientosContables)
    .where(eq(asientosContables.empresaId, user.empresaId))
    .orderBy(desc(asientosContables.fecha), desc(asientosContables.numero))
    .limit(100);

  if (asientos.length === 0) {
    return (
      <div>
        <PageHeader title="Libro Diario" subtitle="Asientos contables del periodo" />
        <Card>
          <EmptyState
            icon={BookOpen}
            titulo="Aún no hay asientos"
            descripcion="Cada venta, compra o gasto genera asientos automáticamente. Empieza haciendo una operación."
          />
        </Card>
      </div>
    );
  }

  const partidas = await db
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
    .where(eq(asientoPartidas.asientoId, asientos[0].id));

  const partidasPorAsiento = new Map<string, typeof partidas>();
  partidasPorAsiento.set(asientos[0].id, partidas);

  const otrosIds = asientos.slice(1).map((a) => a.id);
  if (otrosIds.length > 0) {
    const todas = await db
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
      .innerJoin(asientosContables, eq(asientosContables.id, asientoPartidas.asientoId))
      .where(eq(asientosContables.empresaId, user.empresaId));

    for (const p of todas) {
      const arr = partidasPorAsiento.get(p.asientoId) ?? [];
      arr.push(p);
      partidasPorAsiento.set(p.asientoId, arr);
    }
  }

  return (
    <div>
      <PageHeader
        title="Libro Diario"
        subtitle={`${asientos.length} asientos registrados`}
        actions={
          <Link
            href="/contabilidad/libro-mayor"
            className="atria-btn atria-btn-secondary atria-btn-sm"
          >
            Ver libro mayor →
          </Link>
        }
      />

      <div className="space-y-3">
        {asientos.map((a) => {
          const ps = (partidasPorAsiento.get(a.id) ?? []).sort((x, y) => x.orden - y.orden);
          return (
            <div key={a.id} className="atria-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-small font-semibold">{a.numero}</span>
                    <Badge variant="neutral">{a.origen}</Badge>
                    {a.estado === "anulado" && <Badge variant="error">Anulado</Badge>}
                  </div>
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

              <table className="w-full text-small">
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
          );
        })}
      </div>
    </div>
  );
}
