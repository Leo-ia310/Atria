import Link from "next/link";
import { UserRound, Plus } from "lucide-react";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { empleados, sucursales } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
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
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { BotonExportarExcel } from "@/components/ui/BotonExportarExcel";

type Fila = {
  id: string;
  codigo: string;
  nombres: string;
  apellidos: string;
  sucursal: string | null;
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
  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const sucursalIds = selectedSucursalIds(scope);

  const filas: Fila[] = await db
    .select({
      id: empleados.id,
      codigo: empleados.codigo,
      nombres: empleados.nombres,
      apellidos: empleados.apellidos,
      sucursal: sucursales.nombre,
      puesto: empleados.puesto,
      departamento: empleados.departamento,
      tipoContrato: empleados.tipoContrato,
      salarioBase: empleados.salarioBase,
      frecuenciaPago: empleados.frecuenciaPago,
      estado: empleados.estado,
    })
    .from(empleados)
    .leftJoin(sucursales, eq(sucursales.id, empleados.sucursalId))
    .where(
      and(
        eq(empleados.empresaId, user.empresaId),
        isNull(empleados.eliminadoEn),
        sucursalIds ? inArray(empleados.sucursalId, sucursalIds) : undefined,
      ),
    )
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
    ...(scope.visible
      ? [
          {
            key: "sucursal",
            header: "Sucursal",
            cell: (r: Fila) =>
              r.sucursal ?? (
                <span className="text-[color:var(--color-text-muted)]">Sin asignar</span>
              ),
            width: "150px",
          } satisfies Columna<Fila>,
        ]
      : []),
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
        subtitle={`${filas.length} empleados · ${activos} activos${scope.visible ? ` · ${scope.etiqueta}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BotonExportarExcel recurso="empleados" />
            <Link href="/rrhh/empleados/nuevo" className="arca-btn arca-btn-primary arca-btn-sm">
              <Plus size={14} /> Nuevo empleado
            </Link>
          </div>
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
