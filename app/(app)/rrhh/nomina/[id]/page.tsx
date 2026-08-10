import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  nominas,
  nominaDetalles,
  empleados,
  feriados,
  cuentasFinancieras,
  nominaIngresos,
  tiposIngreso,
  nominaDeducciones,
  tiposDeduccion,
  nominaColillas,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { formatearMoneda, formatearFecha } from "@/lib/utils";
import { SEGURIDAD_SOCIAL_NOMBRE } from "@/lib/rrhh";
import { NominaAcciones } from "@/components/rrhh/NominaAcciones";
import { PagoDetalleControl } from "@/components/rrhh/PagoDetalleControl";
import {
  HorasExtraDetalle,
  IngresosDetalle,
  DeduccionesDetalle,
  ColillaPagoVer,
  ImprimirColillasLote,
  type ColillaSnapshot,
} from "@/components/rrhh/NominaTrazabilidad";
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

  const empresa = await getEmpresaMetadata(user.empresaId);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const money = (v: string | number) => formatearMoneda(v, pais);

  const detalles = await db
    .select({
      id: nominaDetalles.id,
      nombres: empleados.nombres,
      apellidos: empleados.apellidos,
      puesto: empleados.puesto,
      codigo: empleados.codigo,
      salarioBase: nominaDetalles.salarioBase,
      diasTrabajados: nominaDetalles.diasTrabajados,
      horasExtra: nominaDetalles.horasExtra,
      montoHorasExtra: nominaDetalles.montoHorasExtra,
      bonificaciones: nominaDetalles.bonificaciones,
      totalDevengado: nominaDetalles.totalDevengado,
      deduccionSeguridadSocial: nominaDetalles.deduccionSeguridadSocial,
      deduccionRenta: nominaDetalles.deduccionRenta,
      otrasDeducciones: nominaDetalles.otrasDeducciones,
      totalDeducciones: nominaDetalles.totalDeducciones,
      totalNeto: nominaDetalles.totalNeto,
      estadoPago: nominaDetalles.estadoPago,
    })
    .from(nominaDetalles)
    .leftJoin(empleados, eq(empleados.id, nominaDetalles.empleadoId))
    .where(eq(nominaDetalles.nominaId, nom.id))
    .orderBy(empleados.nombres);
  const detalleIds = detalles.map((d) => d.id);
  const [ingresosVariables, deduccionesVariables, colillas] = await Promise.all([
    detalleIds.length
      ? db
          .select({
            detalleId: nominaIngresos.nominaDetalleId,
            tipo: tiposIngreso.nombre,
            monto: nominaIngresos.monto,
            nota: nominaIngresos.nota,
            semana: nominaIngresos.semana,
            creadoEn: nominaIngresos.creadoEn,
          })
          .from(nominaIngresos)
          .innerJoin(tiposIngreso, eq(tiposIngreso.id, nominaIngresos.tipoIngresoId))
          .where(inArray(nominaIngresos.nominaDetalleId, detalleIds))
          .orderBy(nominaIngresos.creadoEn)
      : [],
    detalleIds.length
      ? db
          .select({
            detalleId: nominaDeducciones.nominaDetalleId,
            tipo: tiposDeduccion.nombre,
            monto: nominaDeducciones.monto,
            nota: nominaDeducciones.nota,
            semana: nominaDeducciones.semana,
            creadoEn: nominaDeducciones.creadoEn,
          })
          .from(nominaDeducciones)
          .innerJoin(tiposDeduccion, eq(tiposDeduccion.id, nominaDeducciones.tipoDeduccionId))
          .where(inArray(nominaDeducciones.nominaDetalleId, detalleIds))
          .orderBy(nominaDeducciones.creadoEn)
      : [],
    detalleIds.length
      ? db
          .select({
            detalleId: nominaColillas.nominaDetalleId,
            snapshot: nominaColillas.snapshot,
          })
          .from(nominaColillas)
          .where(inArray(nominaColillas.nominaDetalleId, detalleIds))
      : [],
  ]);
  const ingresosPorDetalle = new Map(
    detalles.map((d) => [
      d.id,
      ingresosVariables
        .filter((x) => x.detalleId === d.id)
        .map((x) => ({
          concepto: x.tipo,
          monto: Number(x.monto),
          nota: x.nota,
          semana: x.semana,
          creadoEn: x.creadoEn.toISOString(),
        })),
    ]),
  );
  const deduccionesPorDetalle = new Map(
    detalles.map((d) => [
      d.id,
      deduccionesVariables
        .filter((x) => x.detalleId === d.id)
        .map((x) => ({
          concepto: x.tipo,
          monto: Number(x.monto),
          nota: x.nota,
          semana: x.semana,
          creadoEn: x.creadoEn.toISOString(),
        })),
    ]),
  );
  const colillaPorDetalle = new Map(
    colillas.map((c) => [c.detalleId, c.snapshot as Record<string, unknown>]),
  );
  const colillasLote = detalles.flatMap((detalle) => {
    const snapshot = colillaPorDetalle.get(detalle.id);
    return snapshot ? [snapshot as ColillaSnapshot] : [];
  });
  const totalIngresosExtra = detalles.reduce(
    (total, detalle) => total + Number(detalle.bonificaciones),
    0,
  );

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
  const mostrarPago = nom.estado === "aprobada" || nom.estado === "pagada";
  const bloqueadoPagado = nom.estado === "pagada";

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
          <div className="flex flex-wrap items-center gap-3">
            <ImprimirColillasLote
              pais={pais}
              snapshots={colillasLote}
              totalEmpleados={detalles.length}
            />
            <Badge variant={VARIANTE[nom.estado] ?? "neutral"}>{nom.estado}</Badge>
            <NominaAcciones
              nominaId={nom.id}
              estado={nom.estado}
              nivelVerificacion={nom.nivelVerificacion}
              cuentas={cuentas.map((c) => ({ value: c.id, label: c.nombre }))}
            />
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Empleados" value={String(nom.empleadosCount)} />
        <KpiCard label="Ingresos extra" value={money(totalIngresosExtra)} />
        <KpiCard label="Total devengado" value={money(nom.totalDevengado)} />
        <KpiCard label="Deducciones" value={money(nom.totalDeducciones)} />
        <KpiCard label="Neto a pagar" value={money(nom.totalNeto)} />
      </div>

      {nom.estado === "borrador" && (
        <div className="mb-6 rounded-md border border-[color:var(--color-secondary)]/30 bg-[color:var(--color-secondary)]/8 p-4 text-small">
          <p className="font-medium text-[color:var(--color-text-primary)]">
            Flujo de verificación (3 pasos) · vas en {nom.nivelVerificacion}/3
          </p>
          <ol className="mt-1 list-decimal pl-5 text-[color:var(--color-text-muted)]">
            <li>Verifica la nómina recién creada.</li>
            <li>
              Agrega los ingresos extra en{" "}
              <Link
                href={`/rrhh/ingresos?nomina=${nom.id}`}
                className="text-[color:var(--color-secondary)] underline"
              >
                Ingresos
              </Link>{" "}
              y las deducciones no fijas en{" "}
              <Link
                href={`/rrhh/deducciones?nomina=${nom.id}`}
                className="text-[color:var(--color-secondary)] underline"
              >
                Deducciones
              </Link>{" "}
              y verifica de nuevo.
            </li>
            <li>Verificación final: la nómina se bloquea y solo se registran pagos.</li>
          </ol>
        </div>
      )}

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
          <table className="w-full min-w-[980px] text-small">
            <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
              <tr>
                <th className="text-label px-4 py-3 text-left font-semibold">Empleado</th>
                <th className="text-label px-4 py-3 text-right font-semibold">Días</th>
                <th className="text-label px-4 py-3 text-right font-semibold">H. Extra</th>
                <th className="text-label px-4 py-3 text-right font-semibold">Ingresos extra</th>
                <th className="text-label px-4 py-3 text-right font-semibold">Devengado</th>
                <th className="text-label px-4 py-3 text-right font-semibold">{ssNombre}</th>
                <th className="text-label px-4 py-3 text-right font-semibold">IR</th>
                <th className="text-label px-4 py-3 text-right font-semibold">Deducciones</th>
                <th className="text-label px-4 py-3 text-right font-semibold">Neto</th>
                {mostrarPago && (
                  <th className="text-label px-4 py-3 text-center font-semibold">Pago</th>
                )}
                {mostrarPago && (
                  <th className="text-label px-4 py-3 text-center font-semibold">Colilla</th>
                )}
              </tr>
            </thead>
            <tbody>
              {detalles.map((d) => {
                const ingresos = ingresosPorDetalle.get(d.id) ?? [];
                const variables = deduccionesPorDetalle.get(d.id) ?? [];
                const fijas = [
                  {
                    concepto: ssNombre,
                    monto: Number(d.deduccionSeguridadSocial),
                    nota: "Deduccion fija",
                  },
                  ...(Number(d.deduccionRenta) > 0
                    ? [{ concepto: "IR", monto: Number(d.deduccionRenta), nota: "Deduccion fija" }]
                    : []),
                ];
                const colilla = colillaPorDetalle.get(d.id) ?? null;
                return (
                  <tr key={d.id} className="border-b border-[color:var(--color-border)] last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {d.nombres} {d.apellidos}
                      </div>
                      <div className="text-[11px] text-[color:var(--color-text-muted)]">
                        {d.codigo} - {d.puesto}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{Number(d.diasTrabajados)}</td>
                    <td className="px-4 py-3 text-right">
                      <HorasExtraDetalle
                        pais={pais}
                        horas={Number(d.horasExtra)}
                        monto={Number(d.montoHorasExtra)}
                        salarioMensual={Number(d.salarioBase)}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <IngresosDetalle
                        pais={pais}
                        total={Number(d.bonificaciones)}
                        variables={ingresos}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">{money(d.totalDevengado)}</td>
                    <td className="px-4 py-3 text-right text-[color:var(--color-text-muted)]">
                      {money(d.deduccionSeguridadSocial)}
                    </td>
                    <td className="px-4 py-3 text-right text-[color:var(--color-text-muted)]">
                      {money(d.deduccionRenta)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeduccionesDetalle
                        pais={pais}
                        total={Number(d.totalDeducciones)}
                        fijas={fijas}
                        variables={variables}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{money(d.totalNeto)}</td>
                    {mostrarPago && (
                      <td className="px-4 py-3 text-center">
                        <PagoDetalleControl
                          detalleId={d.id}
                          estadoPago={d.estadoPago}
                          bloqueadoPagado={bloqueadoPagado}
                        />
                      </td>
                    )}
                    {mostrarPago && (
                      <td className="px-4 py-3 text-center">
                        <ColillaPagoVer pais={pais} snapshot={colilla as ColillaSnapshot | null} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] font-semibold">
                <td className="px-4 py-3">Totales</td>
                <td></td>
                <td></td>
                <td className="px-4 py-3 text-right">{money(totalIngresosExtra)}</td>
                <td className="px-4 py-3 text-right">{money(nom.totalDevengado)}</td>
                <td></td>
                <td></td>
                <td className="px-4 py-3 text-right">{money(nom.totalDeducciones)}</td>
                <td className="px-4 py-3 text-right">{money(nom.totalNeto)}</td>
                {mostrarPago && <td></td>}
                {mostrarPago && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
