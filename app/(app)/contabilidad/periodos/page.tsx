import Link from "next/link";
import { Calendar } from "lucide-react";
import { and, count, desc, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { asientosContables, periodosContables } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { AccionesEstado, CrearProximoPeriodo } from "@/components/periodos/PeriodoAcciones";
import { formatearFecha } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";

const MESES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export default async function PeriodosPage() {
  const user = await requireSession();

  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const sucursalIds = selectedSucursalIds(scope);
  const filtrosAsientos: SQL[] = [
    eq(asientosContables.periodoId, periodosContables.id),
    eq(asientosContables.estado, "registrado"),
  ];
  if (sucursalIds) {
    filtrosAsientos.push(inArray(asientosContables.sucursalId, sucursalIds));
  }

  const periodos = await db
    .select({
      id: periodosContables.id,
      anio: periodosContables.anio,
      mes: periodosContables.mes,
      fechaInicio: periodosContables.fechaInicio,
      fechaFin: periodosContables.fechaFin,
      estado: periodosContables.estado,
      cerradoEn: periodosContables.cerradoEn,
      numAsientos: count(asientosContables.id),
    })
    .from(periodosContables)
    .leftJoin(asientosContables, and(...filtrosAsientos))
    .where(eq(periodosContables.empresaId, user.empresaId))
    .groupBy(
      periodosContables.id,
      periodosContables.anio,
      periodosContables.mes,
      periodosContables.fechaInicio,
      periodosContables.fechaFin,
      periodosContables.estado,
      periodosContables.cerradoEn,
    )
    .orderBy(desc(periodosContables.anio), desc(periodosContables.mes));

  let nextAnio: number;
  let nextMes: number;

  if (periodos.length === 0) {
    const now = new Date();
    nextAnio = now.getFullYear();
    nextMes = now.getMonth() + 1;
  } else {
    const latest = periodos[0];
    if (latest.mes === 12) {
      nextAnio = latest.anio + 1;
      nextMes = 1;
    } else {
      nextAnio = latest.anio;
      nextMes = latest.mes + 1;
    }
  }

  const nextLabel = `${MESES_ES[nextMes - 1]} ${nextAnio}`;
  const abiertos = periodos.filter((p) => p.estado === "abierto").length;

  return (
    <div>
      <PageHeader
        title="Periodos Contables"
        subtitle={`${periodos.length} periodo(s) - ${abiertos} abierto(s)${scope.visible ? ` - ${scope.etiqueta}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <CrearProximoPeriodo anio={nextAnio} mes={nextMes} label={nextLabel} />
            <Link href="/contabilidad" className="arca-btn arca-btn-secondary arca-btn-sm">
              Volver
            </Link>
          </div>
        }
      />

      {periodos.length === 0 ? (
        <Card>
          <EmptyState
            icon={Calendar}
            titulo="Sin periodos contables"
            descripcion="Crea el primer periodo para poder registrar asientos contables."
          />
        </Card>
      ) : (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-small">
                <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                  <tr className="text-label">
                    <th className="px-4 py-2 text-left">Periodo</th>
                    <th className="px-4 py-2 text-left">Fechas</th>
                    <th className="px-4 py-2 text-center">Asientos</th>
                    <th className="px-4 py-2 text-center">Estado</th>
                    <th className="px-4 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {periodos.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-[color:var(--color-border)] last:border-b-0"
                    >
                      <td className="px-4 py-3 font-semibold">
                        {MESES_ES[p.mes - 1]} {p.anio}
                      </td>
                      <td className="px-4 py-3 text-[color:var(--color-text-muted)]">
                        {formatearFecha(p.fechaInicio, pais)} - {formatearFecha(p.fechaFin, pais)}
                      </td>
                      <td className="px-4 py-3 text-center font-mono">{p.numAsientos}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={p.estado === "abierto" ? "success" : "neutral"}>
                          {p.estado === "abierto" ? "Abierto" : "Cerrado"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <AccionesEstado periodoId={p.id} estado={p.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
