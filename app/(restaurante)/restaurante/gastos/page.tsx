import type { Metadata } from "next";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { Receipt, Repeat2, WalletCards } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import {
  categoriasGasto,
  cuentasFinancieras,
  gastos,
  gastosRecurrentes,
  proveedores,
  sucursales,
} from "@/lib/db/schema";
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
import { numero } from "@/lib/restaurante/core-pages";

export const metadata: Metadata = {
  title: "Gastos Restaurante | ARCA",
  description: "Gastos, recurrentes y pagos operativos del restaurante.",
};

export default async function RestauranteGastosPage() {
  const user = await requireSession();
  await requireModulo(user, "tesoreria");
  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const sucursalIds = selectedSucursalIds(scope);

  const [filas, recurrentes] = await dbConEmpresa(user.empresaId, (tx) =>
    Promise.all([
      tx
        .select({
          id: gastos.id,
          fecha: gastos.fecha,
          descripcion: gastos.descripcion,
          referencia: gastos.referencia,
          subtotal: gastos.subtotal,
          impuesto: gastos.impuesto,
          total: gastos.total,
          categoria: categoriasGasto.nombre,
          cuenta: cuentasFinancieras.nombre,
          proveedor: proveedores.razonSocial,
          sucursal: sucursales.nombre,
          recurrenteId: gastos.recurrenteId,
        })
        .from(gastos)
        .innerJoin(categoriasGasto, eq(categoriasGasto.id, gastos.categoriaId))
        .leftJoin(cuentasFinancieras, eq(cuentasFinancieras.id, gastos.cuentaFinancieraId))
        .leftJoin(proveedores, eq(proveedores.id, gastos.proveedorId))
        .leftJoin(sucursales, eq(sucursales.id, gastos.sucursalId))
        .where(
          and(
            eq(gastos.empresaId, user.empresaId),
            eq(categoriasGasto.empresaId, user.empresaId),
            sucursalIds ? inArray(gastos.sucursalId, sucursalIds) : undefined,
          ),
        )
        .orderBy(desc(gastos.fecha), desc(gastos.creadoEn))
        .limit(140),
      tx
        .select({
          id: gastosRecurrentes.id,
          descripcion: gastosRecurrentes.descripcion,
          subtotal: gastosRecurrentes.subtotal,
          impuesto: gastosRecurrentes.impuesto,
          activa: gastosRecurrentes.activa,
          proximaFecha: gastosRecurrentes.proximaFecha,
          categoria: categoriasGasto.nombre,
          cuenta: cuentasFinancieras.nombre,
        })
        .from(gastosRecurrentes)
        .innerJoin(categoriasGasto, eq(categoriasGasto.id, gastosRecurrentes.categoriaId))
        .innerJoin(cuentasFinancieras, eq(cuentasFinancieras.id, gastosRecurrentes.cuentaFinancieraId))
        .where(
          and(
            eq(gastosRecurrentes.empresaId, user.empresaId),
            sucursalIds ? inArray(gastosRecurrentes.sucursalId, sucursalIds) : undefined,
          ),
        )
        .orderBy(gastosRecurrentes.proximaFecha)
        .limit(40),
    ]),
  );

  const totalGastos = filas.reduce((total, row) => total + numero(row.total), 0);
  const totalImpuestos = filas.reduce((total, row) => total + numero(row.impuesto), 0);
  const gastosRecurrentesActivos = recurrentes.filter((row) => row.activa).length;

  return (
    <RestaurantCoreModulePage
      eyebrow={scope.visible ? scope.etiqueta : "Finanzas restaurante"}
      title="Gastos restaurante"
      subtitle="Servicios, alquiler, mantenimiento y egresos conectados a tesoreria y contabilidad."
      actions={[
        { href: "/restaurante/tesoreria", label: "Tesoreria", icon: WalletCards },
        { href: "/restaurante/contabilidad", label: "Contabilidad", icon: Receipt },
      ]}
      kpis={[
        { label: "Gastos recientes", value: String(filas.length), icon: Receipt },
        { label: "Total gastos", value: formatearMoneda(totalGastos, pais) },
        { label: "Impuestos", value: formatearMoneda(totalImpuestos, pais) },
        { label: "Recurrentes", value: String(gastosRecurrentesActivos), hint: "Activos", icon: Repeat2 },
      ]}
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <RestaurantModuleList
          title="Gastos recientes"
          subtitle="Cada gasto conserva categoria, cuenta financiera y asiento cuando aplica."
          empty="Aun no hay gastos registrados."
          items={filas.map((row) => ({
            id: row.id,
            title: row.descripcion,
            subtitle: `${row.categoria} / ${row.cuenta ?? "Sin cuenta"} / ${row.sucursal ?? "Sin sucursal"}`,
            meta: `${formatearFecha(row.fecha, pais)}${row.proveedor ? ` / ${row.proveedor}` : ""}${row.referencia ? ` / ${row.referencia}` : ""}`,
            value: formatearMoneda(row.total, pais),
            badge: row.recurrenteId ? "Recurrente" : "Unico",
            tone: row.recurrenteId ? "info" : "neutral",
          }))}
        />
        <RestaurantModuleList
          title="Gastos recurrentes"
          subtitle="Alquiler, energia, internet, software y mantenimiento programado."
          empty="No hay gastos recurrentes configurados."
          items={recurrentes.map((row) => ({
            id: row.id,
            title: row.descripcion,
            subtitle: `${row.categoria} / ${row.cuenta}`,
            meta: `Proximo ${formatearFecha(row.proximaFecha, pais)}`,
            value: formatearMoneda(numero(row.subtotal) + numero(row.impuesto), pais),
            badge: row.activa ? "Activa" : "Pausada",
            tone: row.activa ? "success" : "warning",
          }))}
        />
      </section>
      <RestaurantModuleGrid
        title="Reportes relacionados"
        subtitle="Egresos listos para contadores y administradores."
        actions={[
          { href: "/restaurante/reportes", label: "Reporte financiero" },
          { href: "/restaurante/impuestos", label: "Impuestos acreditables" },
          { href: "/restaurante/cxp", label: "Pagos a proveedores" },
        ]}
      />
    </RestaurantCoreModulePage>
  );
}
