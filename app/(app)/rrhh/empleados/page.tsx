import Link from "next/link";
import { UserRound, Plus } from "lucide-react";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { empleados, empresas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatearMoneda } from "@/lib/utils";
import {
  ESTADO_EMPLEADO_LABEL,
  TIPO_CONTRATO_LABEL,
  FRECUENCIA_LABEL,
} from "@/lib/rrhh";

type Fila = {
  id: string;
  codigo: string;
  nombres: string;
  apellidos: string;
  puesto: string;
  departamento: string | null;
  tipoContrato: string;
  salarioBase: string;
  frecuenciaPago: string;
  estado: string;
};

const VARIANTE_ESTADO: Record<
  string,
  "success" | "warning" | "neutral" | "error" | "info"
> = {
  activo: "success",
  vacaciones: "info",
  licencia: "warning",
  suspendido: "warning",
  baja: "error",
};

export default async function EmpleadosPage() {
  const user = await requireSession();
  const [empresa] = await db
    .select({ pais: empresas.pais })
    .from(empresas)
    .where(eq(empresas.id, user.empresaId))
    .limit(1);

  const filas: Fila[] = await db
    .select({
      id: empleados.id,
      codigo: empleados.codigo,
      nombres: empleados.nombres,
      apellidos: empleados.apellidos,
      puesto: empleados.puesto,
      departamento: empleados.departamento,
      tipoContrato: empleados.tipoContrato,
      salarioBase: empleados.salarioBase,
      frecuenciaPago: empleados.frecuenciaPago,
      estado: empleados.estado,
    })
    .from(empleados)
    .where(and(eq(empleados.empresaId, user.empresaId), isNull(empleados.eliminadoEn)))
    .orderBy(desc(empleados.creadoEn))
    .limit(300);

  const activos = filas.filter((f) => f.estado === "activo").length;

  const columnas: Columna<Fila>[] = [
    {
      key: "nombre",
      header: "Empleado",
      cell: (r) => (
        <div>
          <div className="font-medium">
            {r.nombres} {r.apellidos}
          </div>
          <div className="text-[12px] text-[color:var(--color-text-muted)]">{r.codigo}</div>
        </div>
      ),
    },
    {
      key: "puesto",
      header: "Puesto",
      cell: (r) => (
        <div>
          <div>{r.puesto}</div>
          {r.departamento && (
            <div className="text-[12px] text-[color:var(--color-text-muted)]">{r.departamento}</div>
          )}
        </div>
      ),
    },
    {
      key: "contrato",
      header: "Contrato",
      cell: (r) => (
        <span className="text-[12px]">{TIPO_CONTRATO_LABEL[r.tipoContrato] ?? r.tipoContrato}</span>
      ),
    },
    {
      key: "salario",
      header: "Salario",
      align: "right",
      cell: (r) => (
        <div>
          <div className="font-medium">
            {formatearMoneda(r.salarioBase, empresa?.pais ?? "NI")}
          </div>
          <div className="text-[11px] text-[color:var(--color-text-muted)]">
            {FRECUENCIA_LABEL[r.frecuenciaPago] ?? r.frecuenciaPago}
          </div>
        </div>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      cell: (r) => (
        <Badge variant={VARIANTE_ESTADO[r.estado] ?? "neutral"}>
          {ESTADO_EMPLEADO_LABEL[r.estado] ?? r.estado}
        </Badge>
      ),
      width: "130px",
    },
    {
      key: "accion",
      header: "",
      align: "right",
      cell: (r) => (
        <Link
          href={`/rrhh/empleados/${r.id}`}
          className="text-[color:var(--color-secondary)] hover:underline"
        >
          Ver →
        </Link>
      ),
      width: "90px",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Empleados"
        subtitle={`${filas.length} empleados · ${activos} activos`}
        actions={
          <Link href="/rrhh/empleados/nuevo" className="atria-btn atria-btn-primary atria-btn-sm">
            <Plus size={14} /> Nuevo empleado
          </Link>
        }
      />
      <DataTable
        data={filas}
        columns={columnas}
        rowKey={(r) => r.id}
        empty={
          <EmptyState
            icon={UserRound}
            titulo="Aún no hay empleados"
            descripcion="Registra a tu equipo para gestionar asistencia, nómina y solicitudes."
            accion={
              <Link href="/rrhh/empleados/nuevo">
                <Button size="sm">
                  <Plus size={14} /> Crear primer empleado
                </Button>
              </Link>
            }
          />
        }
      />
    </div>
  );
}
