import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { ArrowLeft, ExternalLink, Plus, Sparkles, Utensils } from "lucide-react";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  almacenes,
  existencias,
  menuPlatillos,
  menuPromociones,
  menuSecciones,
  menusVirtuales,
  productos,
  sucursales,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getAccessContext, requireModulo } from "@/lib/server-access";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import {
  actualizarDisponibilidadPlatillo,
  actualizarMenuVirtual,
  crearMenuPlatillo,
  crearMenuPlatilloDesdeProducto,
  crearMenuPromocion,
  crearMenuSeccion,
} from "@/lib/actions/restaurante";
import {
  DIAS_SEMANA,
  formatearDiasSemana,
  getMenuMesaUrl,
  getMenuPublicUrl,
} from "@/lib/restaurante/menu-utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { MenuMesaQrsCard } from "@/components/restaurante/MenuMesaQrsCard";
import { MenuQrCard } from "@/components/restaurante/MenuQrCard";
import { desdeDecimal, formatearMoneda } from "@/lib/utils";

type MenuVirtualDetallePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
};

export default async function MenuVirtualDetallePage(props: MenuVirtualDetallePageProps) {
  const [{ id }, sp, user, headerStore] = await Promise.all([
    props.params,
    props.searchParams,
    requireSession(),
    headers(),
  ]);
  const access = await getAccessContext(user);
  const pathname = headerStore.get("x-arca-pathname") ?? "";
  if (
    pathname.startsWith("/menu-virtual") &&
    (access.verticalEmpresa === "restaurante" || access.tipoEmpresa === "restaurante")
  ) {
    redirect(`/restaurante/menu/${id}`);
  }
  await requireModulo(user, "menu-virtual");

  const [empresa, menuRows, sucursalesEmpresa] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    db
      .select()
      .from(menusVirtuales)
      .where(and(eq(menusVirtuales.id, id), eq(menusVirtuales.empresaId, user.empresaId)))
      .limit(1),
    db
      .select({
        id: sucursales.id,
        nombre: sucursales.nombre,
        esPrincipal: sucursales.esPrincipal,
      })
      .from(sucursales)
      .where(
        and(
          eq(sucursales.empresaId, user.empresaId),
          eq(sucursales.activa, true),
          isNull(sucursales.eliminadoEn),
        ),
      )
      .orderBy(sql`${sucursales.esPrincipal} desc`, asc(sucursales.nombre)),
  ]);
  const menu = menuRows[0];
  if (!menu) notFound();
  const sucursalPedidoId =
    menu.sucursalId ?? sucursalesEmpresa.find((sucursal) => sucursal.esPrincipal)?.id ?? sucursalesEmpresa[0]?.id ?? null;

  const [secciones, platillos, promos, productosInventario, stockRows] = await Promise.all([
    db
      .select()
      .from(menuSecciones)
      .where(and(eq(menuSecciones.menuId, id), eq(menuSecciones.empresaId, user.empresaId)))
      .orderBy(asc(menuSecciones.orden), asc(menuSecciones.nombre)),
    db
      .select()
      .from(menuPlatillos)
      .where(and(eq(menuPlatillos.menuId, id), eq(menuPlatillos.empresaId, user.empresaId)))
      .orderBy(asc(menuPlatillos.orden), asc(menuPlatillos.nombre)),
    db
      .select()
      .from(menuPromociones)
      .where(and(eq(menuPromociones.menuId, id), eq(menuPromociones.empresaId, user.empresaId)))
      .orderBy(asc(menuPromociones.nombre)),
    db
      .select({
        id: productos.id,
        sku: productos.sku,
        nombre: productos.nombre,
        tipo: productos.tipo,
        precioBase: productos.precioBase,
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
      .limit(500),
    db
      .select({
        productoId: existencias.productoId,
        cantidad: sql<string>`COALESCE(SUM(${existencias.cantidad}), 0)`,
      })
      .from(existencias)
      .innerJoin(almacenes, eq(almacenes.id, existencias.almacenId))
      .where(
        and(
          eq(existencias.empresaId, user.empresaId),
          eq(almacenes.empresaId, user.empresaId),
          sucursalPedidoId ? eq(almacenes.sucursalId, sucursalPedidoId) : undefined,
          eq(almacenes.activo, true),
        ),
      )
      .groupBy(existencias.productoId),
  ]);

  const publicUrl = getMenuPublicUrl(menu.slug);
  const qrDataUrl = await QRCode.toDataURL(publicUrl, {
    width: 640,
    margin: 1,
    color: {
      dark: "#111827",
      light: "#ffffff",
    },
  });
  const mesasQr = await Promise.all(
    Array.from({ length: menu.cantidadMesas }, async (_, index) => {
      const mesaNumero = index + 1;
      const url = getMenuMesaUrl(menu.slug, mesaNumero);
      return {
        mesaNumero,
        url,
        qrDataUrl: await QRCode.toDataURL(url, {
          width: 480,
          margin: 1,
          color: {
            dark: "#111827",
            light: "#ffffff",
          },
        }),
      };
    }),
  );
  const pais = empresa?.pais ?? "NI";
  const seccionOptions = [
    { value: "", label: "Sin seccion" },
    ...secciones.map((s) => ({ value: s.id, label: s.nombre })),
  ];
  const sucursalOptions = [
    { value: "", label: "Sucursal principal automatica" },
    ...sucursalesEmpresa.map((sucursal) => ({
      value: sucursal.id,
      label: sucursal.esPrincipal ? `${sucursal.nombre} (principal)` : sucursal.nombre,
    })),
  ];
  const platilloOptions = [
    { value: "", label: "Toda la carta" },
    ...platillos.map((p) => ({ value: p.id, label: p.nombre })),
  ];
  const stockPorProducto = new Map(
    stockRows.map((stock) => [stock.productoId, parseFloat(stock.cantidad)]),
  );
  const productoPorId = new Map(productosInventario.map((producto) => [producto.id, producto]));
  const sucursalStockLabel =
    sucursalesEmpresa.find((sucursal) => sucursal.id === sucursalPedidoId)?.nombre ?? "sucursal principal";
  const productoOptions = [
    { value: "", label: "Selecciona un producto" },
    ...productosInventario.map((producto) => {
      const stock =
        producto.tipo === "servicio"
          ? "Servicio"
          : `Stock ${stockPorProducto.get(producto.id)?.toFixed(2) ?? "0.00"}`;
      return {
        value: producto.id,
        label: `${producto.sku} - ${producto.nombre} (${stock})`,
      };
    }),
  ];

  return (
    <div>
      <PageHeader
        title={menu.nombre}
        subtitle="Administra el menu, agrega platillos y programa promociones temporales."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/restaurante/menu" className="arca-btn arca-btn-ghost arca-btn-sm">
              <ArrowLeft size={14} /> Menus
            </Link>
            <Link href={`/${menu.slug}`} target="_blank" className="arca-btn arca-btn-secondary arca-btn-sm">
              <ExternalLink size={14} /> Ver publico
            </Link>
          </div>
        }
      />

      {(sp.error || sp.guardado) && (
        <div
          className={
            sp.error
              ? "mb-4 rounded-md bg-[color:var(--color-error-bg)] px-3 py-2 text-small text-[color:var(--color-error)]"
              : "mb-4 rounded-md bg-[color:var(--color-success)]/10 px-3 py-2 text-small text-[color:var(--color-success)]"
          }
        >
          {sp.error ?? "Cambios guardados."}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Ajustes y personalizacion" subtitle="Logo, colores, redes, telefono y animaciones del menu publico." />
            <CardBody>
              <form action={actualizarMenuVirtual} className="grid gap-4 lg:grid-cols-2">
                <input type="hidden" name="menuId" value={menu.id} />
                <Input name="nombre" label="Nombre" defaultValue={menu.nombre} required />
                <Input name="slug" label="Link" defaultValue={menu.slug} required hint={`Quedara como ${publicUrl}`} />
                <div className="lg:col-span-2">
                  <label className="text-label mb-1.5 block" htmlFor="descripcion">
                    Descripcion
                  </label>
                  <textarea
                    id="descripcion"
                    name="descripcion"
                    defaultValue={menu.descripcion ?? ""}
                    className="arca-input min-h-20"
                    placeholder="Describe el tipo de comida, horarios o ambiente."
                  />
                </div>
                <Select
                  name="plantilla"
                  label="Plantilla"
                  defaultValue={menu.plantilla}
                  options={[
                    { value: "bistro", label: "Bistro elegante" },
                    { value: "minimal", label: "Minimal limpio" },
                    { value: "fiesta", label: "Fiesta colorida" },
                  ]}
                />
                <Select
                  name="sucursalId"
                  label="Sucursal de pedidos"
                  defaultValue={menu.sucursalId ?? ""}
                  options={sucursalOptions}
                  hint="El menu publico revisa inventario y manda pedidos a esta sucursal."
                />
                <Input
                  name="cantidadMesas"
                  label="Mesas con QR"
                  type="number"
                  min="0"
                  max="200"
                  step="1"
                  defaultValue={menu.cantidadMesas}
                  hint="Genera un QR individual por cada mesa."
                />
                <Input name="logoUrl" label="Logo URL" defaultValue={menu.logoUrl ?? ""} placeholder="https://..." />
                <ColorInput name="colorPrimario" label="Color principal" value={menu.colorPrimario} />
                <ColorInput name="colorSecundario" label="Color acento" value={menu.colorSecundario} />
                <ColorInput name="colorFondo" label="Color fondo" value={menu.colorFondo} />
                <Input name="telefono" label="Telefono" defaultValue={menu.telefono ?? ""} />
                <Input name="whatsapp" label="WhatsApp" defaultValue={menu.whatsapp ?? ""} />
                <Input name="instagramUrl" label="Instagram URL" defaultValue={menu.instagramUrl ?? ""} />
                <Input name="facebookUrl" label="Facebook URL" defaultValue={menu.facebookUrl ?? ""} />
                <Input name="tiktokUrl" label="TikTok URL" defaultValue={menu.tiktokUrl ?? ""} />
                <Input name="sitioWebUrl" label="Sitio web URL" defaultValue={menu.sitioWebUrl ?? ""} />
                <div className="flex flex-wrap gap-4 lg:col-span-2">
                  <label className="flex items-center gap-2 text-small text-[color:var(--color-text-primary)]">
                    <input type="checkbox" name="animaciones" defaultChecked={menu.animaciones} />
                    Animaciones de entrada
                  </label>
                  <label className="flex items-center gap-2 text-small text-[color:var(--color-text-primary)]">
                    <input type="checkbox" name="publicado" defaultChecked={menu.publicado} />
                    Publicado
                  </label>
                </div>
                <div className="lg:col-span-2">
                  <Button type="submit">Guardar ajustes</Button>
                </div>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Secciones" subtitle="Agrupa el menu en entradas, platos fuertes, bebidas o postres." />
            <CardBody>
              <form action={crearMenuSeccion} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <input type="hidden" name="menuId" value={menu.id} />
                <Input name="nombre" label="Nombre" placeholder="Entradas" required />
                <Input name="descripcion" label="Descripcion" placeholder="Opcional" />
                <div className="self-end">
                  <Button type="submit" className="w-full">
                    <Plus size={14} /> Agregar
                  </Button>
                </div>
              </form>
              <div className="mt-4 flex flex-wrap gap-2">
                {secciones.length === 0 ? (
                  <span className="text-small text-[color:var(--color-text-muted)]">
                    Todavia no hay secciones.
                  </span>
                ) : (
                  secciones.map((seccion) => (
                    <Badge key={seccion.id} variant="info">
                      {seccion.nombre}
                    </Badge>
                  ))
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Platillos"
              subtitle={`Agrega desde inventario o crea platillos manuales. Stock mostrado: ${sucursalStockLabel}.`}
            />
            <CardBody>
              <form
                action={crearMenuPlatilloDesdeProducto}
                className="mb-5 grid gap-3 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-4 lg:grid-cols-[minmax(0,1fr)_220px_auto]"
              >
                <input type="hidden" name="menuId" value={menu.id} />
                <Select
                  name="productoId"
                  label="Agregar desde inventario"
                  options={productoOptions}
                  required
                  hint={`${productosInventario.length} productos activos encontrados.`}
                />
                <Select name="seccionId" label="Seccion" options={seccionOptions} />
                <div className="self-end">
                  <Button type="submit" className="w-full">
                    <Plus size={14} /> Agregar producto
                  </Button>
                </div>
              </form>

              <form action={crearMenuPlatillo} className="grid gap-4 lg:grid-cols-2">
                <input type="hidden" name="menuId" value={menu.id} />
                <Select name="productoId" label="Producto ligado" options={productoOptions} />
                <Input name="nombre" label="Platillo" placeholder="Tacos de birria" required />
                <Select name="seccionId" label="Seccion" options={seccionOptions} />
                <div className="lg:col-span-2">
                  <label className="text-label mb-1.5 block" htmlFor="platilloDescripcion">
                    Descripcion
                  </label>
                  <textarea
                    id="platilloDescripcion"
                    name="descripcion"
                    className="arca-input min-h-20"
                    placeholder="Ingredientes, acompanamientos, nivel de picante..."
                  />
                </div>
                <Input name="precio" label="Precio" type="number" min="0" step="0.01" required />
                <Input name="precioOferta" label="Precio oferta fijo" type="number" min="0" step="0.01" />
                <Input name="etiquetaOferta" label="Etiqueta oferta" placeholder="2x1, Especial del chef..." />
                <Input name="imagenUrl" label="Foto URL" placeholder="https://..." />
                <div className="flex flex-wrap gap-4 lg:col-span-2">
                  <label className="flex items-center gap-2 text-small text-[color:var(--color-text-primary)]">
                    <input type="checkbox" name="destacado" />
                    Destacado
                  </label>
                  <label className="flex items-center gap-2 text-small text-[color:var(--color-text-primary)]">
                    <input type="checkbox" name="disponible" defaultChecked />
                    Disponible
                  </label>
                </div>
                <div className="lg:col-span-2">
                  <Button type="submit">
                    <Plus size={14} /> Agregar platillo
                  </Button>
                </div>
              </form>

              <div className="mt-6 divide-y divide-[color:var(--color-border)]">
                {platillos.length === 0 ? (
                  <div className="py-8 text-center text-small text-[color:var(--color-text-muted)]">
                    No hay platillos. Agrega el primero para llenar el menu publico.
                  </div>
                ) : (
                  platillos.map((platillo) => {
                    const seccion = secciones.find((s) => s.id === platillo.seccionId);
                    const producto = platillo.productoId ? productoPorId.get(platillo.productoId) : null;
                    const stock = platillo.productoId ? stockPorProducto.get(platillo.productoId) ?? 0 : null;
                    return (
                      <div key={platillo.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-[color:var(--color-text-primary)]">
                              {platillo.nombre}
                            </span>
                            {platillo.destacado && <Badge variant="warning">Destacado</Badge>}
                            <Badge variant={platillo.disponible ? "success" : "neutral"}>
                              {platillo.disponible ? "Disponible" : "Oculto"}
                            </Badge>
                            {producto && (
                              <Badge variant={producto.tipo === "servicio" || (stock ?? 0) > 0 ? "info" : "error"}>
                                {producto.sku} · {producto.tipo === "servicio" ? "Servicio" : `Stock ${stock?.toFixed(2)}`}
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 text-small text-[color:var(--color-text-muted)]">
                            {seccion?.nombre ?? "Sin seccion"} ·{" "}
                            {formatearMoneda(desdeDecimal(platillo.precio), pais)}
                            {platillo.precioOferta
                              ? ` · Oferta ${formatearMoneda(desdeDecimal(platillo.precioOferta), pais)}`
                              : ""}
                          </div>
                        </div>
                        <form action={actualizarDisponibilidadPlatillo}>
                          <input type="hidden" name="menuId" value={menu.id} />
                          <input type="hidden" name="platilloId" value={platillo.id} />
                          <input type="hidden" name="disponible" value={platillo.disponible ? "false" : "true"} />
                          <Button type="submit" size="sm" variant="ghost">
                            {platillo.disponible ? "Ocultar" : "Mostrar"}
                          </Button>
                        </form>
                      </div>
                    );
                  })
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Promos temporales" subtitle="Ejemplo: todos los jueves, 15% en hamburguesas. El menu publico cambia solo." />
            <CardBody>
              <form action={crearMenuPromocion} className="grid gap-4 lg:grid-cols-2">
                <input type="hidden" name="menuId" value={menu.id} />
                <Input name="nombre" label="Nombre promo" placeholder="Jueves de alitas" required />
                <Select name="platilloId" label="Aplicar a" options={platilloOptions} />
                <div className="lg:col-span-2">
                  <label className="text-label mb-1.5 block" htmlFor="promoDescripcion">
                    Descripcion
                  </label>
                  <textarea
                    id="promoDescripcion"
                    name="descripcion"
                    className="arca-input min-h-16"
                    placeholder="Detalle visible para tus clientes."
                  />
                </div>
                <Select
                  name="tipo"
                  label="Tipo descuento"
                  defaultValue="porcentaje"
                  options={[
                    { value: "porcentaje", label: "Porcentaje" },
                    { value: "monto", label: "Monto fijo" },
                    { value: "precio_fijo", label: "Precio especial" },
                  ]}
                />
                <Input name="valor" label="Valor" type="number" min="0" step="0.01" required />
                <Input name="fechaInicio" label="Desde" type="date" />
                <Input name="fechaFin" label="Hasta" type="date" />
                <div className="lg:col-span-2">
                  <div className="text-label mb-2">Dias activos</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                    {DIAS_SEMANA.map((dia) => (
                      <label
                        key={dia.valor}
                        className="flex items-center gap-2 rounded-md border border-[color:var(--color-border)] px-3 py-2 text-small"
                      >
                        <input type="checkbox" name="diasSemana" value={dia.valor} />
                        {dia.corto}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="lg:col-span-2">
                  <Button type="submit">
                    <Sparkles size={14} /> Agregar promo
                  </Button>
                </div>
              </form>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {promos.length === 0 ? (
                  <div className="rounded-md bg-[color:var(--color-surface-2)] p-4 text-small text-[color:var(--color-text-muted)] md:col-span-2">
                    No hay promociones programadas.
                  </div>
                ) : (
                  promos.map((promo) => {
                    const platillo = platillos.find((p) => p.id === promo.platilloId);
                    return (
                      <div
                        key={promo.id}
                        className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-[color:var(--color-text-primary)]">
                              {promo.nombre}
                            </div>
                            <div className="mt-1 text-small text-[color:var(--color-text-muted)]">
                              {platillo?.nombre ?? "Toda la carta"} ·{" "}
                              {formatearDiasSemana(promo.diasSemana)}
                            </div>
                          </div>
                          <Badge variant={promo.activa ? "success" : "neutral"}>
                            {promo.activa ? "Activa" : "Pausada"}
                          </Badge>
                        </div>
                        {promo.descripcion && (
                          <p className="mt-3 text-small text-[color:var(--color-text-muted)]">
                            {promo.descripcion}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <MenuQrCard url={publicUrl} qrDataUrl={qrDataUrl} nombre={menu.nombre} />
          <MenuMesaQrsCard nombre={menu.nombre} mesas={mesasQr} />
          <Card>
            <CardHeader title="Vista publica" />
            <CardBody>
              <div className="rounded-md border border-[color:var(--color-border)] p-4" style={{ background: menu.colorFondo }}>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-md text-white"
                    style={{ background: menu.colorPrimario }}
                  >
                    <Utensils size={18} />
                  </div>
                  <div>
                    <div className="font-semibold" style={{ color: menu.colorPrimario }}>
                      {menu.nombre}
                    </div>
                    <div className="text-[12px] text-slate-600">
                      {platillos.length} platillos · {promos.length} promos
                    </div>
                  </div>
                </div>
                <div
                  className="mt-4 rounded-md px-3 py-2 text-small font-medium text-white"
                  style={{ background: menu.colorSecundario }}
                >
                  {menu.publicado ? "Publicado" : "Oculto al publico"}
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ColorInput({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-label mb-1.5 block">{label}</span>
      <span className="flex overflow-hidden rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
        <input type="color" name={name} defaultValue={value} className="h-10 w-14 border-0 bg-transparent p-1" />
        <span className="flex flex-1 items-center px-3 text-small text-[color:var(--color-text-muted)]">
          {value}
        </span>
      </span>
    </label>
  );
}
