import type { Metadata } from "next";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { ClipboardCheck, PackageSearch } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import {
  almacenes,
  conteoDetalle,
  conteosInventario,
  sucursales,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { formatearFecha } from "@/lib/utils";
import {
  RestaurantCoreModulePage,
  RestaurantModuleGrid,
  RestaurantModuleList,
} from "@/components/restaurante/RestaurantCoreModulePage";
import { estadoTone, labelEstado } from "@/lib/restaurante/core-pages";

export const metadata: Metadata = {
  title: "Conteos Restaurante | ARCA",
  description: "Conteos fisicos de inventario restaurante sobre ARCA Core.",
};

export default async function RestauranteConteosPage() {
  const user = await requireSession();
  await requireModulo(user, "restaurante-inventario");
  const scope = await getSucursalScope(user);
  const sucursalIds = selectedSucursalIds(scope);

  const rows = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({
        id: conteosInventario.id,
        fecha: conteosInventario.fecha,
        estado: conteosInventario.estado,
        aplicadoEn: conteosInventario.aplicadoEn,
        notas: conteosInventario.notas,
        almacen: almacenes.nombre,
        sucursal: sucursales.nombre,
        items: sql<string>`COUNT(${conteoDetalle.id})`,
      })
      .from(conteosInventario)
      .innerJoin(almacenes, eq(almacenes.id, conteosInventario.almacenId))
      .leftJoin(sucursales, eq(sucursales.id, almacenes.sucursalId))
      .leftJoin(conteoDetalle, eq(conteoDetalle.conteoId, conteosInventario.id))
      .where(
        and(
          eq(conteosInventario.empresaId, user.empresaId),
          eq(almacenes.empresaId, user.empresaId),
          sucursalIds ? inArray(almacenes.sucursalId, sucursalIds) : undefined,
        ),
      )
      .groupBy(
        conteosInventario.id,
        almacenes.nombre,
        sucursales.nombre,
      )
      .orderBy(desc(conteosInventario.fecha))
      .limit(80),
  );

  const abiertos = rows.filter((row) => row.estado === "en_progreso").length;
  const aplicados = rows.filter((row) => row.aplicadoEn).length;

  return (
    <RestaurantCoreModulePage
      eyebrow={scope.visible ? scope.etiqueta : "Inventario restaurante"}
      title="Conteos fisicos"
      subtitle="Control de conteos por almacen; los ajustes deben quedar soportados por movimientos."
      actions={[{ href: "/restaurante/existencias", label: "Ver existencias", icon: PackageSearch }]}
      kpis={[
        { label: "Conteos", value: String(rows.length), icon: ClipboardCheck },
        { label: "En progreso", value: String(abiertos), hint: "Pendientes de aplicar" },
        { label: "Aplicados", value: String(aplicados), hint: "Con cierre registrado" },
        { label: "Items contados", value: rows.reduce((t, row) => t + Number(row.items), 0).toString() },
      ]}
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <RestaurantModuleList
          title="Conteos recientes"
          subtitle="Los conteos se filtran por sucursal cuando tu vista esta limitada."
          empty="Aun no hay conteos fisicos registrados."
          items={rows.map((row) => ({
            id: row.id,
            title: `${row.almacen} - ${row.sucursal ?? "Sin sucursal"}`,
            subtitle: row.notas ?? "Sin observaciones",
            meta: `${formatearFecha(row.fecha)} / ${row.items} items`,
            badge: labelEstado(row.estado),
            tone: estadoTone(row.estado),
          }))}
        />
        <RestaurantModuleGrid
          title="Acciones core"
          subtitle="La aplicacion del conteo usa el motor de inventario existente."
          actions={[
            { href: "/inventario", label: "Inventario core" },
            { href: "/reportes/inventario", label: "Reporte inventario" },
            { href: "/restaurante/movimientos", label: "Kardex restaurante" },
          ]}
        />
      </section>
    </RestaurantCoreModulePage>
  );
}
