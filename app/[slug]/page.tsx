import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Facebook, Globe, Instagram, Phone, Send, Sparkles, Utensils } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { dbSuperAdmin } from "@/lib/db";
import {
  empresas,
  almacenes,
  existencias,
  menuPlatillos,
  menuPromociones,
  menuSecciones,
  menusVirtuales,
  productos,
} from "@/lib/db/schema";
import {
  calcularPrecioPromo,
  formatearDiasSemana,
} from "@/lib/restaurante/menu-utils";
import { cn, desdeDecimal, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import { PedidoMenuPublico } from "@/components/restaurante/PedidoMenuPublico";
import { GuestOnboardingPrompt } from "@/components/restaurante/GuestOnboardingPrompt";
import { resolverComensalDesdeCookie } from "@/lib/actions/restaurante-vertical";

type PlatilloPublico = typeof menuPlatillos.$inferSelect & {
  agotado: boolean;
  stockDisponible: number | null;
};

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ mesa?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await cargarMenuPublico(slug);
  if (!data) return {};
  const nombre = data.menu.nombre;
  const empresa = data.empresa.nombreComercial || data.empresa.razonSocial;
  return {
    title: `${nombre} | ${empresa}`,
    description: data.menu.descripcion ?? `Menu digital de ${empresa}`,
  };
}

export default async function MenuPublicoPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = searchParams ? await searchParams : {};
  const data = await cargarMenuPublico(slug);
  if (!data) notFound();

  const { menu, empresa, secciones, platillos, promocionesActivas } = data;
  const mesaNumero = normalizarMesa(sp.mesa, menu.cantidadMesas);
  const pais = empresa.pais as PaisCodigo;
  const accent = menu.colorSecundario;
  const agrupados = agruparPlatillos(platillos, secciones);
  const promosVisibles = promocionesActivas.slice(0, 4);
  const comensal = await resolverComensalDesdeCookie(empresa.id);

  return (
    <main
      className={cn(
        "min-h-screen text-slate-950",
        menu.plantilla === "minimal" && "font-sans",
        menu.animaciones && "arca-menu-animate",
      )}
      style={
        {
          background: menu.colorFondo,
          "--menu-primary": menu.colorPrimario,
          "--menu-accent": accent,
        } as CSSProperties
      }
    >
      <section className="border-b border-black/10 px-5 py-6 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            {menu.logoUrl ? (
              <img
                src={menu.logoUrl}
                alt={empresa.nombreComercial || empresa.razonSocial}
                className="h-16 w-16 rounded-md object-cover ring-1 ring-black/10"
              />
            ) : (
              <div
                className="flex h-16 w-16 items-center justify-center rounded-md text-white shadow-sm"
                style={{ background: menu.colorPrimario }}
              >
                <Utensils size={28} />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-small font-medium uppercase tracking-wide text-slate-500">
                {empresa.nombreComercial || empresa.razonSocial}
              </p>
              <h1 className="mt-1 truncate text-3xl font-semibold leading-tight sm:text-4xl">
                {menu.nombre}
              </h1>
              {menu.descripcion && (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  {menu.descripcion}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {menu.telefono && <Contacto href={`tel:${menu.telefono}`} icon={Phone} label="Telefono" />}
            {menu.whatsapp && <Contacto href={`https://wa.me/${menu.whatsapp.replace(/\D/g, "")}`} icon={Send} label="WhatsApp" />}
            {menu.instagramUrl && <Contacto href={menu.instagramUrl} icon={Instagram} label="Instagram" />}
            {menu.facebookUrl && <Contacto href={menu.facebookUrl} icon={Facebook} label="Facebook" />}
            {menu.sitioWebUrl && <Contacto href={menu.sitioWebUrl} icon={Globe} label="Web" />}
          </div>
        </div>
      </section>

      {promosVisibles.length > 0 && (
        <section className="px-5 py-5 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {promosVisibles.map((promo) => (
                <div
                  key={promo.id}
                  className="menu-entrada rounded-md border border-black/10 bg-white/80 p-4 shadow-sm backdrop-blur"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: menu.colorPrimario }}>
                    <Sparkles size={15} />
                    {promo.nombre}
                  </div>
                  <p className="mt-2 text-[12px] leading-5 text-slate-600">
                    {promo.descripcion || formatearDiasSemana(promo.diasSemana)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {!comensal && (
        <GuestOnboardingPrompt slug={menu.slug} colorPrimario={menu.colorPrimario} />
      )}

      {platillos.length > 0 && (
          <PedidoMenuPublico
            slug={menu.slug}
            mesaNumero={mesaNumero}
            colorPrimario={menu.colorPrimario}
            items={platillos.map((platillo) => {
            const precio = precioEfectivo(platillo, promocionesActivas);
            return {
              id: platillo.id,
              nombre: platillo.nombre,
              precio: formatearMoneda(precio.valor, pais),
              agotado: platillo.agotado,
            };
          })}
        />
      )}

      <section className="px-5 pb-12 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl space-y-8">
          {agrupados.map((grupo) => (
            <div key={grupo.id} className="menu-entrada">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-xl font-semibold" style={{ color: menu.colorPrimario }}>
                    {grupo.nombre}
                  </h2>
                  {grupo.descripcion && (
                    <p className="mt-1 text-small text-slate-600">{grupo.descripcion}</p>
                  )}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {grupo.items.map((platillo) => {
                  const precioBase = desdeDecimal(platillo.precio);
                  const precio = precioEfectivo(platillo, promocionesActivas);
                  const tieneOferta = precio.valor + 0.001 < precioBase;
                  return (
                    <article
                      key={platillo.id}
                      className={cn(
                        "overflow-hidden rounded-md border border-black/10 bg-white shadow-sm",
                        platillo.agotado && "opacity-70",
                      )}
                    >
                      {platillo.imagenUrl && (
                        <img
                          src={platillo.imagenUrl}
                          alt={platillo.nombre}
                          className="h-44 w-full object-cover"
                        />
                      )}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-base font-semibold text-slate-950">
                              {platillo.nombre}
                            </h3>
                            {platillo.descripcion && (
                              <p className="mt-1 text-small leading-5 text-slate-600">
                                {platillo.descripcion}
                              </p>
                            )}
                          </div>
                          {platillo.destacado && (
                            <span
                              className="shrink-0 rounded px-2 py-1 text-[11px] font-semibold text-white"
                              style={{ background: accent }}
                            >
                              Especial
                            </span>
                          )}
                          {platillo.agotado && (
                            <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                              Agotado
                            </span>
                          )}
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span className="text-lg font-semibold" style={{ color: menu.colorPrimario }}>
                            {formatearMoneda(precio.valor, pais)}
                          </span>
                          {tieneOferta && (
                            <>
                              <span className="text-small text-slate-400 line-through">
                                {formatearMoneda(precioBase, pais)}
                              </span>
                              <span className="rounded bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
                                {precio.etiqueta}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
          {platillos.length === 0 && (
            <div className="rounded-md border border-black/10 bg-white/80 p-8 text-center text-slate-600">
              Menu en preparacion.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function normalizarMesa(valor: string | undefined, cantidadMesas: number): string | null {
  if (!valor) return null;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1 || numero > cantidadMesas) return null;
  return String(numero);
}

async function cargarMenuPublico(slug: string) {
  return dbSuperAdmin(async (tx) => {
  const [row] = await tx
    .select({
      menu: menusVirtuales,
      empresa: {
        id: empresas.id,
        razonSocial: empresas.razonSocial,
        nombreComercial: empresas.nombreComercial,
        pais: empresas.pais,
        activa: empresas.activa,
        tipoEmpresa: empresas.tipoEmpresa,
        verticalEmpresa: empresas.verticalEmpresa,
        zonaHoraria: empresas.zonaHoraria,
      },
    })
    .from(menusVirtuales)
    .innerJoin(empresas, eq(empresas.id, menusVirtuales.empresaId))
    .where(and(eq(menusVirtuales.slug, slug), eq(menusVirtuales.publicado, true)))
    .limit(1);

  if (
    !row ||
    !row.empresa.activa ||
    (row.empresa.verticalEmpresa !== "restaurante" &&
      row.empresa.tipoEmpresa !== "restaurante")
  ) {
    return null;
  }

  const [secciones, platillos, promociones] = await Promise.all([
    tx
      .select()
      .from(menuSecciones)
      .where(and(eq(menuSecciones.menuId, row.menu.id), eq(menuSecciones.visible, true)))
      .orderBy(asc(menuSecciones.orden), asc(menuSecciones.nombre)),
    tx
      .select()
      .from(menuPlatillos)
      .where(and(eq(menuPlatillos.menuId, row.menu.id), eq(menuPlatillos.disponible, true)))
      .orderBy(asc(menuPlatillos.orden), asc(menuPlatillos.nombre)),
    tx
      .select()
      .from(menuPromociones)
      .where(and(eq(menuPromociones.menuId, row.menu.id), eq(menuPromociones.activa, true))),
  ]);

  const productoIds = [
    ...new Set(platillos.flatMap((platillo) => (platillo.productoId ? [platillo.productoId] : []))),
  ];
  const [productosRows, stockRows] = productoIds.length
    ? await Promise.all([
        tx
          .select({ id: productos.id, tipo: productos.tipo })
          .from(productos)
          .where(
            and(
              eq(productos.empresaId, row.empresa.id),
              eq(productos.activo, true),
              isNull(productos.eliminadoEn),
              inArray(productos.id, productoIds),
            ),
          ),
        tx
          .select({
            productoId: existencias.productoId,
            cantidad: sql<string>`COALESCE(SUM(${existencias.cantidad}), 0)`,
          })
          .from(existencias)
          .innerJoin(almacenes, eq(almacenes.id, existencias.almacenId))
          .where(
            and(
              eq(existencias.empresaId, row.empresa.id),
              eq(almacenes.empresaId, row.empresa.id),
              row.menu.sucursalId ? eq(almacenes.sucursalId, row.menu.sucursalId) : undefined,
              eq(almacenes.activo, true),
              inArray(existencias.productoId, productoIds),
            ),
          )
          .groupBy(existencias.productoId),
      ])
    : [[], []];
  const tipoPorProducto = new Map(productosRows.map((producto) => [producto.id, producto.tipo]));
  const stockPorProducto = new Map(
    stockRows.map((stock) => [stock.productoId, parseFloat(stock.cantidad)]),
  );
  const platillosConStock: PlatilloPublico[] = platillos.map((platillo) => {
    if (!platillo.productoId) {
      return { ...platillo, agotado: false, stockDisponible: null };
    }
    const tipo = tipoPorProducto.get(platillo.productoId);
    if (!tipo) {
      return { ...platillo, agotado: true, stockDisponible: null };
    }
    if (tipo === "servicio") {
      return { ...platillo, agotado: false, stockDisponible: null };
    }
    const stock = stockPorProducto.get(platillo.productoId) ?? 0;
    return { ...platillo, agotado: stock <= 0, stockDisponible: stock };
  });

  const { fecha, diaSemana } = fechaLocal(row.empresa.zonaHoraria);
  const promocionesActivas = promociones.filter((promo) => {
    if (!promo.diasSemana.includes(diaSemana)) return false;
    if (promo.fechaInicio && promo.fechaInicio > fecha) return false;
    if (promo.fechaFin && promo.fechaFin < fecha) return false;
    return true;
  });

  return {
    menu: row.menu,
    empresa: row.empresa,
    secciones,
    platillos: platillosConStock,
    promocionesActivas,
  };
  });
}

function fechaLocal(timeZone: string): { fecha: string; diaSemana: number } {
  const ahora = new Date();
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(ahora);
  const mapa = new Map(partes.map((parte) => [parte.type, parte.value]));
  const fecha = `${mapa.get("year")}-${mapa.get("month")}-${mapa.get("day")}`;
  const diaMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { fecha, diaSemana: diaMap[mapa.get("weekday") ?? "Sun"] ?? 0 };
}

function agruparPlatillos(
  platillos: PlatilloPublico[],
  secciones: (typeof menuSecciones.$inferSelect)[],
) {
  const grupos = secciones.map((seccion) => ({
    id: seccion.id,
    nombre: seccion.nombre,
    descripcion: seccion.descripcion,
    items: platillos.filter((platillo) => platillo.seccionId === seccion.id),
  }));
  const sinSeccion = platillos.filter((platillo) => !platillo.seccionId);
  if (sinSeccion.length > 0) {
    grupos.push({
      id: "sin-seccion",
      nombre: "Favoritos",
      descripcion: null,
      items: sinSeccion,
    });
  }
  return grupos.filter((grupo) => grupo.items.length > 0);
}

function precioEfectivo(
  platillo: PlatilloPublico,
  promociones: (typeof menuPromociones.$inferSelect)[],
): { valor: number; etiqueta: string } {
  const precioBase = desdeDecimal(platillo.precio);
  let mejor = {
    valor: platillo.precioOferta ? desdeDecimal(platillo.precioOferta) : precioBase,
    etiqueta: platillo.etiquetaOferta || "Oferta",
  };
  for (const promo of promociones) {
    if (promo.platilloId && promo.platilloId !== platillo.id) continue;
    const valor = calcularPrecioPromo({
      precio: precioBase,
      tipo: promo.tipo,
      valor: desdeDecimal(promo.valor),
    });
    if (valor < mejor.valor) {
      mejor = { valor, etiqueta: promo.nombre };
    }
  }
  return mejor;
}

function Contacto({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      className="flex h-10 min-w-10 items-center justify-center rounded-md border border-black/10 bg-white/70 px-3 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
      aria-label={label}
      title={label}
    >
      <Icon size={17} />
      <span className="ml-2 hidden sm:inline">{label}</span>
    </a>
  );
}
