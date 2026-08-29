import type { Metadata } from "next";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Banknote, Receipt, Wallet } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import { cuentasFinancieras, movimientosTesoreria, sucursales } from "@/lib/db/schema";
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
  title: "Tesoreria Restaurante | ARCA",
  description: "Movimientos de dinero del restaurante.",
};

export default async function RestauranteTesoreriaPage() {
  const user = await requireSession();
  await requireModulo(user, "tesoreria");
  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const sucursalIds = selectedSucursalIds(scope);

  const movimientos = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({
        id: movimientosTesoreria.id,
        tipo: movimientosTesoreria.tipo,
        fecha: movimientosTesoreria.fecha,
        monto: movimientosTesoreria.monto,
        descripcion: movimientosTesoreria.descripcion,
        referencia: movimientosTesoreria.referencia,
        referenciaTabla: movimientosTesoreria.referenciaTabla,
        conciliado: movimientosTesoreria.conciliado,
        cuenta: cuentasFinancieras.nombre,
        sucursal: sucursales.nombre,
      })
      .from(movimientosTesoreria)
      .innerJoin(cuentasFinancieras, eq(cuentasFinancieras.id, movimientosTesoreria.cuentaId))
      .leftJoin(sucursales, eq(sucursales.id, cuentasFinancieras.sucursalId))
      .where(
        and(
          eq(movimientosTesoreria.empresaId, user.empresaId),
          eq(cuentasFinancieras.empresaId, user.empresaId),
          sucursalIds ? inArray(cuentasFinancieras.sucursalId, sucursalIds) : undefined,
        ),
      )
      .orderBy(desc(movimientosTesoreria.fecha), desc(movimientosTesoreria.creadoEn))
      .limit(120),
  );

  const ingresos = movimientos
    .filter((row) => row.tipo === "ingreso")
    .reduce((total, row) => total + numero(row.monto), 0);
  const egresos = movimientos
    .filter((row) => row.tipo === "egreso")
    .reduce((total, row) => total + numero(row.monto), 0);
  const pendientesConciliar = movimientos.filter((row) => !row.conciliado).length;

  return (
    <RestaurantCoreModulePage
      eyebrow={scope.visible ? scope.etiqueta : "Tesoreria restaurante"}
      title="Tesoreria restaurante"
      subtitle="Movimientos financieros conectados a ventas, gastos, CxP y contabilidad."
      actions={[
        { href: "/restaurante/gastos", label: "Gastos", icon: Receipt },
        { href: "/restaurante/caja", label: "Caja", icon: Wallet },
        { href: "/restaurante/cxp", label: "CxP", icon: Banknote },
      ]}
      kpis={[
        { label: "Ingresos", value: formatearMoneda(ingresos, pais) },
        { label: "Egresos", value: formatearMoneda(egresos, pais) },
        { label: "Por conciliar", value: String(pendientesConciliar), hint: "Movimientos recientes" },
      ]}
    >
      <section>
        <RestaurantModuleList
          title="Movimientos recientes"
          subtitle="No reemplazan el historial transaccional de ventas, pagos o compras."
          empty="Aun no hay movimientos de tesoreria."
          items={movimientos.map((row) => ({
            id: row.id,
            title: row.descripcion ?? labelEstado(row.tipo),
            subtitle: `${row.cuenta} / ${row.sucursal ?? "Consolidada"} / ${formatearFecha(row.fecha, pais)}`,
            meta: `${row.referenciaTabla ?? "Movimiento"}${row.referencia ? ` / ${row.referencia}` : ""}`,
            value: `${row.tipo === "egreso" ? "-" : ""}${formatearMoneda(row.monto, pais)}`,
            badge: row.conciliado ? "Conciliado" : labelEstado(row.tipo),
            tone: row.conciliado ? "success" : estadoTone(row.tipo),
          }))}
        />
      </section>
      <RestaurantModuleGrid
        title="Flujos financieros"
        subtitle="Entradas y salidas amarradas al core."
        actions={[
          { href: "/restaurante/facturacion", label: "Ingresos por ventas" },
          { href: "/restaurante/gastos", label: "Gastos y recurrentes" },
          { href: "/restaurante/contabilidad", label: "Libro contable" },
        ]}
      />
    </RestaurantCoreModulePage>
  );
}
