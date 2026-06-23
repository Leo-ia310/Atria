"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { productos } from "@/lib/db/schema";
import { productoSchema } from "@/lib/validations/productos";
import { requireSession } from "@/lib/actions/session-helpers";

type Resultado =
  | { ok: true; id: string }
  | { ok: false; error: string };

function limpiar<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    if (out[k] === "") out[k as keyof T] = null as T[keyof T];
  }
  return out;
}

export async function crearProducto(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const parsed = productoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const datos = limpiar(parsed.data);

  try {
    const yaExiste = await db
      .select({ id: productos.id })
      .from(productos)
      .where(
        and(
          eq(productos.empresaId, user.empresaId),
          eq(productos.sku, datos.sku),
          isNull(productos.eliminadoEn),
        ),
      )
      .limit(1);
    if (yaExiste.length > 0) {
      return { ok: false, error: "Ya existe un producto con ese SKU" };
    }

    const [creado] = await db
      .insert(productos)
      .values({
        empresaId: user.empresaId,
        sku: datos.sku,
        codigoBarras: datos.codigoBarras as string | null,
        nombre: datos.nombre,
        descripcion: datos.descripcion as string | null,
        tipo: datos.tipo,
        categoriaId: (datos.categoriaId as string | null) ?? null,
        marcaId: (datos.marcaId as string | null) ?? null,
        unidadBaseId: (datos.unidadBaseId as string | null) ?? null,
        impuestoId: (datos.impuestoId as string | null) ?? null,
        precioBase: datos.precioBase.toString(),
        costoPromedio: datos.costoPromedio.toString(),
        stockMinimo: datos.stockMinimo.toString(),
        stockMaximo: datos.stockMaximo?.toString(),
        metodoCosteo: datos.metodoCosteo,
        manejaLotes: datos.manejaLotes,
        manejaSeries: datos.manejaSeries,
        activo: true,
      })
      .returning({ id: productos.id });

    revalidatePath("/inventario");
    return { ok: true, id: creado.id };
  } catch (err) {
    console.error("[crearProducto]", err);
    return { ok: false, error: "No pudimos crear el producto." };
  }
}

export async function actualizarProducto(
  id: string,
  input: unknown,
): Promise<Resultado> {
  const user = await requireSession();
  const parsed = productoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const datos = limpiar(parsed.data);

  try {
    const existente = await db
      .select({ id: productos.id })
      .from(productos)
      .where(and(eq(productos.id, id), eq(productos.empresaId, user.empresaId)))
      .limit(1);
    if (existente.length === 0) {
      return { ok: false, error: "Producto no encontrado" };
    }

    await db
      .update(productos)
      .set({
        sku: datos.sku,
        codigoBarras: datos.codigoBarras as string | null,
        nombre: datos.nombre,
        descripcion: datos.descripcion as string | null,
        tipo: datos.tipo,
        categoriaId: (datos.categoriaId as string | null) ?? null,
        marcaId: (datos.marcaId as string | null) ?? null,
        unidadBaseId: (datos.unidadBaseId as string | null) ?? null,
        impuestoId: (datos.impuestoId as string | null) ?? null,
        precioBase: datos.precioBase.toString(),
        stockMinimo: datos.stockMinimo.toString(),
        stockMaximo: datos.stockMaximo?.toString() ?? null,
        metodoCosteo: datos.metodoCosteo,
        manejaLotes: datos.manejaLotes,
        manejaSeries: datos.manejaSeries,
        actualizadoEn: new Date(),
      })
      .where(eq(productos.id, id));

    revalidatePath("/inventario");
    revalidatePath(`/inventario/${id}`);
    return { ok: true, id };
  } catch (err) {
    console.error("[actualizarProducto]", err);
    return { ok: false, error: "No pudimos actualizar el producto." };
  }
}

export async function eliminarProducto(id: string): Promise<Resultado> {
  const user = await requireSession();
  try {
    await db
      .update(productos)
      .set({ eliminadoEn: new Date(), activo: false })
      .where(and(eq(productos.id, id), eq(productos.empresaId, user.empresaId)));
    revalidatePath("/inventario");
    return { ok: true, id };
  } catch (err) {
    console.error("[eliminarProducto]", err);
    return { ok: false, error: "No pudimos eliminar el producto." };
  }
}
