import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  ChefHat,
  CreditCard,
  Plus,
  Receipt,
  Search,
  SplitSquareHorizontal,
  UsersRound,
} from "lucide-react";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { dbConEmpresa } from "@/lib/db";
import {
  categorias,
  formasPago,
  productos,
  restauranteComandaItems,
  restauranteComensales,
  restauranteOrdenItems,
  restauranteOrdenes,
  restauranteProductos,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { tienePermiso } from "@/lib/access-control";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import {
  cobrarOrdenRestauranteForm,
  crearOrdenRestauranteForm,
  enviarComandasOrdenRestauranteForm,
  solicitarCuentaRestauranteForm,
} from "@/lib/actions/restaurante-vertical";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { cn, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import { Badge } from "@/components/ui/Badge";
import { notaRestauranteVisible } from "@/lib/restaurante/display";
import { EmptyState } from "@/components/restaurante/pos/EmptyState";
import { EstadoItemBadge } from "@/components/restaurante/pos/EstadoItemBadge";
import { FilaTotal } from "@/components/restaurante/pos/FilaTotal";
import { MiniInfo } from "@/components/restaurante/pos/MiniInfo";
import { ModalFrame } from "@/components/restaurante/pos/ModalFrame";
import { Panel } from "@/components/restaurante/pos/Panel";
import { ProductoButton } from "@/components/restaurante/pos/ProductoButton";
import type { OrdenItemPos, ProductoPos } from "@/components/restaurante/pos/types";
import {
  cantidadSinCeros,
  estadoItemMesero,
  labelCanal,
  labelEstadoOrden,
  minutosDesde,
  normalizarFeedback,
  normalizarTexto,
  prioridadEstadoCocina,
  totalItem,
  totalNumero,
  variantEstadoOrden,
} from "@/components/restaurante/pos/utils";

export const metadata: Metadata = {
  title: "POS Restaurante | ARCA",
  description: "POS de meseros para mesas, comandas y cobro conectado a ARCA.",
};

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    categoriaId?: string;
    guardado?: string;
    error?: string;
    ordenId?: string;
    ordenNumero?: string;
    cuenta?: string;
  }>;
};

type ParamsPos = Awaited<NonNullable<PageProps["searchParams"]>>;
export default async function RestaurantePosPage({ searchParams }: PageProps) {
  return restaurantePosPage(searchParams ? await searchParams : {});
}

async function restaurantePosPage(params: ParamsPos) {
  const user = await requireSession();
  const access = await requireModulo(user, "restaurante-pos");
  const [scope, empresa] = await Promise.all([
    getSucursalScope(user),
    getEmpresaMetadata(user.empresaId),
  ]);
  const visibles = selectedSucursalIds(scope);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const busqueda = normalizarTexto(params.q);
  const categoriaSeleccionada = params.categoriaId ?? "";
  const puedeAbrirOrden = tienePermiso(access, "restaurante.ordenes.crear");
  const puedeEditarOrden = tienePermiso(access, "restaurante.ordenes.editar");
  const puedeEnviarCocina = tienePermiso(access, "restaurante.comandas.enviar");
  const puedeCobrar = tienePermiso(access, "ventas.crear");

  const [ordenes, productosVentaBase, formasPagoList] = await dbConEmpresa(user.empresaId, (tx) =>
    Promise.all([
      tx
        .select({
          id: restauranteOrdenes.id,
          numero: restauranteOrdenes.numero,
          mesaId: restauranteOrdenes.mesaId,
          canal: restauranteOrdenes.canal,
          estado: restauranteOrdenes.estado,
          personas: restauranteOrdenes.personas,
          subtotal: restauranteOrdenes.subtotal,
          descuento: restauranteOrdenes.descuento,
          impuesto: restauranteOrdenes.impuesto,
          propina: restauranteOrdenes.propina,
          total: restauranteOrdenes.total,
          abiertoEn: restauranteOrdenes.abiertoEn,
          sucursalId: restauranteOrdenes.sucursalId,
          comensalNombre: restauranteComensales.nombre,
          comensalAlergias: restauranteComensales.alergias,
        })
        .from(restauranteOrdenes)
        .leftJoin(restauranteComensales, eq(restauranteComensales.id, restauranteOrdenes.comensalId))
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

  const ordenIds = ordenes.map((orden) => orden.id);
  const items =
    ordenIds.length > 0
      ? await dbConEmpresa(user.empresaId, (tx) =>
          tx
            .select({
              id: restauranteOrdenItems.id,
              ordenId: restauranteOrdenItems.ordenId,
              productoId: restauranteOrdenItems.productoId,
              nombreSnapshot: restauranteOrdenItems.nombreSnapshot,
              cantidad: restauranteOrdenItems.cantidad,
              precioUnitario: restauranteOrdenItems.precioUnitario,
              descuento: restauranteOrdenItems.descuento,
              impuesto: restauranteOrdenItems.impuesto,
              estado: restauranteOrdenItems.estado,
              notasCocina: restauranteOrdenItems.notasCocina,
            })
            .from(restauranteOrdenItems)
            .where(
              and(
                eq(restauranteOrdenItems.empresaId, user.empresaId),
                inArray(restauranteOrdenItems.ordenId, ordenIds),
                ne(restauranteOrdenItems.estado, "cancelado"),
              ),
            )
            .orderBy(asc(restauranteOrdenItems.creadoEn)),
        )
      : [];
  const itemIds = items.map((item) => item.id);
  const estadosComandaItems =
    itemIds.length > 0
      ? await dbConEmpresa(user.empresaId, (tx) =>
          tx
            .select({
              ordenItemId: restauranteComandaItems.ordenItemId,
              estado: restauranteComandaItems.estado,
            })
            .from(restauranteComandaItems)
            .where(
              and(
                eq(restauranteComandaItems.empresaId, user.empresaId),
                inArray(restauranteComandaItems.ordenItemId, itemIds),
              ),
            ),
        )
      : [];

  const productosVenta: ProductoPos[] = productosVentaBase.map((producto) => ({
    ...producto,
    alergenos: producto.alergenos ?? [],
    etiquetas: producto.etiquetas ?? [],
    indiceBusqueda: normalizarTexto(
      [
        producto.nombre,
        producto.categoriaNombre,
        ...(producto.etiquetas ?? []),
        ...(producto.alergenos ?? []),
      ].join(" "),
    ),
  }));
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
  const productosFiltrados = productosVenta.filter((producto) => {
    const coincideCategoria =
      !categoriaSeleccionada || producto.categoriaId === categoriaSeleccionada;
    const coincideBusqueda = !busqueda || producto.indiceBusqueda.includes(busqueda);
    return coincideCategoria && coincideBusqueda;
  });

  const itemsPorOrden = new Map<string, OrdenItemPos[]>();
  for (const item of items) {
    const lista = itemsPorOrden.get(item.ordenId) ?? [];
    lista.push(item);
    itemsPorOrden.set(item.ordenId, lista);
  }
  const estadoKdsPorItem = new Map<string, string>();
  for (const item of estadosComandaItems) {
    const actual = estadoKdsPorItem.get(item.ordenItemId);
    if (!actual || prioridadEstadoCocina(item.estado) > prioridadEstadoCocina(actual)) {
      estadoKdsPorItem.set(item.ordenItemId, item.estado);
    }
  }

  const ordenActiva =
    ordenes.find((orden) => orden.id === params.ordenId) ??
    ordenes.find((orden) => orden.estado !== "cuenta_solicitada") ??
    ordenes[0] ??
    null;
  const itemsOrdenActiva = ordenActiva ? itemsPorOrden.get(ordenActiva.id) ?? [] : [];
  const nuevosOrdenActiva = itemsOrdenActiva.filter((item) => item.estado === "borrador");
  const sucursalNuevaOrdenId = ordenActiva?.sucursalId ?? visibles?.[0] ?? scope.sucursalIds[0] ?? "";
  const mostrarCuenta = Boolean(ordenActiva && params.cuenta === "1");
  const feedback = params.error
    ? { tipo: "error" as const, mensaje: normalizarFeedback(params.error) }
    : params.guardado
      ? { tipo: "success" as const, mensaje: normalizarFeedback(params.guardado) }
      : null;

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-label">{scope.visible ? scope.etiqueta : "Turno actual"}</p>
          <h1 className="mt-1 text-xl">POS Restaurante</h1>
          <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
            Carta y orden actual en una sola pantalla.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {puedeAbrirOrden && (
            <form action={crearOrdenRestauranteForm}>
              <input type="hidden" name="redirectTo" value="/restaurante/pos" />
              <input type="hidden" name="sucursalId" value={sucursalNuevaOrdenId} />
              <input type="hidden" name="canal" value="salon" />
              <input type="hidden" name="personas" value="1" />
              <input type="hidden" name="idempotencyKey" value={randomUUID()} />
              <button
                type="submit"
                disabled={!sucursalNuevaOrdenId}
                className="arca-btn arca-btn-primary arca-btn-sm shrink-0"
              >
                <Plus size={14} /> Nueva orden
              </button>
            </form>
          )}
          <Link href="/restaurante/kds" className="arca-btn arca-btn-ghost arca-btn-sm shrink-0">
            <ChefHat size={14} /> KDS
          </Link>
          <Link href="/restaurante/ordenes" className="arca-btn arca-btn-ghost arca-btn-sm shrink-0">
            <Receipt size={14} /> Ordenes
          </Link>
        </div>
      </header>

      {feedback && (
        <div
          role={feedback.tipo === "error" ? "alert" : "status"}
          className={cn(
            "rounded-md border px-4 py-3 text-small font-medium",
            feedback.tipo === "error"
              ? "border-[color:var(--color-error)]/35 bg-[color:var(--color-error-bg)] text-[color:var(--color-error)]"
              : "border-[color:var(--color-success)]/35 bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]",
          )}
        >
          {feedback.mensaje}
        </div>
      )}

      <section className="grid min-h-[calc(100vh-210px)] gap-4 xl:grid-cols-[minmax(340px,0.85fr)_minmax(0,1.75fr)] xl:items-start">
        <Panel title="Productos" subtitle={`${productosFiltrados.length} disponibles`} className="xl:col-start-2 xl:row-start-1">
          <form method="get" action="/restaurante/pos" className="space-y-3">
            {ordenActiva && <input type="hidden" name="ordenId" value={ordenActiva.id} />}
            {categoriaSeleccionada && (
              <input type="hidden" name="categoriaId" value={categoriaSeleccionada} />
            )}
            <label htmlFor="pos-restaurante-busqueda" className="sr-only">
              Buscar producto
            </label>
            <div className="relative">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)]"
              />
              <input
                id="pos-restaurante-busqueda"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Buscar producto..."
                className="arca-input h-12 pl-10 text-base"
              />
            </div>
          </form>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <Link
              href={hrefPos(params, { categoriaId: undefined })}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-md border px-3 py-2 text-small font-medium",
                !categoriaSeleccionada
                  ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-white"
                  : "border-[color:var(--color-border)] bg-[color:var(--color-surface)]",
              )}
            >
              Todos
            </Link>
            {categoriasCarta.map((categoria) => (
              <Link
                key={categoria.id}
                href={hrefPos(params, { categoriaId: categoria.id })}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-md border px-3 py-2 text-small font-medium",
                  categoriaSeleccionada === categoria.id
                    ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-white"
                    : "border-[color:var(--color-border)] bg-[color:var(--color-surface)]",
                )}
              >
                {categoria.nombre}
              </Link>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {productosFiltrados.map((producto) => (
              <ProductoButton
                key={producto.id}
                producto={producto}
                orden={ordenActiva}
                pais={pais}
                puedeEditar={puedeEditarOrden}
              />
            ))}
          </div>
          {productosFiltrados.length === 0 && (
            <div className="mt-4">
              <EmptyState>No hay productos con ese filtro.</EmptyState>
            </div>
          )}
        </Panel>

        <aside className="xl:col-start-1 xl:row-start-1 xl:sticky xl:top-4 xl:self-start">
          <Panel title="Orden actual" subtitle={ordenActiva ? ordenActiva.numero : "Sin orden"}>
            {!ordenActiva ? (
              <EmptyState>Crea una orden nueva para empezar.</EmptyState>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">
                        {labelCanal(ordenActiva.canal)}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[color:var(--color-text-muted)]">
                        <span className="inline-flex items-center gap-1">
                          <UsersRound size={13} /> {ordenActiva.personas} personas
                        </span>
                        <span>{minutosDesde(ordenActiva.abiertoEn)} min</span>
                      </div>
                    </div>
                    <Badge variant={variantEstadoOrden(ordenActiva.estado)}>
                      {labelEstadoOrden(ordenActiva.estado)}
                    </Badge>
                  </div>
                  {ordenActiva.comensalAlergias && (
                    <div className="mt-3 rounded-md border border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/10 px-3 py-2 text-[12px] font-medium text-[color:var(--color-warning)]">
                      <AlertTriangle size={13} className="mr-1 inline" />
                      Alergia: {ordenActiva.comensalAlergias}
                    </div>
                  )}
                </div>

                <div className="max-h-[38vh] space-y-2 overflow-y-auto pr-1">
                  {itemsOrdenActiva.map((item) => {
                    const estado = estadoItemMesero(item, estadoKdsPorItem.get(item.id));
                    return (
                      <div
                        key={item.id}
                        className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold">
                              {cantidadSinCeros(item)}x {item.nombreSnapshot}
                            </div>
                            <EstadoItemBadge estado={estado} />
                          </div>
                          <div className="text-right text-small font-semibold">
                            {formatearMoneda(totalItem(item), pais)}
                          </div>
                        </div>
                        {notaRestauranteVisible(item.notasCocina) && (
                          <p className="mt-2 whitespace-pre-line text-[12px] text-[color:var(--color-text-muted)]">
                            {notaRestauranteVisible(item.notasCocina)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  {itemsOrdenActiva.length === 0 && (
                    <EmptyState>Agrega productos antes de enviar a cocina.</EmptyState>
                  )}
                </div>

                <div className="space-y-1 border-t border-[color:var(--color-border)] pt-3 text-small">
                  <FilaTotal label="Subtotal" value={formatearMoneda(ordenActiva.subtotal, pais)} />
                  {parseFloat(ordenActiva.descuento) > 0 && (
                    <FilaTotal label="Descuentos" value={`-${formatearMoneda(ordenActiva.descuento, pais)}`} />
                  )}
                  {parseFloat(ordenActiva.impuesto) > 0 && (
                    <FilaTotal label="Impuestos" value={formatearMoneda(ordenActiva.impuesto, pais)} />
                  )}
                  <FilaTotal
                    label="Total"
                    value={formatearMoneda(ordenActiva.total, pais)}
                    fuerte
                  />
                </div>

                <div className="grid gap-2">
                  <form action={enviarComandasOrdenRestauranteForm}>
                    <input type="hidden" name="redirectTo" value="/restaurante/pos" />
                    <input type="hidden" name="ordenId" value={ordenActiva.id} />
                    <button
                      type="submit"
                      disabled={!puedeEnviarCocina || nuevosOrdenActiva.length === 0}
                      className="arca-btn arca-btn-primary h-12 w-full justify-center"
                    >
                      <ChefHat size={17} />
                      {nuevosOrdenActiva.length > 0 ? "Enviar a cocina" : "Sin nuevos"}
                    </button>
                  </form>
                  <div className="grid gap-2">
                    <Link
                      href={hrefPos(params, {
                        ordenId: ordenActiva.id,
                        cuenta: "1",
                      })}
                      className="arca-btn arca-btn-secondary h-11 justify-center"
                    >
                      <Receipt size={15} /> Cuenta
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </Panel>
        </aside>
      </section>

      {ordenActiva && mostrarCuenta && (
        <ModalFrame
          title="Cuenta"
          subtitle={`${ordenActiva.numero} - ${ordenActiva.personas} personas`}
          closeHref={hrefPos(params, { cuenta: undefined })}
        >
          <div className="space-y-4">
            <div className="rounded-md bg-[color:var(--color-surface-2)] p-3">
              <FilaTotal label="Subtotal" value={formatearMoneda(ordenActiva.subtotal, pais)} />
              <FilaTotal label="Descuentos" value={formatearMoneda(ordenActiva.descuento, pais)} />
              <FilaTotal label="Impuestos" value={formatearMoneda(ordenActiva.impuesto, pais)} />
              <FilaTotal label="Total" value={formatearMoneda(ordenActiva.total, pais)} fuerte />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <MiniInfo
                icon={<SplitSquareHorizontal size={15} />}
                label="Dividir igual"
                value={formatearMoneda(totalNumero(ordenActiva.total) / Math.max(1, ordenActiva.personas), pais)}
              />
              <MiniInfo
                icon={<Receipt size={15} />}
                label="Por productos"
                value={`${itemsOrdenActiva.length} items`}
              />
            </div>

            <form action={solicitarCuentaRestauranteForm}>
              <input type="hidden" name="redirectTo" value="/restaurante/pos" />
              <input type="hidden" name="ordenId" value={ordenActiva.id} />
              <button
                type="submit"
                disabled={!puedeEditarOrden || itemsOrdenActiva.length === 0}
                className="arca-btn arca-btn-secondary h-12 w-full justify-center"
              >
                <Bell size={16} />
                {ordenActiva.estado === "cuenta_solicitada" ? "Cuenta solicitada" : "Solicitar cuenta"}
              </button>
            </form>

            {puedeCobrar && (
              <form action={cobrarOrdenRestauranteForm} className="space-y-3 border-t border-[color:var(--color-border)] pt-4">
                <input type="hidden" name="redirectTo" value="/restaurante/pos" />
                <input type="hidden" name="ordenId" value={ordenActiva.id} />
                <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                <label className="block">
                  <span className="text-label">Metodo</span>
                  <select
                    name="formaPagoId"
                    disabled={formasPagoList.length === 0}
                    className="arca-input mt-1 h-12"
                  >
                    {formasPagoList.map((formaPago) => (
                      <option key={formaPago.id} value={formaPago.id}>
                        {formaPago.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-label">Recibido</span>
                    <input
                      name="montoRecibido"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={totalNumero(ordenActiva.total).toFixed(2)}
                      className="arca-input mt-1 h-12"
                    />
                  </label>
                  <label className="block">
                    <span className="text-label">Propina</span>
                    <input
                      name="propina"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={ordenActiva.propina}
                      className="arca-input mt-1 h-12"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-label">Referencia</span>
                  <input name="referencia" className="arca-input mt-1 h-12" />
                </label>
                <button
                  type="submit"
                  disabled={formasPagoList.length === 0 || itemsOrdenActiva.length === 0}
                  className="arca-btn arca-btn-primary h-12 w-full justify-center"
                >
                  <CreditCard size={16} /> Cobrar
                </button>
                {formasPagoList.length === 0 && (
                  <p className="text-[12px] text-[color:var(--color-warning)]">
                    Configura una forma de pago activa antes de cobrar.
                  </p>
                )}
              </form>
            )}

            {!puedeCobrar && (
              <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-small text-[color:var(--color-text-muted)]">
                El cajero puede cobrar esta cuenta desde ARCA.
              </div>
            )}
          </div>
        </ModalFrame>
      )}
    </div>
  );
}

function hrefPos(params: ParamsPos, overrides: Partial<ParamsPos>): string {
  const merged: Partial<ParamsPos> = {
    q: params.q,
    categoriaId: params.categoriaId,
    ordenId: params.ordenId,
    cuenta: params.cuenta,
    ...overrides,
  };
  const qs = new URLSearchParams();
  for (const key of ["q", "categoriaId", "ordenId", "cuenta"] as const) {
    const value = merged[key];
    if (value) qs.set(key, value);
  }
  const query = qs.toString();
  return query ? `/restaurante/pos?${query}` : "/restaurante/pos";
}
