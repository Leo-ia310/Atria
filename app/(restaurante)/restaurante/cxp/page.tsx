import type { Metadata } from "next";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Banknote, CalendarClock, Truck, WalletCards } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import { compras, cuentasPorPagar, proveedores, sucursales } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { fechaISOEnZona } from "@/lib/dates";
import { formatearFecha, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import {
  RestaurantCoreModulePage,
  RestaurantModuleList,
} from "@/components/restaurante/RestaurantCoreModulePage";
import { estadoTone, labelEstado, numero } from "@/lib/restaurante/core-pages";

export const metadata: Metadata = {
  title: "CxP Restaurante | ARCA",
  description: "Cuentas por pagar de proveedores restaurante conectadas a tesoreria y contabilidad.",
};

export default async function RestauranteCxpPage() {
  const user = await requireSession();
  await requireModulo(user, "cxp");
  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const hoy = fechaISOEnZona(new Date(), empresa?.zonaHoraria ?? "America/Managua");
  const sucursalIds = selectedSucursalIds(scope);

  const rows = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({
        id: cuentasPorPagar.id,
        proveedor: proveedores.razonSocial,
        compraNumero: compras.numeroFactura,
        sucursal: sucursales.nombre,
        fechaEmision: cuentasPorPagar.fechaEmision,
        fechaVencimiento: cuentasPorPagar.fechaVencimiento,
        monto: cuentasPorPagar.monto,
        saldo: cuentasPorPagar.saldo,
        estado: cuentasPorPagar.estado,
        notas: cuentasPorPagar.notas,
      })
      .from(cuentasPorPagar)
      .innerJoin(proveedores, eq(proveedores.id, cuentasPorPagar.proveedorId))
      .leftJoin(compras, eq(compras.id, cuentasPorPagar.compraId))
      .leftJoin(sucursales, eq(sucursales.id, compras.sucursalId))
      .where(
        and(
          eq(cuentasPorPagar.empresaId, user.empresaId),
          eq(proveedores.empresaId, user.empresaId),
          sucursalIds ? inArray(compras.sucursalId, sucursalIds) : undefined,
        ),
      )
      .orderBy(desc(cuentasPorPagar.fechaVencimiento), desc(cuentasPorPagar.creadoEn))
      .limit(160),
  );

  const abiertas = rows.filter((row) => row.estado !== "pagada");
  const vencidas = abiertas.filter((row) => row.fechaVencimiento < hoy);
  const saldoAbierto = abiertas.reduce((total, row) => total + numero(row.saldo), 0);
  const saldoVencido = vencidas.reduce((total, row) => total + numero(row.saldo), 0);

  return (
    <RestaurantCoreModulePage
      eyebrow={scope.visible ? scope.etiqueta : "Finanzas proveedor"}
      title="Cuentas por pagar"
      subtitle="Pagos a proveedores conectados a compras, tesoreria y contabilidad sin alterar saldos manualmente."
      actions={[
        { href: "/restaurante/compras", label: "Compras", icon: Truck },
        { href: "/restaurante/tesoreria", label: "Tesoreria", icon: Banknote },
      ]}
      kpis={[
        { label: "CxP activas", value: String(abiertas.length), icon: WalletCards },
        { label: "Saldo abierto", value: formatearMoneda(saldoAbierto, pais) },
        { label: "Vencidas", value: String(vencidas.length), hint: formatearMoneda(saldoVencido, pais), icon: CalendarClock },
        { label: "Proveedores", value: String(new Set(rows.map((row) => row.proveedor)).size) },
      ]}
    >
      <RestaurantModuleList
        title="Documentos por pagar"
        subtitle="Cada pago debe originar movimiento financiero y asiento contable desde ARCA Core."
        empty="No hay cuentas por pagar registradas."
        items={rows.map((row) => {
          const vencida = row.estado !== "pagada" && row.fechaVencimiento < hoy;
          return {
            id: row.id,
            title: row.proveedor,
            subtitle: `${row.compraNumero ?? "Compra sin factura"} / ${row.sucursal ?? "Sin sucursal"}`,
            meta: `Emitida ${formatearFecha(row.fechaEmision, pais)} / vence ${formatearFecha(row.fechaVencimiento, pais)}${row.notas ? ` / ${row.notas}` : ""}`,
            value: formatearMoneda(row.saldo, pais),
            badge: vencida ? "Vencida" : labelEstado(row.estado),
            tone: vencida ? "error" : estadoTone(row.estado),
          };
        })}
      />
    </RestaurantCoreModulePage>
  );
}
