"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  empresas,
  menuPlatillos,
  menuPromociones,
  menuSecciones,
  menusVirtuales,
  pedidosCocina,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { validarAccion } from "@/lib/server-access";
import {
  menuPlatilloSchema,
  menuPromocionSchema,
  menuSeccionSchema,
  menuVirtualAjustesSchema,
  menuVirtualSchema,
  pedidoCocinaEstadoSchema,
} from "@/lib/validations/restaurante";
import { aDecimalStr } from "@/lib/contabilidad/helpers";
import { slugifyMenu } from "@/lib/restaurante/menu-utils";

function texto(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function checkbox(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function limpiarVacio(valor?: string | null): string | null {
  const limpio = valor?.trim();
  return limpio ? limpio : null;
}

function volver(path: string, params: Record<string, string>): never {
  const qs = new URLSearchParams(params);
  redirect(`${path}?${qs.toString()}`);
}

async function asegurarAccesoMenu() {
  const user = await requireSession();
  const acceso = await validarAccion(user, {
    modulo: "menu-virtual",
    permisos: "restaurante.menu",
  });
  if (!acceso.ok) {
    volver("/dashboard", { acceso: "denegado" });
  }
  return user;
}

async function obtenerMenuDeEmpresa(menuId: string, empresaId: string) {
  const [menu] = await db
    .select({
      id: menusVirtuales.id,
      slug: menusVirtuales.slug,
      empresaId: menusVirtuales.empresaId,
    })
    .from(menusVirtuales)
    .where(and(eq(menusVirtuales.id, menuId), eq(menusVirtuales.empresaId, empresaId)))
    .limit(1);
  return menu ?? null;
}

async function slugOcupado(slug: string, excluirMenuId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: menusVirtuales.id })
    .from(menusVirtuales)
    .where(
      and(
        eq(menusVirtuales.slug, slug),
        excluirMenuId ? ne(menusVirtuales.id, excluirMenuId) : undefined,
      ),
    )
    .limit(1);
  return Boolean(row);
}

async function crearSlugUnico(base: string): Promise<string> {
  const limpio = slugifyMenu(base);
  let intento = limpio;
  let i = 2;
  while (await slugOcupado(intento)) {
    intento = `${limpio}-${i}`;
    i += 1;
  }
  return intento;
}

export async function crearMenuVirtual(formData: FormData) {
  const user = await asegurarAccesoMenu();
  const [empresa] = await db
    .select({
      razonSocial: empresas.razonSocial,
      nombreComercial: empresas.nombreComercial,
      telefono: empresas.telefono,
      logoUrl: empresas.logoUrl,
    })
    .from(empresas)
    .where(eq(empresas.id, user.empresaId))
    .limit(1);

  const nombre = texto(formData, "nombre");
  const baseSlug = texto(formData, "slug") || empresa?.nombreComercial || empresa?.razonSocial || nombre;
  const slug = await crearSlugUnico(baseSlug);
  const parsed = menuVirtualSchema.safeParse({
    nombre,
    slug,
    descripcion: texto(formData, "descripcion"),
    plantilla: texto(formData, "plantilla") || "bistro",
  });
  if (!parsed.success) {
    volver("/menu-virtual", {
      error: parsed.error.issues[0]?.message ?? "Datos invalidos",
    });
  }

  const [menu] = await db
    .insert(menusVirtuales)
    .values({
      empresaId: user.empresaId,
      nombre: parsed.data.nombre,
      slug: parsed.data.slug,
      descripcion: limpiarVacio(parsed.data.descripcion),
      plantilla: parsed.data.plantilla,
      telefono: empresa?.telefono ?? null,
      logoUrl: empresa?.logoUrl ?? null,
      creadoPor: user.id,
    })
    .returning({ id: menusVirtuales.id });

  revalidatePath("/menu-virtual");
  redirect(`/menu-virtual/${menu.id}`);
}

export async function actualizarMenuVirtual(formData: FormData) {
  const user = await asegurarAccesoMenu();
  const parsed = menuVirtualAjustesSchema.safeParse({
    menuId: texto(formData, "menuId"),
    nombre: texto(formData, "nombre"),
    slug: slugifyMenu(texto(formData, "slug")),
    descripcion: texto(formData, "descripcion"),
    plantilla: texto(formData, "plantilla") || "bistro",
    colorPrimario: texto(formData, "colorPrimario") || "#0f766e",
    colorSecundario: texto(formData, "colorSecundario") || "#f59e0b",
    colorFondo: texto(formData, "colorFondo") || "#fffaf0",
    logoUrl: texto(formData, "logoUrl"),
    telefono: texto(formData, "telefono"),
    whatsapp: texto(formData, "whatsapp"),
    instagramUrl: texto(formData, "instagramUrl"),
    facebookUrl: texto(formData, "facebookUrl"),
    tiktokUrl: texto(formData, "tiktokUrl"),
    sitioWebUrl: texto(formData, "sitioWebUrl"),
    animaciones: checkbox(formData, "animaciones"),
    publicado: checkbox(formData, "publicado"),
  });
  if (!parsed.success) {
    volver(`/menu-virtual/${texto(formData, "menuId")}`, {
      error: parsed.error.issues[0]?.message ?? "Datos invalidos",
    });
  }

  const menu = await obtenerMenuDeEmpresa(parsed.data.menuId, user.empresaId);
  if (!menu) volver("/menu-virtual", { error: "Menu no encontrado" });

  if (await slugOcupado(parsed.data.slug, parsed.data.menuId)) {
    volver(`/menu-virtual/${parsed.data.menuId}`, {
      error: "Ese link ya esta en uso",
    });
  }

  await db
    .update(menusVirtuales)
    .set({
      nombre: parsed.data.nombre,
      slug: parsed.data.slug,
      descripcion: limpiarVacio(parsed.data.descripcion),
      plantilla: parsed.data.plantilla,
      colorPrimario: parsed.data.colorPrimario,
      colorSecundario: parsed.data.colorSecundario,
      colorFondo: parsed.data.colorFondo,
      logoUrl: limpiarVacio(parsed.data.logoUrl),
      telefono: limpiarVacio(parsed.data.telefono),
      whatsapp: limpiarVacio(parsed.data.whatsapp),
      instagramUrl: limpiarVacio(parsed.data.instagramUrl),
      facebookUrl: limpiarVacio(parsed.data.facebookUrl),
      tiktokUrl: limpiarVacio(parsed.data.tiktokUrl),
      sitioWebUrl: limpiarVacio(parsed.data.sitioWebUrl),
      animaciones: parsed.data.animaciones,
      publicado: parsed.data.publicado,
      actualizadoEn: new Date(),
    })
    .where(and(eq(menusVirtuales.id, parsed.data.menuId), eq(menusVirtuales.empresaId, user.empresaId)));

  revalidatePath("/menu-virtual");
  revalidatePath(`/menu-virtual/${parsed.data.menuId}`);
  revalidatePath(`/${menu.slug}`);
  revalidatePath(`/${parsed.data.slug}`);
  volver(`/menu-virtual/${parsed.data.menuId}`, { guardado: "1" });
}

export async function crearMenuSeccion(formData: FormData) {
  const user = await asegurarAccesoMenu();
  const parsed = menuSeccionSchema.safeParse({
    menuId: texto(formData, "menuId"),
    nombre: texto(formData, "nombre"),
    descripcion: texto(formData, "descripcion"),
  });
  if (!parsed.success) {
    volver(`/menu-virtual/${texto(formData, "menuId")}`, {
      error: parsed.error.issues[0]?.message ?? "Datos invalidos",
    });
  }
  const menu = await obtenerMenuDeEmpresa(parsed.data.menuId, user.empresaId);
  if (!menu) volver("/menu-virtual", { error: "Menu no encontrado" });

  const [ultima] = await db
    .select({ orden: menuSecciones.orden })
    .from(menuSecciones)
    .where(and(eq(menuSecciones.menuId, parsed.data.menuId), eq(menuSecciones.empresaId, user.empresaId)))
    .orderBy(desc(menuSecciones.orden))
    .limit(1);

  await db.insert(menuSecciones).values({
    empresaId: user.empresaId,
    menuId: parsed.data.menuId,
    nombre: parsed.data.nombre,
    descripcion: limpiarVacio(parsed.data.descripcion),
    orden: (ultima?.orden ?? 0) + 10,
  });

  revalidatePath(`/menu-virtual/${parsed.data.menuId}`);
  revalidatePath(`/${menu.slug}`);
  volver(`/menu-virtual/${parsed.data.menuId}`, { guardado: "1" });
}

export async function crearMenuPlatillo(formData: FormData) {
  const user = await asegurarAccesoMenu();
  const parsed = menuPlatilloSchema.safeParse({
    menuId: texto(formData, "menuId"),
    seccionId: texto(formData, "seccionId"),
    nombre: texto(formData, "nombre"),
    descripcion: texto(formData, "descripcion"),
    precio: texto(formData, "precio"),
    precioOferta: texto(formData, "precioOferta"),
    etiquetaOferta: texto(formData, "etiquetaOferta"),
    imagenUrl: texto(formData, "imagenUrl"),
    destacado: checkbox(formData, "destacado"),
    disponible: checkbox(formData, "disponible"),
  });
  if (!parsed.success) {
    volver(`/menu-virtual/${texto(formData, "menuId")}`, {
      error: parsed.error.issues[0]?.message ?? "Datos invalidos",
    });
  }
  const menu = await obtenerMenuDeEmpresa(parsed.data.menuId, user.empresaId);
  if (!menu) volver("/menu-virtual", { error: "Menu no encontrado" });

  const [ultima] = await db
    .select({ orden: menuPlatillos.orden })
    .from(menuPlatillos)
    .where(and(eq(menuPlatillos.menuId, parsed.data.menuId), eq(menuPlatillos.empresaId, user.empresaId)))
    .orderBy(desc(menuPlatillos.orden))
    .limit(1);

  await db.insert(menuPlatillos).values({
    empresaId: user.empresaId,
    menuId: parsed.data.menuId,
    seccionId: parsed.data.seccionId || null,
    nombre: parsed.data.nombre,
    descripcion: limpiarVacio(parsed.data.descripcion),
    precio: aDecimalStr(parsed.data.precio),
    precioOferta:
      typeof parsed.data.precioOferta === "number"
        ? aDecimalStr(parsed.data.precioOferta)
        : null,
    etiquetaOferta: limpiarVacio(parsed.data.etiquetaOferta),
    imagenUrl: limpiarVacio(parsed.data.imagenUrl),
    destacado: parsed.data.destacado,
    disponible: parsed.data.disponible,
    orden: (ultima?.orden ?? 0) + 10,
  });

  revalidatePath(`/menu-virtual/${parsed.data.menuId}`);
  revalidatePath(`/${menu.slug}`);
  volver(`/menu-virtual/${parsed.data.menuId}`, { guardado: "1" });
}

export async function crearMenuPromocion(formData: FormData) {
  const user = await asegurarAccesoMenu();
  const parsed = menuPromocionSchema.safeParse({
    menuId: texto(formData, "menuId"),
    platilloId: texto(formData, "platilloId"),
    nombre: texto(formData, "nombre"),
    descripcion: texto(formData, "descripcion"),
    tipo: texto(formData, "tipo"),
    valor: texto(formData, "valor"),
    diasSemana: formData.getAll("diasSemana"),
    fechaInicio: texto(formData, "fechaInicio"),
    fechaFin: texto(formData, "fechaFin"),
  });
  if (!parsed.success) {
    volver(`/menu-virtual/${texto(formData, "menuId")}`, {
      error: parsed.error.issues[0]?.message ?? "Datos invalidos",
    });
  }
  const menu = await obtenerMenuDeEmpresa(parsed.data.menuId, user.empresaId);
  if (!menu) volver("/menu-virtual", { error: "Menu no encontrado" });

  await db.insert(menuPromociones).values({
    empresaId: user.empresaId,
    menuId: parsed.data.menuId,
    platilloId: parsed.data.platilloId || null,
    nombre: parsed.data.nombre,
    descripcion: limpiarVacio(parsed.data.descripcion),
    tipo: parsed.data.tipo,
    valor: aDecimalStr(parsed.data.valor),
    diasSemana: parsed.data.diasSemana,
    fechaInicio: limpiarVacio(parsed.data.fechaInicio),
    fechaFin: limpiarVacio(parsed.data.fechaFin),
  });

  revalidatePath(`/menu-virtual/${parsed.data.menuId}`);
  revalidatePath(`/${menu.slug}`);
  volver(`/menu-virtual/${parsed.data.menuId}`, { guardado: "1" });
}

export async function actualizarDisponibilidadPlatillo(formData: FormData) {
  const user = await asegurarAccesoMenu();
  const menuId = texto(formData, "menuId");
  const platilloId = texto(formData, "platilloId");
  const disponible = checkbox(formData, "disponible");
  const menu = await obtenerMenuDeEmpresa(menuId, user.empresaId);
  if (!menu) volver("/menu-virtual", { error: "Menu no encontrado" });

  await db
    .update(menuPlatillos)
    .set({ disponible, actualizadoEn: new Date() })
    .where(
      and(
        eq(menuPlatillos.id, platilloId),
        eq(menuPlatillos.menuId, menuId),
        eq(menuPlatillos.empresaId, user.empresaId),
      ),
    );

  revalidatePath(`/menu-virtual/${menuId}`);
  revalidatePath(`/${menu.slug}`);
  volver(`/menu-virtual/${menuId}`, { guardado: "1" });
}

export async function actualizarEstadoPedidoCocina(formData: FormData) {
  const user = await requireSession();
  const acceso = await validarAccion(user, {
    modulo: "pedidos-cocina",
    permisos: "restaurante.pedidos",
  });
  if (!acceso.ok) volver("/dashboard", { acceso: "denegado" });

  const parsed = pedidoCocinaEstadoSchema.safeParse({
    pedidoId: texto(formData, "pedidoId"),
    estado: texto(formData, "estado"),
  });
  if (!parsed.success) {
    volver("/pedidos-cocina", {
      error: parsed.error.issues[0]?.message ?? "Datos invalidos",
    });
  }

  await db
    .update(pedidosCocina)
    .set({
      estado: parsed.data.estado,
      actualizadoEn: new Date(),
      listoEn: parsed.data.estado === "listo" ? new Date() : null,
    })
    .where(and(eq(pedidosCocina.id, parsed.data.pedidoId), eq(pedidosCocina.empresaId, user.empresaId)));

  revalidatePath("/pedidos-cocina");
  volver("/pedidos-cocina", { guardado: "1" });
}
