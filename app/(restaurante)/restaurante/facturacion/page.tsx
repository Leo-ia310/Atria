import type { Metadata } from "next";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { FileText, Receipt, ShieldCheck, WalletCards } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import {
  documentosFiscales,
  facturas,
  restauranteOrdenes,
  sucursales,
  ventas,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { formatearFechaHora, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import {
  RestaurantCoreModulePage,
  RestaurantModuleGrid,
  RestaurantModuleList,
} from "@/components/restaurante/RestaurantCoreModulePage";
import {
  estadoTone,
  labelCanalRestaurante,
  labelEstado,
  numero,
} from "@/lib/restaurante/core-pages";

export const metadata: Metadata = {
  title: "Facturacion Restaurante | ARCA",
  description: "Facturas, comprobantes internos y documentos fiscales de restaurante.",
};

export default async function RestauranteFacturacionPage() {
  const user = await requireSession();
  await requireModulo(user, "facturas");
  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const sucursalIds = selectedSucursalIds(scope);

  const [filas, documentos, canales] = await dbConEmpresa(user.empresaId, (tx) =>
    Promise.all([
      tx
        .select({
          id: facturas.id,
          numero: facturas.numero,
          fecha: facturas.fecha,
          clienteNombre: facturas.clienteNombre,
          vendedorNombre: facturas.vendedorNombre,
          formasPago: facturas.formasPago,
          esCredito: facturas.esCredito,
          total: facturas.total,
          ventaNumero: ventas.numero,
          ventaEstado: ventas.estado,
          sucursal: sucursales.nombre,
          ordenNumero: restauranteOrdenes.numero,
          canal: restauranteOrdenes.canal,
        })
        .from(facturas)
        .innerJoin(ventas, eq(ventas.id, facturas.ventaId))
        .leftJoin(restauranteOrdenes, eq(restauranteOrdenes.ventaId, ventas.id))
        .leftJoin(sucursales, eq(sucursales.id, ventas.sucursalId))
        .where(
          and(
            eq(facturas.empresaId, user.empresaId),
            eq(ventas.empresaId, user.empresaId),
            sucursalIds ? inArray(ventas.sucursalId, sucursalIds) : undefined,
          ),
        )
        .orderBy(desc(facturas.fecha))
        .limit(120),
      tx
        .select({
          estado: documentosFiscales.estado,
          cantidad: count(documentosFiscales.id),
        })
        .from(documentosFiscales)
        .where(eq(documentosFiscales.empresaId, user.empresaId))
        .groupBy(documentosFiscales.estado),
      tx
        .select({
          canal: restauranteOrdenes.canal,
          cantidad: count(restauranteOrdenes.id),
          total: sql<string>`COALESCE(SUM(${restauranteOrdenes.total}), 0)`,
        })
        .from(restauranteOrdenes)
        .where(
          and(
            eq(restauranteOrdenes.empresaId, user.empresaId),
            sucursalIds ? inArray(restauranteOrdenes.sucursalId, sucursalIds) : undefined,
          ),
        )
        .groupBy(restauranteOrdenes.canal),
    ]),
  );

  const totalFacturado = filas.reduce((total, row) => total + numero(row.total), 0);
  const facturasCredito = filas.filter((row) => row.esCredito);
  const docsFiscales = documentos.reduce((total, row) => total + row.cantidad, 0);

  return (
    <RestaurantCoreModulePage
      eyebrow={scope.visible ? scope.etiqueta : "Facturacion restaurante"}
      title="Facturacion restaurante"
      subtitle="Comprobantes internos, facturas y documentos fiscales configurados sin afirmar autorizaciones externas."
      actions={[
        { href: "/restaurante/ordenes", label: "Ordenes", icon: Receipt },
        { href: "/restaurante/impuestos", label: "Impuestos", icon: ShieldCheck },
        { href: "/restaurante/caja", label: "Caja", icon: WalletCards },
      ]}
      kpis={[
        { label: "Facturas recientes", value: String(filas.length), icon: FileText },
        { label: "Total facturado", value: formatearMoneda(totalFacturado, pais) },
        { label: "A credito", value: String(facturasCredito.length), hint: formatearMoneda(facturasCredito.reduce((total, row) => total + numero(row.total), 0), pais) },
        { label: "Docs fiscales", value: String(docsFiscales), hint: "Segun configuracion del pais" },
      ]}
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <RestaurantModuleList
          title="Comprobantes emitidos"
          subtitle="Cada factura conserva snapshot de venta, pagos, cliente y usuario."
          empty="Aun no hay facturas emitidas desde Restaurante."
          items={filas.map((row) => ({
            id: row.id,
            title: `${row.numero} / ${row.ordenNumero ?? row.ventaNumero}`,
            subtitle: `${row.clienteNombre ?? "Consumidor final"} / ${row.sucursal ?? "Sin sucursal"} / ${row.formasPago ?? "Sin pago"}`,
            meta: `${formatearFechaHora(row.fecha, pais, empresa?.zonaHoraria)} / ${row.vendedorNombre ?? "Sin vendedor"} / ${labelCanalRestaurante(row.canal)}`,
            value: formatearMoneda(row.total, pais),
            badge: row.esCredito ? "Credito" : labelEstado(row.ventaEstado),
            tone: row.esCredito ? "warning" : estadoTone(row.ventaEstado),
          }))}
        />
        <div className="space-y-4">
          <RestaurantModuleList
            title="Ventas por canal"
            subtitle="Base para reportes de impuestos, descuentos y devoluciones."
            empty="No hay ventas de restaurante por canal."
            items={canales.map((row) => ({
              id: row.canal,
              title: labelCanalRestaurante(row.canal),
              subtitle: `${row.cantidad} ordenes`,
              value: formatearMoneda(row.total, pais),
              badge: "Canal",
              tone: "info",
            }))}
          />
          <RestaurantModuleGrid
            title="Fiscalidad"
            subtitle="Configuracion reusable de ARCA Core."
            actions={[
              { href: "/restaurante/impuestos", label: "Motor de impuestos" },
              { href: "/restaurante/reportes", label: "Reporte fiscal" },
              { href: "/restaurante/contabilidad", label: "Asientos de ventas" },
            ]}
          />
        </div>
      </section>
    </RestaurantCoreModulePage>
  );
}
