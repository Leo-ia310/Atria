import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ChefHat, Plus, Receipt, ShoppingCart, Table2 } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import {
  productos,
  restauranteMesas,
  restauranteOrdenItems,
  restauranteOrdenes,
  restauranteProductos,
  sucursales,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import {
  agregarItemOrdenRestauranteForm,
  crearOrdenRestauranteForm,
  enviarComandasOrdenRestauranteForm,
} from "@/lib/actions/restaurante-vertical";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function RestaurantePosPage() {
  const user = await requireSession();
  await requireModulo(user, "restaurante-pos");
  const [scope, empresa] = await Promise.all([
    getSucursalScope(user),
    getEmpresaMetadata(user.empresaId),
  ]);
  const visibles = selectedSucursalIds(scope);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;

  const [sucursalesList, mesas, ordenes, productosVenta, items] = await dbConEmpresa(
    user.empresaId,
    (tx) =>
      Promise.all([
        tx
          .select({ id: sucursales.id, nombre: sucursales.nombre })
          .from(sucursales)
          .where(
            and(
              eq(sucursales.empresaId, user.empresaId),
              visibles ? inArray(sucursales.id, visibles) : undefined,
            ),
          )
          .orderBy(asc(sucursales.nombre)),
        tx
          .select()
          .from(restauranteMesas)
          .where(
            and(
              eq(restauranteMesas.empresaId, user.empresaId),
              visibles ? inArray(restauranteMesas.sucursalId, visibles) : undefined,
            ),
          )
          .orderBy(asc(restauranteMesas.nombre)),
        tx
          .select({
            id: restauranteOrdenes.id,
            numero: restauranteOrdenes.numero,
            mesaId: restauranteOrdenes.mesaId,
            canal: restauranteOrdenes.canal,
            estado: restauranteOrdenes.estado,
            personas: restauranteOrdenes.personas,
            total: restauranteOrdenes.total,
            abiertoEn: restauranteOrdenes.abiertoEn,
          })
          .from(restauranteOrdenes)
          .where(
            and(
              eq(restauranteOrdenes.empresaId, user.empresaId),
              inArray(restauranteOrdenes.estado, [
                "abierta",
                "borrador",
                "en_cocina",
                "cuenta_solicitada",
              ]),
              visibles ? inArray(restauranteOrdenes.sucursalId, visibles) : undefined,
            ),
          )
          .orderBy(asc(restauranteOrdenes.abiertoEn)),
        tx
          .select({
            id: productos.id,
            nombre: productos.nombre,
            precioBase: productos.precioBase,
            costoPromedio: productos.costoPromedio,
            tipoRestaurante: restauranteProductos.tipo,
          })
          .from(restauranteProductos)
          .innerJoin(productos, eq(productos.id, restauranteProductos.productoId))
          .where(
            and(
              eq(restauranteProductos.empresaId, user.empresaId),
              inArray(restauranteProductos.tipo, ["platillo", "producto_directo", "combo"]),
              eq(productos.activo, true),
            ),
          )
          .orderBy(asc(productos.nombre)),
        tx
          .select()
          .from(restauranteOrdenItems)
          .where(
            and(
              eq(restauranteOrdenItems.empresaId, user.empresaId),
              inArray(
                restauranteOrdenItems.estado,
                ["borrador", "enviado", "preparando", "listo", "entregado"],
              ),
            ),
          )
          .orderBy(asc(restauranteOrdenItems.creadoEn)),
      ]),
  );

  const mesaPorId = new Map(mesas.map((mesa) => [mesa.id, mesa]));
  const itemsPorOrden = new Map<string, typeof items>();
  for (const item of items) {
    const lista = itemsPorOrden.get(item.ordenId) ?? [];
    lista.push(item);
    itemsPorOrden.set(item.ordenId, lista);
  }
  const sucursalDefault = sucursalesList[0];

  return (
    <div className="space-y-5">
      <header>
        <p className="text-label">{scope.visible ? scope.etiqueta : "Turno actual"}</p>
        <h1 className="mt-1 text-xl">POS Restaurante</h1>
        <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
          Abre mesas, agrega productos y envia comandas por estacion.
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader title="Mesas" subtitle="Toca una mesa disponible para abrir orden" />
          <CardBody>
            {mesas.length === 0 ? (
              <div className="rounded-md border border-dashed border-[color:var(--color-border)] p-8 text-center text-small text-[color:var(--color-text-muted)]">
                Configura tus mesas antes de operar el salon.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {mesas.map((mesa) => {
                  const abierta = ordenes.find((orden) => orden.mesaId === mesa.id);
                  const deshabilitada = mesa.estado === "deshabilitada" || Boolean(abierta);
                  return (
                    <form key={mesa.id} action={crearOrdenRestauranteForm}>
                      <input type="hidden" name="sucursalId" value={mesa.sucursalId} />
                      <input type="hidden" name="mesaId" value={mesa.id} />
                      <input type="hidden" name="canal" value="salon" />
                      <input type="hidden" name="personas" value={mesa.capacidad} />
                      <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                      <button
                        type="submit"
                        disabled={deshabilitada}
                        className="min-h-28 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 text-left shadow-sm transition hover:border-[color:var(--color-border-strong)] disabled:opacity-70"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{mesa.nombre}</span>
                          <Table2 size={16} className="text-[color:var(--color-secondary)]" />
                        </div>
                        <div className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
                          {mesa.capacidad} personas
                        </div>
                        <div className="mt-3">
                          <Badge variant={abierta ? "warning" : variantEstado(mesa.estado)}>
                            {abierta ? abierta.numero : labelEstado(mesa.estado)}
                          </Badge>
                        </div>
                      </button>
                    </form>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Nueva orden"
            subtitle="Para llevar, delivery o pedido web"
          />
          <CardBody>
            <form action={crearOrdenRestauranteForm} className="space-y-3">
              <select name="sucursalId" defaultValue={sucursalDefault?.id} className="arca-input">
                {sucursalesList.map((sucursal) => (
                  <option key={sucursal.id} value={sucursal.id}>
                    {sucursal.nombre}
                  </option>
                ))}
              </select>
              <select name="canal" defaultValue="para_llevar" className="arca-input">
                <option value="para_llevar">Para llevar</option>
                <option value="delivery_propio">Delivery propio</option>
                <option value="delivery_externo">Delivery externo</option>
                <option value="pedido_web">Pedido web</option>
              </select>
              <input name="personas" defaultValue="1" className="arca-input" />
              <input name="notas" placeholder="Notas" className="arca-input" />
              <input type="hidden" name="idempotencyKey" value={randomUUID()} />
              <button type="submit" className="arca-btn arca-btn-primary w-full">
                <Plus size={14} /> Crear orden
              </button>
            </form>
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {ordenes.length === 0 ? (
          <Card className="xl:col-span-2">
            <CardBody>
              <div className="py-8 text-center text-small text-[color:var(--color-text-muted)]">
                No hay ordenes abiertas.
              </div>
            </CardBody>
          </Card>
        ) : (
          ordenes.map((orden) => {
            const mesa = orden.mesaId ? mesaPorId.get(orden.mesaId) : null;
            return (
              <Card key={orden.id}>
                <CardHeader
                  title={
                    <span className="inline-flex items-center gap-2">
                      <Receipt size={16} /> {orden.numero}
                    </span>
                  }
                  subtitle={mesa ? `${mesa.nombre} · ${orden.personas} personas` : orden.canal}
                  actions={<Badge variant="warning">{labelOrden(orden.estado)}</Badge>}
                />
                <CardBody className="space-y-4">
                  <div className="space-y-2">
                    {(itemsPorOrden.get(orden.id) ?? []).map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-[color:var(--color-surface-2)] px-3 py-2 text-small">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{item.nombreSnapshot}</div>
                          <div className="text-[11px] text-[color:var(--color-text-muted)]">
                            {item.estado}
                          </div>
                        </div>
                        <span>x{parseFloat(item.cantidad).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>

                  <form action={agregarItemOrdenRestauranteForm} className="grid gap-2 sm:grid-cols-[1fr_72px_auto]">
                    <input type="hidden" name="ordenId" value={orden.id} />
                    <select name="productoId" className="arca-input">
                      {productosVenta.map((producto) => (
                        <option key={producto.id} value={producto.id}>
                          {producto.nombre} · {formatearMoneda(producto.precioBase, pais)}
                        </option>
                      ))}
                    </select>
                    <input name="cantidad" defaultValue="1" className="arca-input" />
                    <button type="submit" className="arca-btn arca-btn-secondary">
                      <ShoppingCart size={14} /> Agregar
                    </button>
                  </form>

                  <div className="flex items-center justify-between gap-3 border-t border-[color:var(--color-border)] pt-3">
                    <div>
                      <div className="text-label">Total abierto</div>
                      <div className="text-lg font-semibold">{formatearMoneda(orden.total, pais)}</div>
                    </div>
                    <form action={enviarComandasOrdenRestauranteForm}>
                      <input type="hidden" name="ordenId" value={orden.id} />
                      <button type="submit" className="arca-btn arca-btn-primary">
                        <ChefHat size={14} /> Enviar comanda
                      </button>
                    </form>
                  </div>
                </CardBody>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}

function labelEstado(estado: string): string {
  const labels: Record<string, string> = {
    disponible: "Disponible",
    ocupada: "Ocupada",
    reservada: "Reservada",
    por_limpiar: "Por limpiar",
    cuenta_solicitada: "Cuenta solicitada",
    deshabilitada: "Deshabilitada",
  };
  return labels[estado] ?? estado;
}

function variantEstado(estado: string): "success" | "warning" | "error" | "info" | "neutral" {
  if (estado === "disponible") return "success";
  if (estado === "ocupada" || estado === "reservada") return "warning";
  if (estado === "por_limpiar") return "error";
  if (estado === "cuenta_solicitada") return "info";
  return "neutral";
}

function labelOrden(estado: string): string {
  const labels: Record<string, string> = {
    borrador: "Borrador",
    abierta: "Abierta",
    en_cocina: "En cocina",
    cuenta_solicitada: "Cuenta solicitada",
  };
  return labels[estado] ?? estado;
}
