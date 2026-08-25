import { and, asc, eq, isNull } from "drizzle-orm";
import { FlaskConical, Plus, ReceiptText } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import {
  productos,
  restauranteEstaciones,
  restauranteProductos,
  restauranteRecetaIngredientes,
  restauranteRecetas,
  unidadesMedida,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import {
  agregarIngredienteRecetaRestauranteForm,
  configurarProductoRestauranteForm,
  crearRecetaRestauranteForm,
} from "@/lib/actions/restaurante-vertical";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function RestauranteRecetasPage() {
  const user = await requireSession();
  await requireModulo(user, "restaurante-recetas");
  const empresa = await getEmpresaMetadata(user.empresaId);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;

  const [productosList, estaciones, unidades, clasificaciones, recetas, ingredientes] =
    await dbConEmpresa(user.empresaId, (tx) =>
      Promise.all([
        tx
          .select({
            id: productos.id,
            nombre: productos.nombre,
            precioBase: productos.precioBase,
            costoPromedio: productos.costoPromedio,
          })
          .from(productos)
          .where(
            and(
              eq(productos.empresaId, user.empresaId),
              eq(productos.activo, true),
              isNull(productos.eliminadoEn),
            ),
          )
          .orderBy(asc(productos.nombre))
          .limit(600),
        tx
          .select()
          .from(restauranteEstaciones)
          .where(eq(restauranteEstaciones.empresaId, user.empresaId))
          .orderBy(asc(restauranteEstaciones.orden), asc(restauranteEstaciones.nombre)),
        tx
          .select({ id: unidadesMedida.id, codigo: unidadesMedida.codigo, nombre: unidadesMedida.nombre })
          .from(unidadesMedida)
          .where(eq(unidadesMedida.empresaId, user.empresaId))
          .orderBy(asc(unidadesMedida.codigo)),
        tx
          .select()
          .from(restauranteProductos)
          .where(eq(restauranteProductos.empresaId, user.empresaId)),
        tx
          .select()
          .from(restauranteRecetas)
          .where(eq(restauranteRecetas.empresaId, user.empresaId))
          .orderBy(asc(restauranteRecetas.nombre)),
        tx
          .select({
            id: restauranteRecetaIngredientes.id,
            recetaId: restauranteRecetaIngredientes.recetaId,
            cantidad: restauranteRecetaIngredientes.cantidad,
            costoUnitario: restauranteRecetaIngredientes.costoUnitario,
            nombre: productos.nombre,
          })
          .from(restauranteRecetaIngredientes)
          .innerJoin(productos, eq(productos.id, restauranteRecetaIngredientes.ingredienteProductoId))
          .where(eq(restauranteRecetaIngredientes.empresaId, user.empresaId))
          .orderBy(asc(productos.nombre)),
      ]),
    );

  const clasificacionPorProducto = new Map(
    clasificaciones.map((row) => [row.productoId, row]),
  );
  const ingredientesPorReceta = new Map<string, typeof ingredientes>();
  for (const ingrediente of ingredientes) {
    const lista = ingredientesPorReceta.get(ingrediente.recetaId) ?? [];
    lista.push(ingrediente);
    ingredientesPorReceta.set(ingrediente.recetaId, lista);
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-label">Insumos, preparaciones y platillos</p>
        <h1 className="mt-1 text-xl">Recetas y food cost</h1>
        <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
          Clasifica productos del inventario y calcula costo por porcion.
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Clasificar producto" />
            <CardBody>
              <form action={configurarProductoRestauranteForm} className="space-y-3">
                <select name="productoId" className="arca-input">
                  {productosList.map((producto) => (
                    <option key={producto.id} value={producto.id}>
                      {producto.nombre}
                    </option>
                  ))}
                </select>
                <select name="tipo" defaultValue="platillo" className="arca-input">
                  <option value="insumo">Insumo</option>
                  <option value="producto_directo">Producto directo</option>
                  <option value="preparacion">Preparacion</option>
                  <option value="platillo">Platillo</option>
                  <option value="combo">Combo</option>
                </select>
                <select name="estacionId" defaultValue="" className="arca-input">
                  <option value="">Estacion automatica</option>
                  {estaciones.map((estacion) => (
                    <option key={estacion.id} value={estacion.id}>
                      {estacion.nombre}
                    </option>
                  ))}
                </select>
                <input name="tiempoPreparacionMin" defaultValue="0" className="arca-input" />
                <input name="alergenos" placeholder="Alergenos separados por coma" className="arca-input" />
                <input name="etiquetas" placeholder="Etiquetas separadas por coma" className="arca-input" />
                <label className="flex items-center gap-2 text-small">
                  <input type="checkbox" name="disponibleQr" defaultChecked />
                  Disponible en QR
                </label>
                <label className="flex items-center gap-2 text-small">
                  <input type="checkbox" name="consumeInventario" defaultChecked />
                  Consume inventario
                </label>
                <button type="submit" className="arca-btn arca-btn-primary w-full">
                  Guardar clasificacion
                </button>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Nueva receta" />
            <CardBody>
              <form action={crearRecetaRestauranteForm} className="space-y-3">
                <select name="productoId" className="arca-input">
                  {productosList.map((producto) => (
                    <option key={producto.id} value={producto.id}>
                      {producto.nombre}
                    </option>
                  ))}
                </select>
                <input name="nombre" placeholder="Hamburguesa clasica" className="arca-input" />
                <select name="tipo" defaultValue="platillo" className="arca-input">
                  <option value="preparacion">Preparacion</option>
                  <option value="platillo">Platillo</option>
                  <option value="combo">Combo</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input name="rendimientoCantidad" defaultValue="1" className="arca-input" />
                  <select name="rendimientoUnidadId" defaultValue="" className="arca-input">
                    <option value="">Unidad base</option>
                    {unidades.map((unidad) => (
                      <option key={unidad.id} value={unidad.id}>
                        {unidad.codigo}
                      </option>
                    ))}
                  </select>
                </div>
                <input name="precioVenta" placeholder="Precio de venta" className="arca-input" />
                <button type="submit" className="arca-btn arca-btn-primary w-full">
                  <Plus size={14} /> Crear receta
                </button>
              </form>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Catalogo restaurante" subtitle={`${clasificaciones.length} productos clasificados`} />
            <CardBody>
              <div className="grid gap-2 md:grid-cols-2">
                {clasificaciones.map((row) => {
                  const producto = productosList.find((p) => p.id === row.productoId);
                  return (
                    <div key={row.id} className="rounded-md bg-[color:var(--color-surface-2)] p-3 text-small">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{producto?.nombre ?? "Producto"}</span>
                        <Badge variant={row.tipo === "insumo" ? "info" : "success"}>{row.tipo}</Badge>
                      </div>
                      <div className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
                        {row.tiempoPreparacionMin} min · QR {row.disponibleQr ? "si" : "no"}
                      </div>
                    </div>
                  );
                })}
                {clasificaciones.length === 0 && (
                  <div className="py-8 text-center text-small text-[color:var(--color-text-muted)] md:col-span-2">
                    Clasifica productos para construir recetas.
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {recetas.map((receta) => (
            <Card key={receta.id}>
              <CardHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    {receta.tipo === "preparacion" ? <FlaskConical size={16} /> : <ReceiptText size={16} />}
                    {receta.nombre}
                  </span>
                }
                subtitle={`Rendimiento ${receta.rendimientoCantidad}`}
                actions={<Badge variant="warning">Food cost {parseFloat(receta.foodCostPct).toFixed(2)}%</Badge>}
              />
              <CardBody className="space-y-4">
                <div className="grid gap-3 text-small sm:grid-cols-3">
                  <Dato label="Costo total" value={formatearMoneda(receta.costoTotal, pais)} />
                  <Dato label="Costo por porcion" value={formatearMoneda(receta.costoPorPorcion, pais)} />
                  <Dato label="Precio venta" value={formatearMoneda(receta.precioVenta, pais)} />
                </div>
                <div className="space-y-2">
                  {(ingredientesPorReceta.get(receta.id) ?? []).map((ingrediente) => (
                    <div key={ingrediente.id} className="flex items-center justify-between gap-3 rounded-md bg-[color:var(--color-surface-2)] px-3 py-2 text-small">
                      <span className="truncate">{ingrediente.nombre}</span>
                      <span>
                        {parseFloat(ingrediente.cantidad).toFixed(4)} ·{" "}
                        {formatearMoneda(ingrediente.costoUnitario, pais)}
                      </span>
                    </div>
                  ))}
                </div>
                <form action={agregarIngredienteRecetaRestauranteForm} className="grid gap-2 md:grid-cols-[1fr_90px_90px_auto]">
                  <input type="hidden" name="recetaId" value={receta.id} />
                  <select name="ingredienteProductoId" className="arca-input">
                    {productosList.map((producto) => (
                      <option key={producto.id} value={producto.id}>
                        {producto.nombre}
                      </option>
                    ))}
                  </select>
                  <input name="cantidad" placeholder="150" className="arca-input" />
                  <input name="costoUnitario" placeholder="0.00" className="arca-input" />
                  <button type="submit" className="arca-btn arca-btn-secondary">
                    Agregar
                  </button>
                </form>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[color:var(--color-surface-2)] p-3">
      <div className="text-label">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
