import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  nominas,
  nominaDetalles,
  empleados,
  empresas,
  feriados,
  cuentasFinancieras,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { formatearMoneda, formatearFecha } from "@/lib/utils";
import { SEGURIDAD_SOCIAL_NOMBRE } from "@/lib/rrhh";
import { NominaAcciones } from "@/components/rrhh/NominaAcciones";
import type { PaisCodigo } from "@/lib/paises";

const VARIANTE: Record<string, "success" | "warning" | "neutral" | "error" | "info"> = {
  borrador: "neutral",
  aprobada: "info",
  pagada: "success",
  anulada: "error",
};

export default async function NominaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireSession();

  const [nom] = await db
    .select()
    .from(nominas)
    .where(and(eq(nominas.id, id), eq(nominas.empresaId, user.empresaId)))
    .limit(1);
  if (!nom) notFound();

  const [empresa] = await db
    .select({ pais: empresas.pais })
    .from(empresas)
    .where(eq(empresas.id, user.empresaId))
    .limit(1);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const money = (v: string | number) => formatearMoneda(v, pais);

  const detalles = await db
    .select({
      id: nominaDetalles.id,
      nombres: empleados.nombres,
      apellidos: empleados.apellidos,
      puesto: empleados.puesto,
      salarioBase: nominaDetalles.salarioBase,
      diasTrabajados: nominaDetalles.diasTrabajados,
      horasExtra: nominaDetalles.horasExtra,
      montoHorasExtra: nominaDetalles.montoHorasExtra,
      totalDevengado: nominaDetalles.totalDevengado,
      deduccionSeguridadSocial: nominaDetalles.deduccionSeguridadSocial,
      otrasDeducciones: nominaDetalles.otrasDeducciones,
      totalDeducciones: nominaDetalles.totalDeducciones,
      totalNeto: nominaDetalles.totalNeto,
    })
    .from(nominaDetalles)
    .leftJoin(empleados, eq(empleados.id, nominaDetalles.empleadoId))
    .where(eq(nominaDetalles.nominaId, nom.id))
    .orderBy(empleados.nombres);

  const feriadosPeriodo = await db
    .select({ id: feriados.id, nombre: feriados.nombre, fecha: feriados.fecha })
    .from(feriados)
    .where(
      and(
        eq(feriados.empresaId, user.empresaId),
        gte(feriados.fecha, nom.periodoInicio),
        lte(feriados.fecha, nom.periodoFin),
      ),
    )
    .orderBy(feriados.fecha);

  const cuentas =
    nom.estado === "aprobada"
      ? await db
          .select({ id: cuentasFinancieras.id, nombre: cuentasFinancieras.nombre })
          .from(cuentasFinancieras)
          .where(and(eq(cuentasFinancieras.empresaId, user.empresaId), eq(cuentasFinancieras.activa, true)))
      : [];

  const ssNombre = SEGURIDAD_SOCIAL_NOMBRE[pais];

  return (
    <div>
      <Link
        href="/rrhh/nomina"
        className="mb-3 inline-flex items-center gap-1 text-small text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
      >
        <ArrowLeft size={14} /> Volver a nómina
      </Link>
      <PageHeader
        title={nom.numero}
        subtitle={`${nom.descripcion} · pago ${formatearFecha(nom.fechaPago)}`}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={VARIANTE[nom.estado] ?? "neutral"}>{nom.estado}</Badge>
            <NominaAcciones
              nominaId={nom.id}
              estado={nom.estado}
              cuentas={cuentas.map((c) => ({ value: c.id, label: c.nombre }))}
            />
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <KpiCard label="Empleados" value={String(nom.empleadosCount)} />
        <KpiCard label="Total devengado" value={money(nom.totalDevengado)} />
        <KpiCard label="Deducciones" value={money(nom.totalDeducciones)} />
        <KpiCard label="Neto a pagar" value={money(nom.totalNeto)} />
      </div>

      {feriadosPeriodo.length > 0 && (
        <Card className="mb-6">
          <CardHeader title="Feriados en el período" subtitle="Días no laborables considerados" />
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {feriadosPeriodo.map((f) => (
                <Badge key={f.id} variant="warning">
                  {f.nombre} · {formatearFecha(f.fecha)}
                </Badge>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Recibos por empleado" subtitle={`Seguridad social: ${ssNombre}`} />
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
              <tr>
                <th className="text-label px-4 py-3 text-left font-semibold">Empleado</th>
                <th className="text-label px-4 py-3 text-right font-semibold">Días</th>
                <th className="text-label px-4 py-3 text-right font-semibold">H. Extra</th>
                <th className="text-label px-4 py-3 text-right font-semibold">Devengado</th>
                <th className="text-label px-4 py-3 text-right font-semibold">{ssNombre}</th>
                <th className="text-label px-4 py-3 text-right font-semibold">Deducciones</th>
                <th className="text-label px-4 py-3 text-right font-semibold">Neto</th>
              </tr>
            </thead>
            <tbody>
              {detalles.map((d) => (
                <tr key={d.id} className="border-b border-[color:var(--color-border)] last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {d.nombres} {d.apellidos}
                    </div>
                    <div className="text-[11px] text-[color:var(--color-text-muted)]">{d.puesto}</div>
                  </td>
                  <td className="px-4 py-3 text-right">{Number(d.diasTrabajados)}</td>
                  <td className="px-4 py-3 text-right">{Number(d.horasExtra)}</td>
                  <td className="px-4 py-3 text-right">{money(d.totalDevengado)}</td>
                  <td className="px-4 py-3 text-right text-[color:var(--color-text-muted)]">
                    {money(d.deduccionSeguridadSocial)}
                  </td>
                  <td className="px-4 py-3 text-right text-[color:var(--color-text-muted)]">
                    {money(d.totalDeducciones)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{money(d.totalNeto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] font-semibold">
                <td className="px-4 py-3">Totales</td>
                <td></td>
                <td></td>
                <td className="px-4 py-3 text-right">{money(nom.totalDevengado)}</td>
                <td></td>
                <td className="px-4 py-3 text-right">{money(nom.totalDeducciones)}</td>
                <td className="px-4 py-3 text-right">{money(nom.totalNeto)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
