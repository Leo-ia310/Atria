import { and, asc, eq, isNull, sql } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";
import { PackageMinus, PackageSearch, Plus, Search } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import {
  almacenes,
  existencias,
  productos,
  restauranteProductos,
  sucursales,
  unidadesMedida,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { registrarMermaRestauranteForm } from "@/lib/actions/restaurante-vertical";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import { FormField } from "@/components/ui/FormField";
import { FilterDialog } from "@/components/restaurante/FilterDialog";

export const metadata: Metadata = {
  title: "Insumos | ARCA Restaurante",
  description: "Catalogo operativo de insumos, stock base y registro de mermas para restaurante.",
};

export default async function RestauranteInventarioPage() {
  const user = await requireSession();
  await requireModulo(user, "restaurante-inventario");
  const empresa = await getEmpresaMetadata(user.empresaId);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;

  const [insumos, sucursalesList, almacenesList, unidades] = await dbConEmpresa(
    user.empresaId,
    (tx) =>
      Promise.all([
        tx
          .select({
            id: productos.id,
            nombre: productos.nombre,
            tipo: restauranteProductos.tipo,
            costoPromedio: productos.costoPromedio,
            stockMinimo: productos.stockMinimo,
            fechaVencimiento: productos.fechaVencimiento,
            stock: sql<string>`COALESCE(SUM(${existencias.cantidad}), 0)`,
          })
          .from(restauranteProductos)
          .innerJoin(productos, eq(productos.id, restauranteProductos.productoId))
          .leftJoin(existencias, eq(existencias.productoId, productos.id))
          .where(
            and(
              eq(restauranteProductos.empresaId, user.empresaId),
              eq(productos.empresaId, user.empresaId),
              isNull(productos.eliminadoEn),
            ),
          )
          .groupBy(productos.id, restauranteProductos.tipo)
          .orderBy(asc(productos.nombre)),
        tx
          .select({ id: sucursales.id, nombre: sucursales.nombre })
          .from(sucursales)
          .where(eq(sucursales.empresaId, user.empresaId))
          .orderBy(asc(sucursales.nombre)),
        tx
          .select({ id: almacenes.id, nombre: almacenes.nombre, sucursalId: almacenes.sucursalId })
          .from(almacenes)
          .where(and(eq(almacenes.empresaId, user.empresaId), eq(almacenes.activo, true)))
          .orderBy(asc(almacenes.nombre)),
        tx
          .select({ id: unidadesMedida.id, codigo: unidadesMedida.codigo })
          .from(unidadesMedida)
          .where(eq(unidadesMedida.empresaId, user.empresaId))
          .orderBy(asc(unidadesMedida.codigo)),
      ]),
  );

  const sucursalDefault = sucursalesList[0];
  const almacenDefault = almacenesList.find((almacen) => almacen.sucursalId === sucursalDefault?.id) ?? almacenesList[0];
  const puedeRegistrarMerma =
    sucursalesList.length > 0 && almacenesList.length > 0 && insumos.length > 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-label">Stock operativo</p>
          <h1 className="mt-1 text-xl">Insumos</h1>
          <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
            Catalogo limpio de cocina sobre el inventario de ARCA Core.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)]" />
            <input aria-label="Buscar insumos" placeholder="Buscar..." className="arca-input h-9 w-48 pl-9" />
          </div>
          <FilterDialog title="Filtros de insumos">
            <div className="grid gap-3 sm:grid-cols-3">
              <input aria-label="Filtrar por producto" placeholder="Producto" className="arca-input h-10" />
              <select aria-label="Filtrar por tipo" className="arca-input h-10" defaultValue="">
                <option value="">Tipo</option>
                <option value="insumo">Insumo</option>
                <option value="preparacion">Preparacion</option>
                <option value="producto_directo">Producto directo</option>
              </select>
              <select aria-label="Filtrar por almacen" className="arca-input h-10" defaultValue="">
                <option value="">Almacen</option>
                {almacenesList.map((almacen) => (
                  <option key={almacen.id} value={almacen.id}>
                    {almacen.nombre}
                  </option>
                ))}
              </select>
            </div>
          </FilterDialog>
          <Link href="/restaurante/recetas#clasificar-producto" className="arca-btn arca-btn-primary arca-btn-sm">
            <Plus size={14} /> Nuevo insumo
          </Link>
        </div>
      </header>

      <section className="grid gap-4">
        <Card>
          <CardHeader title="Catalogo operativo" subtitle={`${insumos.length} productos clasificados`} />
          <CardBody>
            {insumos.length === 0 ? (
              <div className="py-10 text-center text-small text-[color:var(--color-text-muted)]">
                Clasifica productos en Recetas para verlos aqui.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-small">
                  <thead className="text-label">
                    <tr>
                      <th className="px-3 py-2">Producto</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Stock</th>
                      <th className="px-3 py-2">Minimo</th>
                      <th className="px-3 py-2">Costo</th>
                      <th className="px-3 py-2">Vence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--color-border)]">
                    {insumos.map((item) => {
                      const stock = parseFloat(item.stock);
                      const minimo = parseFloat(item.stockMinimo);
                      return (
                        <tr key={item.id}>
                          <td className="px-3 py-2 font-medium">{item.nombre}</td>
                          <td className="px-3 py-2">
                            <Badge variant={item.tipo === "insumo" ? "info" : "neutral"}>{item.tipo}</Badge>
                          </td>
                          <td className="px-3 py-2">{stock.toFixed(4)}</td>
                          <td className="px-3 py-2">{minimo.toFixed(4)}</td>
                          <td className="px-3 py-2">{formatearMoneda(item.costoPromedio, pais)}</td>
                          <td className="px-3 py-2">{item.fechaVencimiento ?? "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <details
          id="registrar-merma"
          className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
        >
          <summary className="cursor-pointer px-4 py-3 font-semibold">Registrar merma</summary>
          <div className="px-4 pb-4">
            <Card>
              <CardHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    <PackageMinus size={16} /> Registrar merma
                  </span>
                }
                subtitle="Genera movimiento de inventario y auditoria"
              />
              <CardBody>
                <form action={registrarMermaRestauranteForm} className="space-y-3">
                  <FormField label="Sucursal">
                    <select
                      name="sucursalId"
                      defaultValue={sucursalDefault?.id}
                      disabled={sucursalesList.length === 0}
                      className="arca-input"
                    >
                      {sucursalesList.map((sucursal) => (
                        <option key={sucursal.id} value={sucursal.id}>
                          {sucursal.nombre}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Almacen">
                    <select
                      name="almacenId"
                      defaultValue={almacenDefault?.id}
                      disabled={almacenesList.length === 0}
                      className="arca-input"
                    >
                      {almacenesList.map((almacen) => (
                        <option key={almacen.id} value={almacen.id}>
                          {almacen.nombre}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Insumo">
                    <select name="productoId" disabled={insumos.length === 0} className="arca-input">
                      {insumos.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nombre}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField label="Cantidad">
                      <input name="cantidad" className="arca-input" />
                    </FormField>
                    <FormField label="Unidad">
                      <select name="unidadId" defaultValue="" className="arca-input">
                        <option value="">Unidad base</option>
                        {unidades.map((unidad) => (
                          <option key={unidad.id} value={unidad.id}>
                            {unidad.codigo}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  </div>
                  <FormField label="Costo unitario">
                    <input name="costoUnitario" className="arca-input" />
                  </FormField>
                  <FormField label="Motivo">
                    <select name="motivo" defaultValue="desperdicio" className="arca-input">
                      <option value="caducidad">Caducidad</option>
                      <option value="preparacion">Preparacion</option>
                      <option value="accidente">Accidente</option>
                      <option value="desperdicio">Desperdicio</option>
                      <option value="devolucion">Devolucion</option>
                      <option value="cortesia">Cortesia</option>
                      <option value="otro">Otro</option>
                    </select>
                  </FormField>
                  <FormField label="Observacion">
                    <textarea name="observacion" className="arca-input min-h-24" />
                  </FormField>
                  {!puedeRegistrarMerma && (
                    <p className="text-[12px] text-[color:var(--color-warning)]">
                      Necesitas sucursal, almacen e insumos clasificados antes de registrar mermas.
                    </p>
                  )}
                  <button type="submit" disabled={!puedeRegistrarMerma} className="arca-btn arca-btn-primary w-full">
                    <PackageSearch size={14} /> Registrar merma
                  </button>
                </form>
              </CardBody>
            </Card>
          </div>
        </details>
      </section>
    </div>
  );
}
