import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  ChefHat,
  CreditCard,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Table2,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { dbConEmpresa } from "@/lib/db";
import {
  categorias,
  formasPago,
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
  cobrarOrdenRestauranteForm,
  crearOrdenRestauranteForm,
  enviarComandasOrdenRestauranteForm,
  solicitarCuentaRestauranteForm,
} from "@/lib/actions/restaurante-vertical";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { cn, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FormField } from "@/components/ui/FormField";
import { labelItemCocina, notaRestauranteVisible } from "@/lib/restaurante/display";

export const metadata: Metadata = {
  title: "POS Restaurante | ARCA",
  description: "Atencion, comandas y cobro de cuentas de restaurante en ARCA.",
};

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    categoriaId?: string;
    guardado?: string;
    error?: string;
    ordenId?: string;
    ordenNumero?: string;
  }>;
};

export default async function RestaurantePosPage({ searchParams }: PageProps) {
  return restaurantePosPage(searchParams ? await searchParams : {});
}

async function restaurantePosPage(params: {
  q?: string;
  categoriaId?: string;
  guardado?: string;
  error?: string;
  ordenId?: string;
  ordenNumero?: string;
}) {
  const user = await requireSession();
  await requireModulo(user, "restaurante-pos");
  const [scope, empresa] = await Promise.all([
    getSucursalScope(user),
    getEmpresaMetadata(user.empresaId),
  ]);
  const visibles = selectedSucursalIds(scope);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const busqueda = normalizarTexto(params.q);
  const categoriaSeleccionada = params.categoriaId ?? "";

  const [sucursalesList, mesas, ordenes, productosVenta, items, formasPagoList] =
    await dbConEmpresa(user.empresaId, (tx) =>
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
            propina: restauranteOrdenes.propina,
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
          .orderBy(desc(restauranteOrdenes.abiertoEn)),
        tx
          .select({
            id: productos.id,
            nombre: productos.nombre,
            precioBase: productos.precioBase,
            costoPromedio: productos.costoPromedio,
            categoriaId: productos.categoriaId,
            categoriaNombre: categorias.nombre,
            tipoRestaurante: restauranteProductos.tipo,
            tiempoPreparacionMin: restauranteProductos.tiempoPreparacionMin,
            alergenos: restauranteProductos.alergenos,
            etiquetas: restauranteProductos.etiquetas,
          })
          .from(restauranteProductos)
          .innerJoin(productos, eq(productos.id, restauranteProductos.productoId))
          .leftJoin(
            categorias,
            and(
              eq(categorias.id, productos.categoriaId),
              eq(categorias.empresaId, user.empresaId),
            ),
          )
          .where(
            and(
              eq(restauranteProductos.empresaId, user.empresaId),
              inArray(restauranteProductos.tipo, ["platillo", "producto_directo", "combo"]),
              eq(productos.activo, true),
            ),
          )
          .orderBy(asc(categorias.nombre), asc(productos.nombre)),
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
        tx
          .select({
            id: formasPago.id,
            nombre: formasPago.nombre,
            requiereReferencia: formasPago.requiereReferencia,
          })
          .from(formasPago)
          .where(and(eq(formasPago.empresaId, user.empresaId), eq(formasPago.activa, true)))
          .orderBy(asc(formasPago.nombre)),
      ]),
    );

  const categoriasCarta = productosVenta.reduce<{ id: string; nombre: string }[]>(
    (lista, producto) => {
      if (!producto.categoriaId || !producto.categoriaNombre) return lista;
      if (!lista.some((categoria) => categoria.id === producto.categoriaId)) {
        lista.push({ id: producto.categoriaId, nombre: producto.categoriaNombre });
      }
      return lista;
    },
    [],
  );
  const productosConIndice = productosVenta.map((producto) => ({
    ...producto,
    indiceBusqueda: normalizarTexto(
      [producto.nombre, producto.categoriaNombre, producto.etiquetas.join(" ")].join(" "),
    ),
  }));
  const productosFiltrados = productosConIndice.filter((producto) => {
    const coincideCategoria =
      !categoriaSeleccionada || producto.categoriaId === categoriaSeleccionada;
    const coincideBusqueda = !busqueda || producto.indiceBusqueda.includes(busqueda);
    return coincideCategoria && coincideBusqueda;
  });
  const mesaPorId = new Map(mesas.map((mesa) => [mesa.id, mesa]));
  const itemsPorOrden = new Map<string, typeof items>();
  for (const item of items) {
    const lista = itemsPorOrden.get(item.ordenId) ?? [];
    lista.push(item);
    itemsPorOrden.set(item.ordenId, lista);
  }
  const sucursalDefault = sucursalesList[0];
  const tieneSucursales = sucursalesList.length > 0;
  const tieneProductosVenta = productosVenta.length > 0;
  const mesasConOrden = new Set(
    ordenes
      .map((orden) => orden.mesaId)
      .filter((mesaId): mesaId is string => Boolean(mesaId)),
  );
  const mesasParaNuevaOrden = mesas.filter(
    (mesa) => mesa.estado === "disponible" && !mesasConOrden.has(mesa.id),
  );
  const feedback = params.error
    ? { tipo: "error" as const, mensaje: normalizarFeedback(params.error) }
    : params.guardado
      ? { tipo: "success" as const, mensaje: normalizarFeedback(params.guardado) }
      : null;
  const ordenEnfocadaId = params.ordenId ?? "";

  return (
    <div className="space-y-5">
      <header>
        <p className="text-label">{scope.visible ? scope.etiqueta : "Turno actual"}</p>
        <h1 className="mt-1 text-xl">POS Restaurante</h1>
        <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
          Abre mesas, agrega productos de carta, envia cocina y cobra cuentas.
        </p>
      </header>

      {feedback && (
        <div
          role={feedback.tipo === "error" ? "alert" : "status"}
          className={cn(
            "flex flex-col gap-3 rounded-md border px-4 py-3 text-small sm:flex-row sm:items-center sm:justify-between",
            feedback.tipo === "error"
              ? "border-[color:var(--color-error)]/35 bg-[color:var(--color-error-bg)] text-[color:var(--color-error)]"
              : "border-[color:var(--color-success)]/35 bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]",
          )}
        >
          <span className="font-medium">{feedback.mensaje}</span>
          {feedback.tipo === "success" && (
            <span className="flex flex-wrap gap-2">
              {ordenEnfocadaId && (
                <a href={`#orden-${ordenEnfocadaId}`} className="arca-btn arca-btn-ghost arca-btn-sm">
                  Ver orden
                </a>
              )}
              <Link href="/restaurante/ordenes" className="arca-btn arca-btn-ghost arca-btn-sm">
                Historial
              </Link>
            </span>
          )}
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader title="Mesas" subtitle="Estado del salon y apertura rapida" />
          <CardBody>
            {mesas.length === 0 ? (
              <div className="rounded-md border border-dashed border-[color:var(--color-border)] p-8 text-center text-small text-[color:var(--color-text-muted)]">
                Configura tus mesas antes de operar el salon.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {mesas.map((mesa) => {
                  const abierta = ordenes.find((orden) => orden.mesaId === mesa.id);
                  const puedeAbrir = mesa.estado === "disponible" && !abierta;
                  return (
                    <form key={mesa.id} action={crearOrdenRestauranteForm}>
                      <input type="hidden" name="redirectTo" value="/restaurante/pos" />
                      <input type="hidden" name="sucursalId" value={mesa.sucursalId} />
                      <input type="hidden" name="mesaId" value={mesa.id} />
                      <input type="hidden" name="canal" value="salon" />
                      <input type="hidden" name="personas" value={mesa.capacidad} />
                      <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                      <button
                        type="submit"
                        disabled={!puedeAbrir}
                        className={cn(
                          "min-h-32 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 text-left shadow-sm transition hover:border-[color:var(--color-border-strong)] disabled:opacity-70",
                          abierta?.id === ordenEnfocadaId &&
                            "border-[color:var(--color-primary)] ring-2 ring-[color:var(--color-primary)]/35",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{mesa.nombre}</span>
                          <Table2 size={16} className="text-[color:var(--color-secondary)]" />
                        </div>
                        <div className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
                          {mesa.capacidad} personas
                        </div>
                        <div className="mt-3">
                          <Badge variant={abierta ? "warning" : variantEstadoMesa(mesa.estado)}>
                            {abierta ? abierta.numero : labelEstadoMesa(mesa.estado)}
                          </Badge>
                        </div>
                        <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-secondary)]">
                          {puedeAbrir ? "Abrir orden" : abierta ? "Orden abierta" : "No disponible"}
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
            subtitle="Comer en el lugar, para llevar, delivery o pedido web"
          />
          <CardBody>
            <form action={crearOrdenRestauranteForm} className="space-y-3">
              <input type="hidden" name="redirectTo" value="/restaurante/pos" />
              <FormField label="Sucursal">
                <select
                  name="sucursalId"
                  defaultValue={sucursalDefault?.id}
                  disabled={!tieneSucursales}
                  className="arca-input"
                >
                  {sucursalesList.map((sucursal) => (
                    <option key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Canal de atencion">
                <select name="canal" defaultValue="salon" className="arca-input">
                  <option value="salon">Comer en el lugar</option>
                  <option value="para_llevar">Para llevar</option>
                  <option value="delivery_propio">Delivery propio</option>
                  <option value="delivery_externo">Delivery externo</option>
                  <option value="pedido_web">Pedido web</option>
                </select>
              </FormField>
              <FormField
                label="Mesa"
                hint="Opcional para barra, mostrador, delivery o pedidos sin mesa."
              >
                <select
                  name="mesaId"
                  defaultValue=""
                  className="arca-input"
                >
                  <option value="">Sin mesa asignada / barra</option>
                  {mesasParaNuevaOrden.map((mesa) => (
                    <option key={mesa.id} value={mesa.id}>
                      {mesa.nombre} - {mesa.capacidad} pax
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Personas">
                <input
                  name="personas"
                  type="number"
                  min="1"
                  defaultValue="1"
                  className="arca-input"
                />
              </FormField>
              <FormField label="Notas de atencion">
                <input name="notas" className="arca-input" />
              </FormField>
              <input type="hidden" name="idempotencyKey" value={randomUUID()} />
              {!tieneSucursales && (
                <p className="text-[12px] text-[color:var(--color-warning)]">
                  Crea una sucursal antes de abrir ordenes.
                </p>
              )}
              <button type="submit" disabled={!tieneSucursales} className="arca-btn arca-btn-primary w-full">
                <Plus size={14} /> Levantar orden
              </button>
            </form>
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Carta rapida" subtitle={`${productosFiltrados.length} productos disponibles`} />
          <CardBody>
            <form action="/restaurante/pos" className="space-y-3">
              <FormField label="Buscar producto" hint="Nombre, categoria o etiqueta.">
                <div className="relative">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)]"
                  />
                  <input
                    name="q"
                    defaultValue={params.q ?? ""}
                    className="arca-input pl-9"
                  />
                </div>
              </FormField>
              <FormField label="Categoria">
                <select name="categoriaId" defaultValue={categoriaSeleccionada} className="arca-input">
                  <option value="">Todas las categorias</option>
                  {categoriasCarta.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.nombre}
                    </option>
                  ))}
                </select>
              </FormField>
              <div className="grid grid-cols-2 gap-2">
                <button type="submit" className="arca-btn arca-btn-secondary arca-btn-sm justify-center">
                  Filtrar
                </button>
                <Link href="/restaurante/pos" className="arca-btn arca-btn-ghost arca-btn-sm justify-center">
                  Limpiar
                </Link>
              </div>
            </form>
            {!tieneProductosVenta && (
              <div className="mt-4 rounded-md border border-dashed border-[color:var(--color-border)] p-4 text-small text-[color:var(--color-text-muted)]">
                Configura platillos, combos o productos directos para vender en restaurante.
              </div>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          {ordenes.length === 0 ? (
            <Card>
              <CardBody>
                <div className="py-8 text-center text-small text-[color:var(--color-text-muted)]">
                  No hay ordenes abiertas.
                </div>
              </CardBody>
            </Card>
          ) : (
            ordenes.map((orden) => {
              const mesa = orden.mesaId ? mesaPorId.get(orden.mesaId) : null;
              const ordenItems = itemsPorOrden.get(orden.id) ?? [];
              const nuevos = ordenItems.filter((item) => item.estado === "borrador");
              const puedeEnviar = nuevos.length > 0;
              const puedeSolicitarCuenta =
                ordenItems.length > 0 && orden.estado !== "cuenta_solicitada";
              const puedeCobrar = ordenItems.length > 0 && formasPagoList.length > 0;
              return (
                <Card
                  key={orden.id}
                  id={`orden-${orden.id}`}
                  className={cn(
                    orden.id === ordenEnfocadaId &&
                      "border-[color:var(--color-primary)] ring-2 ring-[color:var(--color-primary)]/30",
                  )}
                >
                  <CardHeader
                    title={
                      <span className="inline-flex items-center gap-2">
                        <Receipt size={16} /> {orden.numero}
                      </span>
                    }
                    subtitle={
                      mesa
                        ? `${mesa.nombre} - ${orden.personas} personas`
                        : `${labelCanal(orden.canal)} - ${orden.personas} personas`
                    }
                    actions={<Badge variant={variantEstadoOrden(orden.estado)}>{labelEstadoOrden(orden.estado)}</Badge>}
                  />
                  <CardBody className="space-y-4">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
                      <div className="space-y-2">
                        {ordenItems.map((item) => {
                          const notaVisible = notaRestauranteVisible(item.notasCocina);
                          return (
                            <div
                              key={item.id}
                              className="rounded-md bg-[color:var(--color-surface-2)] px-3 py-2 text-small"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate font-medium">{item.nombreSnapshot}</div>
                                  <div className="text-[11px] text-[color:var(--color-text-muted)]">
                                    {labelItemCocina(item.estado)}
                                  </div>
                                </div>
                                <span>x{parseFloat(item.cantidad).toFixed(0)}</span>
                              </div>
                              {notaVisible && (
                                <p className="mt-1 text-[11px] text-[color:var(--color-text-secondary)]">
                                  {notaVisible}
                                </p>
                              )}
                            </div>
                          );
                        })}
                        {ordenItems.length === 0 && (
                          <div className="rounded-md border border-dashed border-[color:var(--color-border)] px-3 py-4 text-center text-small text-[color:var(--color-text-muted)]">
                            Agrega productos antes de enviar la comanda.
                          </div>
                        )}
                      </div>

                      <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3">
                        <div className="text-label">Total abierto</div>
                        <div className="mt-1 text-lg font-semibold">
                          {formatearMoneda(orden.total, pais)}
                        </div>
                        <div className="mt-3 grid gap-2">
                          <form action={enviarComandasOrdenRestauranteForm}>
                            <input type="hidden" name="redirectTo" value="/restaurante/pos" />
                            <input type="hidden" name="ordenId" value={orden.id} />
                            <button
                              type="submit"
                              disabled={!puedeEnviar}
                              className="arca-btn arca-btn-primary arca-btn-sm w-full justify-center"
                            >
                              <ChefHat size={14} />
                              {puedeEnviar ? "Enviar nuevos" : "Sin nuevos"}
                            </button>
                          </form>
                          <form action={solicitarCuentaRestauranteForm}>
                            <input type="hidden" name="redirectTo" value="/restaurante/pos" />
                            <input type="hidden" name="ordenId" value={orden.id} />
                            <button
                              type="submit"
                              disabled={!puedeSolicitarCuenta}
                              className="arca-btn arca-btn-secondary arca-btn-sm w-full justify-center"
                            >
                              <Receipt size={14} />
                              {orden.estado === "cuenta_solicitada"
                                ? "Cuenta solicitada"
                                : "Solicitar cuenta"}
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-base font-semibold">Agregar de carta</h2>
                          <p className="text-[12px] text-[color:var(--color-text-muted)]">
                            Cada producto entra como item nuevo antes de enviarse a cocina.
                          </p>
                        </div>
                        <ShoppingCart size={17} className="text-[color:var(--color-secondary)]" />
                      </div>
                      {productosFiltrados.length === 0 ? (
                        <div className="rounded-md border border-dashed border-[color:var(--color-border)] p-4 text-small text-[color:var(--color-text-muted)]">
                          No hay productos con ese filtro.
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                          {productosFiltrados.map((producto) => (
                            <form
                              key={`${orden.id}:${producto.id}`}
                              action={agregarItemOrdenRestauranteForm}
                              className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3"
                            >
                              <input type="hidden" name="redirectTo" value="/restaurante/pos" />
                              <input type="hidden" name="ordenId" value={orden.id} />
                              <input type="hidden" name="productoId" value={producto.id} />
                              <input type="hidden" name="precioUnitario" value="0" />
                              <input type="hidden" name="descuento" value="0" />
                              <input type="hidden" name="impuesto" value="0" />
                              <input type="hidden" name="costoUnitario" value="0" />
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="line-clamp-2 font-semibold">{producto.nombre}</div>
                                  <div className="mt-1 text-[11px] text-[color:var(--color-text-muted)]">
                                    {producto.categoriaNombre ?? labelTipoProducto(producto.tipoRestaurante)}
                                  </div>
                                </div>
                                <Badge variant="neutral">
                                  {formatearMoneda(producto.precioBase, pais)}
                                </Badge>
                              </div>
                              {(producto.alergenos.length > 0 || producto.tiempoPreparacionMin > 0) && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {producto.tiempoPreparacionMin > 0 && (
                                    <span className="rounded bg-[color:var(--color-surface-2)] px-2 py-1 text-[11px] text-[color:var(--color-text-muted)]">
                                      {producto.tiempoPreparacionMin} min
                                    </span>
                                  )}
                                  {producto.alergenos.slice(0, 2).map((alergeno) => (
                                    <span
                                      key={alergeno}
                                      className="rounded bg-[color:var(--color-warning)]/15 px-2 py-1 text-[11px] text-[color:var(--color-warning)]"
                                    >
                                      {alergeno}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="mt-3 grid gap-2 sm:grid-cols-[92px_minmax(0,1fr)]">
                                <FormField label="Cantidad">
                                  <input
                                    name="cantidad"
                                    type="number"
                                    min="0.01"
                                    step="1"
                                    defaultValue="1"
                                    className="arca-input h-10"
                                  />
                                </FormField>
                                <FormField label="Notas cocina">
                                  <input name="notasCocina" className="arca-input h-10" />
                                </FormField>
                              </div>
                              <button type="submit" className="arca-btn arca-btn-secondary arca-btn-sm mt-3 w-full justify-center">
                                <Plus size={14} /> Agregar
                              </button>
                            </form>
                          ))}
                        </div>
                      )}
                    </div>

                    <form
                      action={cobrarOrdenRestauranteForm}
                      className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-base font-semibold">Cobrar orden</h2>
                          <p className="text-[12px] text-[color:var(--color-text-muted)]">
                            Crea venta core, detalle y pago; la mesa queda por limpiar.
                          </p>
                        </div>
                        <CreditCard size={17} className="text-[color:var(--color-secondary)]" />
                      </div>
                      <input type="hidden" name="ordenId" value={orden.id} />
                      <input type="hidden" name="redirectTo" value="/restaurante/pos" />
                      <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_auto] md:items-end">
                        <FormField label="Forma de pago">
                          <select
                            name="formaPagoId"
                            disabled={formasPagoList.length === 0}
                            className="arca-input"
                          >
                            {formasPagoList.map((formaPago) => (
                              <option key={formaPago.id} value={formaPago.id}>
                                {formaPago.nombre}
                                {formaPago.requiereReferencia ? " - requiere ref." : ""}
                              </option>
                            ))}
                          </select>
                        </FormField>
                        <FormField label="Propina">
                          <input
                            name="propina"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={orden.propina}
                            className="arca-input"
                          />
                        </FormField>
                        <FormField label="Referencia">
                          <input name="referencia" className="arca-input" />
                        </FormField>
                        <button
                          type="submit"
                          disabled={!puedeCobrar}
                          className="arca-btn arca-btn-primary justify-center"
                        >
                          Cobrar orden
                        </button>
                      </div>
                      {formasPagoList.length === 0 && (
                        <p className="mt-2 text-[12px] text-[color:var(--color-warning)]">
                          Configura una forma de pago activa antes de cobrar.
                        </p>
                      )}
                    </form>
                  </CardBody>
                </Card>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function normalizarTexto(valor?: string | null): string {
  return (valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizarFeedback(valor?: string | null): string {
  const texto = (valor ?? "").trim();
  return texto ? texto.slice(0, 180) : "Operacion procesada.";
}

function labelEstadoMesa(estado: string): string {
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

function variantEstadoMesa(
  estado: string,
): "success" | "warning" | "error" | "info" | "neutral" {
  if (estado === "disponible") return "success";
  if (estado === "ocupada" || estado === "reservada") return "warning";
  if (estado === "por_limpiar") return "error";
  if (estado === "cuenta_solicitada") return "info";
  return "neutral";
}

function labelEstadoOrden(estado: string): string {
  const labels: Record<string, string> = {
    borrador: "Borrador",
    abierta: "Abierta",
    en_cocina: "En cocina",
    cuenta_solicitada: "Cuenta solicitada",
    pagada: "Pagada",
    cancelada: "Cancelada",
  };
  return labels[estado] ?? estado;
}

function variantEstadoOrden(
  estado: string,
): "success" | "warning" | "error" | "info" | "neutral" {
  if (estado === "pagada") return "success";
  if (estado === "en_cocina") return "info";
  if (estado === "cuenta_solicitada") return "warning";
  if (estado === "cancelada") return "error";
  return "neutral";
}

function labelCanal(canal: string): string {
  const labels: Record<string, string> = {
    salon: "Comer en el lugar",
    qr_mesa: "QR mesa",
    para_llevar: "Para llevar",
    delivery_propio: "Delivery propio",
    delivery_externo: "Delivery externo",
    pedido_web: "Pedido web",
  };
  return labels[canal] ?? canal;
}

function labelTipoProducto(tipo: string): string {
  const labels: Record<string, string> = {
    platillo: "Platillo",
    producto_directo: "Producto directo",
    combo: "Combo",
  };
  return labels[tipo] ?? tipo;
}
