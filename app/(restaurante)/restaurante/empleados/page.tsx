import type { Metadata } from "next";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { CalendarCheck, UserCheck, UsersRound, WalletCards } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import { empleados, sucursales } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { formatearFecha, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import {
  RestaurantCoreModulePage,
  RestaurantModuleGrid,
  RestaurantModuleList,
} from "@/components/restaurante/RestaurantCoreModulePage";
import { estadoTone, labelEstado, numero } from "@/lib/restaurante/core-pages";

export const metadata: Metadata = {
  title: "Empleados Restaurante | ARCA",
  description: "Equipo del restaurante usando RRHH core de ARCA.",
};

export default async function RestauranteEmpleadosPage() {
  const user = await requireSession();
  await requireModulo(user, "rrhh");
  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const sucursalIds = selectedSucursalIds(scope);

  const filas = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({
        id: empleados.id,
        codigo: empleados.codigo,
        nombres: empleados.nombres,
        apellidos: empleados.apellidos,
        puesto: empleados.puesto,
        departamento: empleados.departamento,
        telefono: empleados.telefono,
        email: empleados.email,
        fechaIngreso: empleados.fechaIngreso,
        salarioBase: empleados.salarioBase,
        frecuenciaPago: empleados.frecuenciaPago,
        estado: empleados.estado,
        sucursal: sucursales.nombre,
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
      .limit(240),
  );

  const activos = filas.filter((row) => row.estado === "activo").length;
  const cocina = filas.filter((row) => esPuesto(row.puesto, ["chef", "cocina", "cocinero"])).length;
  const atencion = filas.filter((row) =>
    esPuesto(row.puesto, ["mesero", "cajero", "host", "bartender", "delivery"]),
  ).length;
  const nominaBase = filas
    .filter((row) => row.estado === "activo")
    .reduce((total, row) => total + numero(row.salarioBase), 0);

  return (
    <RestaurantCoreModulePage
      eyebrow={scope.visible ? scope.etiqueta : "Equipo restaurante"}
      title="Equipo restaurante"
      subtitle="Personal por sucursal, puesto, estado y salario desde RRHH Core."
      actions={[
        { href: "/restaurante/asistencia", label: "Asistencia", icon: CalendarCheck },
        { href: "/restaurante/nomina", label: "Nomina", icon: WalletCards },
      ]}
      kpis={[
        { label: "Empleados", value: String(filas.length), icon: UsersRound },
        { label: "Activos", value: String(activos), icon: UserCheck },
        { label: "Atencion", value: String(atencion), hint: "Salon, caja y delivery" },
        { label: "Nomina base", value: formatearMoneda(nominaBase, pais), hint: "Empleados activos" },
      ]}
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <RestaurantModuleList
          title="Personal operativo"
          subtitle="Relaciona empleados con salon, cocina, caja y delivery sin automatizar decisiones laborales."
          empty="Aun no hay empleados registrados."
          items={filas.map((row) => ({
            id: row.id,
            title: `${row.nombres} ${row.apellidos}`,
            subtitle: `${row.puesto}${row.departamento ? ` / ${row.departamento}` : ""} / ${row.sucursal ?? "Sin sucursal"}`,
            meta: `${row.codigo} / ingreso ${formatearFecha(row.fechaIngreso, pais)} / ${row.telefono ?? row.email ?? "Sin contacto"}`,
            value: formatearMoneda(row.salarioBase, pais),
            badge: labelEstado(row.estado),
            tone: estadoTone(row.estado),
          }))}
        />
        <RestaurantModuleGrid
          title="Gestion del equipo"
          subtitle="Accesos RRHH dentro de Restaurante."
          actions={[
            { href: "/restaurante/asistencia", label: "Turnos y asistencia" },
            { href: "/restaurante/nomina", label: "Nomina y deducciones" },
            { href: "/restaurante/reportes", label: "Costo de personal" },
            { href: "/restaurante/auditoria", label: "Cambios auditados" },
          ]}
        />
      </section>
    </RestaurantCoreModulePage>
  );
}

function esPuesto(puesto: string, palabras: string[]) {
  const texto = puesto.toLowerCase();
  return palabras.some((palabra) => texto.includes(palabra));
}
