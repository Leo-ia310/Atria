import Link from "next/link";
import { BookOpen } from "lucide-react";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  asientosContables,
  asientoPartidas,
  catalogoCuentas,
  empresas,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatearMoneda, formatearFecha } from "@/lib/utils";

export default async function LibroMayorPage({
  searchParams,
}: {
  searchParams: Promise<{ cuenta?: string }>;
}) {
  const params = await searchParams;
  const user = await requireSession();
  const [empresa] = await db
    .select({ pais: empresas.pais })
    .from(empresas)
    .where(eq(empresas.id, user.empresaId))
    .limit(1);
  const pais = empresa?.pais ?? "NI";

  const cuentas = await db
    .select({
      id: catalogoCuentas.id,
      codigo: catalogoCuentas.codigo,
      nombre: catalogoCuentas.nombre,
      naturaleza: catalogoCuentas.naturaleza,
    })
    .from(catalogoCuentas)
    .where(
      and(
        eq(catalogoCuentas.empresaId, user.empresaId),
        eq(catalogoCuentas.esDetalle, true),
      ),
    )
    .orderBy(asc(catalogoCuentas.codigo));

  const cuentaSeleccionada = params.cuenta
    ? cuentas.find((c) => c.id === params.cuenta)
    : cuentas[0];

  const movimientos = cuentaSeleccionada
    ? await db
        .select({
          fecha: asientosContables.fecha,
          numero: asientosContables.numero,
          concepto: asientosContables.concepto,
          descripcion: asientoPartidas.descripcion,
          debe: asientoPartidas.debe,
          haber: asientoPartidas.haber,
        })
        .from(asientoPartidas)
        .innerJoin(
          asientosContables,
          eq(asientosContables.id, asientoPartidas.asientoId),
        )
        .where(
          and(
            eq(asientoPartidas.cuentaId, cuentaSeleccionada.id),
            eq(asientosContables.empresaId, user.empresaId),
            eq(asientosContables.estado, "registrado"),
          ),
        )
        .orderBy(asc(asientosContables.fecha), asc(asientosContables.numero))
    : [];

  let saldoCorrido = 0;
  const filas = movimientos.map((m) => {
    const debe = parseFloat(m.debe);
    const haber = parseFloat(m.haber);
    saldoCorrido +=
      cuentaSeleccionada?.naturaleza === "deudora" ? debe - haber : haber - debe;
    return { ...m, debe, haber, saldo: saldoCorrido };
  });

  const totalDebe = filas.reduce((a, f) => a + f.debe, 0);
  const totalHaber = filas.reduce((a, f) => a + f.haber, 0);

  return (
    <div>
      <PageHeader
        title="Libro Mayor"
        subtitle="Movimientos por cuenta contable"
        actions={
          <Link
            href="/contabilidad/libro-diario"
            className="atria-btn atria-btn-secondary atria-btn-sm"
          >
            Ver libro diario →
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-1">
          <CardHeader title="Cuentas" />
          <CardBody className="p-0">
            <div className="max-h-[600px] overflow-y-auto">
              {cuentas.map((c) => {
                const activa = cuentaSeleccionada?.id === c.id;
                return (
                  <Link
                    key={c.id}
                    href={`/contabilidad/libro-mayor?cuenta=${c.id}`}
                    className={`block border-b border-[color:var(--color-border)] px-4 py-2 text-small last:border-b-0 transition ${
                      activa
                        ? "bg-[color:var(--color-surface-2)] font-medium"
                        : "hover:bg-[color:var(--color-surface-2)]"
                    }`}
                  >
                    <span className="font-mono text-[11px] text-[color:var(--color-text-muted)]">
                      {c.codigo}
                    </span>
                    <div className="truncate text-[color:var(--color-text-primary)]">{c.nombre}</div>
                  </Link>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title={
              cuentaSeleccionada
                ? `${cuentaSeleccionada.codigo} · ${cuentaSeleccionada.nombre}`
                : "Selecciona una cuenta"
            }
            subtitle={
              cuentaSeleccionada
                ? `Naturaleza ${cuentaSeleccionada.naturaleza}`
                : undefined
            }
          />
          <CardBody>
            {filas.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                titulo="Sin movimientos en esta cuenta"
                descripcion="Cuando una operación afecte esta cuenta, aparecerán los movimientos aquí."
              />
            ) : (
              <>
                <table className="w-full text-small">
                  <thead className="border-b border-[color:var(--color-border)]">
                    <tr className="text-label">
                      <th className="px-2 py-2 text-left">Fecha</th>
                      <th className="px-2 py-2 text-left">N° Asiento</th>
                      <th className="px-2 py-2 text-left">Detalle</th>
                      <th className="px-2 py-2 text-right">Debe</th>
                      <th className="px-2 py-2 text-right">Haber</th>
                      <th className="px-2 py-2 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, i) => (
                      <tr
                        key={i}
                        className="border-b border-[color:var(--color-border)] last:border-b-0"
                      >
                        <td className="px-2 py-2">{formatearFecha(f.fecha, pais)}</td>
                        <td className="px-2 py-2 font-mono text-[12px]">{f.numero}</td>
                        <td className="px-2 py-2 text-[color:var(--color-text-muted)]">
                          {f.descripcion ?? f.concepto}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {f.debe > 0 ? formatearMoneda(f.debe, pais) : ""}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {f.haber > 0 ? formatearMoneda(f.haber, pais) : ""}
                        </td>
                        <td className="px-2 py-2 text-right font-semibold">
                          {formatearMoneda(f.saldo, pais)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[color:var(--color-surface-2)] font-semibold">
                      <td colSpan={3} className="px-2 py-2 text-right">
                        Totales
                      </td>
                      <td className="px-2 py-2 text-right">{formatearMoneda(totalDebe, pais)}</td>
                      <td className="px-2 py-2 text-right">{formatearMoneda(totalHaber, pais)}</td>
                      <td className="px-2 py-2 text-right">
                        {formatearMoneda(saldoCorrido, pais)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
