import type { Metadata } from "next";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Scale, Truck, WalletCards } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import {
  compraDetalle,
  compras,
  cuentasPorPagar,
  productos,
  proveedores,
  unidadesMedida,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { formatearFecha, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import {
  RestaurantCoreModulePage,
  RestaurantModuleList,
} from "@/components/restaurante/RestaurantCoreModulePage";
import { cantidad, estadoTone, numero } from "@/lib/restaurante/core-pages";

export const metadata: Metadata = {
  title: "Proveedores Restaurante | ARCA",
  description: "Proveedores, condiciones, saldos y comparacion de costos de restaurante.",
};

export default async function RestauranteProveedoresPage() {
  const user = await requireSession();
  await requireModulo(user, "compras");
  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const sucursalIds = selectedSucursalIds(scope);

  const [proveedoresRows, comprasResumen, cxpResumen, precios] = await dbConEmpresa(
    user.empresaId,
    (tx) =>
      Promise.all([
        tx
          .select({
            id: proveedores.id,
            razonSocial: proveedores.razonSocial,
            nombreComercial: proveedores.nombreComercial,
            identificacionFiscal: proveedores.identificacionFiscal,
            telefono: proveedores.telefono,
            email: proveedores.email,
            contacto: proveedores.contacto,
            diasCredito: proveedores.diasCredito,
            activo: proveedores.activo,
          })
          .from(proveedores)
          .where(and(eq(proveedores.empresaId, user.empresaId), isNull(proveedores.eliminadoEn)))
          .orderBy(desc(proveedores.creadoEn))
          .limit(200),
        tx
          .select({
            proveedorId: compras.proveedorId,
            total: sql<string>`COALESCE(SUM(${compras.total}), 0)`,
            cantidad: count(compras.id),
            ultima: sql<string | null>`MAX(${compras.fecha})`,
          })
          .from(compras)
          .where(
            and(
              eq(compras.empresaId, user.empresaId),
              sucursalIds ? inArray(compras.sucursalId, sucursalIds) : undefined,
            ),
          )
          .groupBy(compras.proveedorId),
        tx
          .select({
            proveedorId: cuentasPorPagar.proveedorId,
            saldo: sql<string>`COALESCE(SUM(${cuentasPorPagar.saldo}), 0)`,
            pendientes: count(cuentasPorPagar.id),
          })
          .from(cuentasPorPagar)
          .where(
            and(
              eq(cuentasPorPagar.empresaId, user.empresaId),
              inArray(cuentasPorPagar.estado, ["pendiente", "parcial", "vencida"]),
            ),
          )
          .groupBy(cuentasPorPagar.proveedorId),
        tx
          .select({
            productoId: productos.id,
            producto: productos.nombre,
            unidad: unidadesMedida.codigo,
            proveedor: proveedores.razonSocial,
            proveedorId: proveedores.id,
            precioPromedio: sql<string>`COALESCE(AVG(${compraDetalle.costoUnitario}), 0)`,
            precioMinimo: sql<string>`COALESCE(MIN(${compraDetalle.costoUnitario}), 0)`,
            precioMaximo: sql<string>`COALESCE(MAX(${compraDetalle.costoUnitario}), 0)`,
            compras: count(compraDetalle.id),
          })
          .from(compraDetalle)
          .innerJoin(compras, eq(compras.id, compraDetalle.compraId))
          .innerJoin(proveedores, eq(proveedores.id, compras.proveedorId))
          .innerJoin(productos, eq(productos.id, compraDetalle.productoId))
          .leftJoin(unidadesMedida, eq(unidadesMedida.id, productos.unidadBaseId))
          .where(
            and(
              eq(compras.empresaId, user.empresaId),
              eq(proveedores.empresaId, user.empresaId),
              eq(productos.empresaId, user.empresaId),
              sucursalIds ? inArray(compras.sucursalId, sucursalIds) : undefined,
            ),
          )
          .groupBy(
            productos.id,
            productos.nombre,
            unidadesMedida.codigo,
            proveedores.id,
            proveedores.razonSocial,
          )
          .orderBy(desc(sql`COUNT(${compraDetalle.id})`))
          .limit(24),
      ]),
  );

  const comprasMap = new Map(comprasResumen.map((row) => [row.proveedorId, row]));
  const cxpMap = new Map(cxpResumen.map((row) => [row.proveedorId, row]));
  const totalComprado = comprasResumen.reduce((total, row) => total + numero(row.total), 0);
  const saldoPendiente = cxpResumen.reduce((total, row) => total + numero(row.saldo), 0);
  const proveedoresActivos = proveedoresRows.filter((row) => row.activo).length;

  return (
    <RestaurantCoreModulePage
      eyebrow={scope.visible ? scope.etiqueta : "Abastecimiento restaurante"}
      title="Proveedores restaurante"
      subtitle="Condiciones comerciales, saldos pendientes e historial de costos del mismo modulo de compras."
      actions={[
        { href: "/restaurante/compras", label: "Compras", icon: Truck },
        { href: "/restaurante/cxp", label: "Pagos pendientes", icon: WalletCards },
      ]}
      kpis={[
        { label: "Proveedores", value: String(proveedoresRows.length), hint: `${proveedoresActivos} activos`, icon: Truck },
        { label: "Total comprado", value: formatearMoneda(totalComprado, pais) },
        { label: "Saldo pendiente", value: formatearMoneda(saldoPendiente, pais) },
        { label: "Costos comparables", value: String(precios.length), hint: "Producto/proveedor", icon: Scale },
      ]}
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <RestaurantModuleList
          title="Directorio de proveedores"
          subtitle="Datos fiscales y condiciones de pago disponibles para compras de restaurante."
          empty="Aun no hay proveedores registrados."
          items={proveedoresRows.map((row) => {
            const compra = comprasMap.get(row.id);
            const cxp = cxpMap.get(row.id);
            return {
              id: row.id,
              title: row.nombreComercial ?? row.razonSocial,
              subtitle: `${row.razonSocial}${row.identificacionFiscal ? ` / ${row.identificacionFiscal}` : ""}`,
              meta: `${row.contacto ? `Contacto ${row.contacto} / ` : ""}${row.telefono ?? row.email ?? "Sin contacto"} / ${row.diasCredito > 0 ? `${row.diasCredito} dias credito` : "Contado"}`,
              value: formatearMoneda(compra?.total ?? "0", pais),
              badge: cxp && numero(cxp.saldo) > 0 ? `${cxp.pendientes} pendientes` : row.activo ? "Activo" : "Inactivo",
              tone: cxp && numero(cxp.saldo) > 0 ? "warning" : estadoTone(row.activo ? "activo" : "baja"),
              href: "/restaurante/proveedores",
            };
          })}
        />
        <RestaurantModuleList
          title="Comparacion de costos"
          subtitle="Costo promedio historico por proveedor; util para revisar variaciones antes de comprar."
          empty="Aun no hay detalle suficiente para comparar costos."
          items={precios.map((row) => ({
            id: `${row.productoId}:${row.proveedorId}`,
            title: row.producto,
            subtitle: `${row.proveedor} / ${row.compras} compras`,
            meta: `Min ${formatearMoneda(row.precioMinimo, pais)} / Max ${formatearMoneda(row.precioMaximo, pais)}`,
            value: `${formatearMoneda(row.precioPromedio, pais)}${row.unidad ? `/${cantidad(1)} ${row.unidad}` : ""}`,
            badge: "Historico",
            tone: "info",
          }))}
        />
      </section>
    </RestaurantCoreModulePage>
  );
}
