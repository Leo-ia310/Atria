import Link from "next/link";
import { Wallet, CalendarClock } from "lucide-react";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { nominas, feriados, empresas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { formatearMoneda, formatearFecha } from "@/lib/utils";
import { NominaGenerarButton } from "@/components/rrhh/NominaGenerarButton";

type Fila = {
  id: string;
  numero: string;
  descripcion: string;
  frecuencia: string;
  periodoInicio: string;
  periodoFin: string;
  fechaPago: string;
  estado: string;
  empleadosCount: number;
  totalNeto: string;
};

const VARIANTE: Record<string, "success" | "warning" | "neutral" | "error" | "info"> = {
  borrador: "neutral",
  aprobada: "info",
  pagada: "success",
  anulada: "error",
};

export default async function NominaPage() {
  const user = await requireSession();
  const [empresa] = await db
    .select({ pais: empresas.pais })
    .from(empresas)
    .where(eq(empresas.id, user.empresaId))
    .limit(1);
  const pais = empresa?.pais ?? "NI";

  const filas: Fila[] = await db
    .select({
      id: nominas.id,
      numero: nominas.numero,
      descripcion: nominas.descripcion,
      frecuencia: nominas.frecuencia,
      periodoInicio: nominas.periodoInicio,
      periodoFin: nominas.periodoFin,
      fechaPago: nominas.fechaPago,
      estado: nominas.estado,
      empleadosCount: nominas.empleadosCount,
      totalNeto: nominas.totalNeto,
    })
    .from(nominas)
    .where(eq(nominas.empresaId, user.empresaId))
    .orderBy(desc(nominas.creadoEn))
    .limit(100);

  const hoy = new Date().toISOString().slice(0, 10);
  const proximosFeriados = await db
    .select({ id: feriados.id, nombre: feriados.nombre, fecha: feriados.fecha })
    .from(feriados)
    .where(and(eq(feriados.empresaId, user.empresaId), gte(feriados.fecha, hoy)))
    .orderBy(feriados.fecha)
    .limit(6);

  const columnas: Columna<Fila>[] = [
    {
      key: "numero",
      header: "Nómina",
      cell: (r) => (
        <div>
          <div className="font-medium">{r.numero}</div>
          <div className="text-[12px] text-[color:var(--color-text-muted)]">{r.descripcion}</div>
        </div>
      ),
    },
    {
      key: "periodo",
      header: "Período",
      cell: (r) => (
        <span className="text-[12px]">
          {formatearFecha(r.periodoInicio)} – {formatearFecha(r.periodoFin)}
        </span>
      ),
    },
    {
      key: "pago",
      header: "Fecha pago",
      cell: (r) => <span className="text-[12px]">{formatearFecha(r.fechaPago)}</span>,
    },
    { key: "emp", header: "Empleados", align: "right", cell: (r) => r.empleadosCount },
    {
      key: "neto",
      header: "Neto",
      align: "right",
      cell: (r) => <span className="font-medium">{formatearMoneda(r.totalNeto, pais)}</span>,
    },
    {
      key: "estado",
      header: "Estado",
      cell: (r) => <Badge variant={VARIANTE[r.estado] ?? "neutral"}>{r.estado}</Badge>,
      width: "110px",
    },
    {
      key: "accion",
      header: "",
      align: "right",
      cell: (r) => (
        <Link href={`/rrhh/nomina/${r.id}`} className="text-[color:var(--color-secondary)] hover:underline">
          Ver →
        </Link>
      ),
      width: "80px",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Nómina"
        subtitle="Planillas de pago y deducciones"
        actions={<NominaGenerarButton />}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DataTable
            data={filas}
            columns={columnas}
            rowKey={(r) => r.id}
            empty={
              <EmptyState
                icon={Wallet}
                titulo="Aún no has generado nóminas"
                descripcion="Genera una planilla y el sistema calculará devengado, deducciones y neto por empleado."
              />
            }
          />
        </div>

        <Card className="h-fit">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <CalendarClock size={16} /> Próximos feriados
              </span>
            }
            subtitle="Días no laborables del calendario"
            actions={
              <Link href="/rrhh/feriados" className="text-[12px] text-[color:var(--color-secondary)] hover:underline">
                Gestionar
              </Link>
            }
          />
          <CardBody className="space-y-2">
            {proximosFeriados.length === 0 ? (
              <p className="text-small text-[color:var(--color-text-muted)]">
                No hay feriados próximos.{" "}
                <Link href="/rrhh/feriados" className="text-[color:var(--color-secondary)] hover:underline">
                  Cargar calendario
                </Link>
              </p>
            ) : (
              proximosFeriados.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded-md bg-[color:var(--color-surface-2)] px-3 py-2"
                >
                  <span className="text-small font-medium">{f.nombre}</span>
                  <span className="text-[12px] text-[color:var(--color-text-muted)]">
                    {formatearFecha(f.fecha)}
                  </span>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
