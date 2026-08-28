import type { Metadata } from "next";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { ChefHat, ClipboardList, ShoppingCart, Truck } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import {
  clientes,
  restauranteComensales,
  restauranteOrdenItems,
  restauranteOrdenes,
  sucursales,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { formatearFechaHora, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import {
  RestaurantCoreModulePage,
  RestaurantModuleList,
} from "@/components/restaurante/RestaurantCoreModulePage";
import {
  estadoTone,
  labelCanalRestaurante,
  labelEstado,
  numero,
} from "@/lib/restaurante/core-pages";

export const metadata: Metadata = {
  title: "Delivery Restaurante | ARCA",
  description: "Canales para llevar, delivery y web dentro del flujo de ordenes y KDS.",
};

type RestauranteOrdenCanal =
  | "salon"
  | "qr_mesa"
  | "para_llevar"
  | "delivery_propio"
  | "delivery_externo"
  | "pedido_web";

const CANALES_DELIVERY: RestauranteOrdenCanal[] = [
  "para_llevar",
  "delivery_propio",
  "delivery_externo",
  "pedido_web",
];

export default async function RestauranteDeliveryPage() {
  const user = await requireSession();
  await requireModulo(user, "restaurante-ordenes");
  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const sucursalIds = selectedSucursalIds(scope);

  const rows = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({
        id: restauranteOrdenes.id,
        numero: restauranteOrdenes.numero,
        canal: restauranteOrdenes.canal,
        estado: restauranteOrdenes.estado,
        personas: restauranteOrdenes.personas,
        total: restauranteOrdenes.total,
        notas: restauranteOrdenes.notas,
        abiertoEn: restauranteOrdenes.abiertoEn,
        sucursal: sucursales.nombre,
        cliente: clientes.nombre,
        comensal: restauranteComensales.nombre,
        items: count(restauranteOrdenItems.id),
      })
      .from(restauranteOrdenes)
      .leftJoin(sucursales, eq(sucursales.id, restauranteOrdenes.sucursalId))
      .leftJoin(clientes, eq(clientes.id, restauranteOrdenes.clienteId))
      .leftJoin(restauranteComensales, eq(restauranteComensales.id, restauranteOrdenes.comensalId))
      .leftJoin(restauranteOrdenItems, eq(restauranteOrdenItems.ordenId, restauranteOrdenes.id))
      .where(
        and(
          eq(restauranteOrdenes.empresaId, user.empresaId),
          inArray(restauranteOrdenes.canal, CANALES_DELIVERY),
          sucursalIds ? inArray(restauranteOrdenes.sucursalId, sucursalIds) : undefined,
        ),
      )
      .groupBy(
        restauranteOrdenes.id,
        sucursales.nombre,
        clientes.nombre,
        restauranteComensales.nombre,
      )
      .orderBy(desc(restauranteOrdenes.abiertoEn))
      .limit(120),
  );

  const abiertas = rows.filter((row) => row.estado !== "pagada" && row.estado !== "cancelada");
  const propias = rows.filter((row) => row.canal === "delivery_propio");
  const externas = rows.filter((row) => row.canal === "delivery_externo");
  const totalCanales = rows.reduce((total, row) => total + numero(row.total), 0);

  return (
    <RestaurantCoreModulePage
      eyebrow={scope.visible ? scope.etiqueta : "Canales restaurante"}
      title="Delivery y para llevar"
      subtitle="Ordenes por canal conectadas al mismo POS, KDS, facturacion, caja e inventario."
      actions={[
        { href: "/restaurante/pos", label: "Nueva orden", icon: ShoppingCart, primary: true },
        { href: "/restaurante/kds", label: "Ver KDS", icon: ChefHat },
      ]}
      kpis={[
        { label: "Ordenes canal", value: String(rows.length), icon: Truck },
        { label: "Abiertas", value: String(abiertas.length), icon: ClipboardList },
        { label: "Delivery propio", value: String(propias.length) },
        { label: "Venta canal", value: formatearMoneda(totalCanales, pais), hint: `${externas.length} externas` },
      ]}
    >
      <RestaurantModuleList
        title="Ordenes de canal"
        subtitle="Delivery no tiene cocina separada: los productos enviados siguen entrando al KDS normal."
        empty="Aun no hay ordenes para llevar, delivery o web."
        items={rows.map((row) => ({
          id: row.id,
          title: `${row.numero} / ${labelCanalRestaurante(row.canal)}`,
          subtitle: `${row.comensal ?? row.cliente ?? "Consumidor final"} / ${row.sucursal ?? "Sin sucursal"}`,
          meta: `${row.items} productos / ${row.personas} personas / ${formatearFechaHora(row.abiertoEn, pais, empresa?.zonaHoraria)}${row.notas ? ` / ${row.notas}` : ""}`,
          value: formatearMoneda(row.total, pais),
          badge: labelEstado(row.estado),
          tone: estadoTone(row.estado),
        }))}
      />
    </RestaurantCoreModulePage>
  );
}
