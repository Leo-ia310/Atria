import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { CalendarClock, UserCheck, WalletCards } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import { nominas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { formatearFecha, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import {
  RestaurantCoreModulePage,
  RestaurantModuleGrid,
  RestaurantModuleList,
} from "@/components/restaurante/RestaurantCoreModulePage";
import { estadoTone, labelEstado, numero } from "@/lib/restaurante/core-pages";

export const metadata: Metadata = {
  title: "Nomina Restaurante | ARCA",
  description: "Nomina, deducciones y asiento contable del personal restaurante.",
};

export default async function RestauranteNominaPage() {
  const user = await requireSession();
  await requireModulo(user, "rrhh");
  const empresa = await getEmpresaMetadata(user.empresaId);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;

  const filas = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({
        id: nominas.id,
        numero: nominas.numero,
        descripcion: nominas.descripcion,
        frecuencia: nominas.frecuencia,
        periodoInicio: nominas.periodoInicio,
        periodoFin: nominas.periodoFin,
        fechaPago: nominas.fechaPago,
        estado: nominas.estado,
        nivelVerificacion: nominas.nivelVerificacion,
        empleadosCount: nominas.empleadosCount,
        totalDevengado: nominas.totalDevengado,
        totalDeducciones: nominas.totalDeducciones,
        totalNeto: nominas.totalNeto,
        pagadoEn: nominas.pagadoEn,
      })
      .from(nominas)
      .where(eq(nominas.empresaId, user.empresaId))
      .orderBy(desc(nominas.creadoEn))
      .limit(100),
  );

  const totalNeto = filas.reduce((total, row) => total + numero(row.totalNeto), 0);
  const deducciones = filas.reduce((total, row) => total + numero(row.totalDeducciones), 0);
  const pagadas = filas.filter((row) => row.estado === "pagada").length;

  return (
    <RestaurantCoreModulePage
      eyebrow="Payroll core"
      title="Nomina restaurante"
      subtitle="Planillas, deducciones, verificacion y asientos contables sin reglas laborales hardcodeadas."
      actions={[
        { href: "/restaurante/empleados", label: "Empleados", icon: UserCheck },
        { href: "/restaurante/asistencia", label: "Asistencia", icon: CalendarClock },
      ]}
      kpis={[
        { label: "Nominas", value: String(filas.length), icon: WalletCards },
        { label: "Total neto", value: formatearMoneda(totalNeto, pais) },
        { label: "Deducciones", value: formatearMoneda(deducciones, pais) },
        { label: "Pagadas", value: String(pagadas) },
      ]}
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <RestaurantModuleList
          title="Planillas recientes"
          subtitle="Cada nomina puede generar devengo, pago y asiento desde el motor contable existente."
          empty="Aun no hay nominas generadas."
          items={filas.map((row) => ({
            id: row.id,
            title: `${row.numero} / ${row.descripcion}`,
            subtitle: `${labelEstado(row.frecuencia)} / ${row.empleadosCount} empleados / pago ${formatearFecha(row.fechaPago, pais)}`,
            meta: `${formatearFecha(row.periodoInicio, pais)} - ${formatearFecha(row.periodoFin, pais)} / verificacion ${row.nivelVerificacion}/3`,
            value: formatearMoneda(row.totalNeto, pais),
            badge: labelEstado(row.estado),
            tone: estadoTone(row.estado),
          }))}
        />
        <RestaurantModuleGrid
          title="Integracion laboral"
          subtitle="Reglas versionadas por pais y snapshots historicos."
          actions={[
            { href: "/restaurante/asistencia", label: "Horas y extras" },
            { href: "/restaurante/contabilidad", label: "Asientos de nomina" },
            { href: "/restaurante/reportes", label: "Costo de personal" },
          ]}
        />
      </section>
    </RestaurantCoreModulePage>
  );
}
