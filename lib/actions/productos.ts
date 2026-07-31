"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  productos,
  marcas,
  categorias,
  productoAdvertencias,
  almacenes,
  existencias,
  movimientosInventario,
} from "@/lib/db/schema";
import {
  productoSchema,
  crearMarcaSchema,
  crearCategoriaSchema,
  importarProductosSchema,
} from "@/lib/validations/productos";
import { requireSession } from "@/lib/actions/session-helpers";
import { validarAccion, validarLimitePlan } from "@/lib/server-access";

type Resultado =
  | { ok: true; id: string }
  | { ok: false; error: string };
type ResultadoSimple = { ok: true } | { ok: false; error: string };
type ResultadoImportacion =
  | {
      ok: true;
      creados: number;
      actualizados: number;
      advertencias: number;
      stockAjustado: number;
      mensajes: string[];
    }
  | { ok: false; error: string };

function dec(n: number): string {
  return (Math.round(n * 10000) / 10000).toFixed(4);
}

function limpiar<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    if (out[k] === "") out[k as keyof T] = null as T[keyof T];
  }
  return out;
}

export async function crearProducto(input: unknown): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, {
    modulo: "inventario",
    permisos: "inventario.ajustar",
  });
  if (!acceso.ok) return acceso;
  const parsed = productoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const datos = limpiar(parsed.data);
  const limite = await validarLimitePlan(acceso.access, user.empresaId, "productos");
  if (!limite.ok) return limite;

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
        fechaVencimiento: (datos.fechaVencimiento as string | null) ?? null,
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
  const acceso = await validarAccion(user, {
    modulo: "inventario",
    permisos: "inventario.ajustar",
  });
  if (!acceso.ok) return acceso;
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
        fechaVencimiento: (datos.fechaVencimiento as string | null) ?? null,
        actualizadoEn: new Date(),
      })
      .where(eq(productos.id, id));
    await db
      .update(productoAdvertencias)
      .set({ resuelta: true })
      .where(
        and(
          eq(productoAdvertencias.productoId, id),
          eq(productoAdvertencias.empresaId, user.empresaId),
        ),
      );

    revalidatePath("/inventario");
    revalidatePath(`/inventario/${id}`);
    return { ok: true, id };
  } catch (err) {
    console.error("[actualizarProducto]", err);
    return { ok: false, error: "No pudimos actualizar el producto." };
  }
}

export async function importarProductosInventario(
  input: unknown,
): Promise<ResultadoImportacion> {
  const user = await requireSession();
  const acceso = await validarAccion(user, {
    modulo: "inventario",
    permisos: "inventario.ajustar",
  });
  if (!acceso.ok) return acceso;
  const parsed = importarProductosSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const filas = parsed.data.filas;
  const skus = [...new Set(filas.map((f) => f.sku.trim()))];
  const existentes = skus.length
    ? await db
        .select({ id: productos.id, sku: productos.sku })
        .from(productos)
        .where(
          and(
            eq(productos.empresaId, user.empresaId),
            inArray(productos.sku, skus),
            isNull(productos.eliminadoEn),
          ),
        )
    : [];
  const mapaExistentes = new Map(existentes.map((p) => [p.sku, p.id]));
  const nuevos = skus.filter((sku) => !mapaExistentes.has(sku));
  const limite = await validarLimitePlan(
    acceso.access,
    user.empresaId,
    "productos",
    nuevos.length,
  );
  if (!limite.ok) return limite;

  const [almacen] = await db
    .select({ id: almacenes.id })
    .from(almacenes)
    .where(and(eq(almacenes.empresaId, user.empresaId), eq(almacenes.activo, true)))
    .orderBy(desc(almacenes.esPrincipal), almacenes.nombre)
    .limit(1);

  try {
    let creados = 0;
    let actualizados = 0;
    let advertencias = 0;
    let stockAjustado = 0;
    const mensajes: string[] = [];

    await db.transaction(async (tx) => {
      for (const fila of filas) {
        const existenteId = mapaExistentes.get(fila.sku);
        let productoId = existenteId;
        const valoresProducto = {
          codigoBarras: fila.codigoBarras || null,
          nombre: fila.nombre,
          descripcion: fila.descripcion || null,
          tipo: "simple" as const,
          precioBase: dec(fila.precioBase),
          costoPromedio: dec(fila.costoPromedio),
          stockMinimo: dec(fila.stockMinimo),
          stockMaximo:
            fila.stockMaximo !== undefined && Number.isFinite(fila.stockMaximo)
              ? dec(fila.stockMaximo)
              : null,
          metodoCosteo: "promedio" as const,
          manejaLotes: false,
          manejaSeries: false,
          activo: true,
        };

        if (productoId) {
          await tx
            .update(productos)
            .set({ ...valoresProducto, actualizadoEn: new Date() })
            .where(
              and(
                eq(productos.id, productoId),
                eq(productos.empresaId, user.empresaId),
              ),
            );
          actualizados++;
        } else {
          const [creado] = await tx
            .insert(productos)
            .values({
              empresaId: user.empresaId,
              sku: fila.sku,
              ...valoresProducto,
            })
            .returning({ id: productos.id });
          productoId = creado.id;
          mapaExistentes.set(fila.sku, productoId);
          creados++;
        }

        if (fila.advertencias.length > 0) {
          await tx.insert(productoAdvertencias).values(
            fila.advertencias.map((a) => ({
              empresaId: user.empresaId,
              productoId: productoId!,
              filaExcel: fila.fila,
              campo: a.campo,
              mensaje: a.mensaje,
              valorOriginal: a.valorOriginal || null,
            })),
          );
          advertencias += fila.advertencias.length;
        }

        if (almacen && fila.existenciaInicial > 0) {
          const [existencia] = await tx
            .select({ id: existencias.id, cantidad: existencias.cantidad })
            .from(existencias)
            .where(
              and(
                eq(existencias.empresaId, user.empresaId),
                eq(existencias.productoId, productoId!),
                eq(existencias.almacenId, almacen.id),
                isNull(existencias.loteId),
              ),
            )
            .limit(1);
          const actual = existencia ? parseFloat(existencia.cantidad) : 0;
          const diff = fila.existenciaInicial - actual;

          if (existencia) {
            await tx
              .update(existencias)
              .set({
                cantidad: dec(fila.existenciaInicial),
                actualizadoEn: new Date(),
              })
              .where(eq(existencias.id, existencia.id));
          } else {
            await tx.insert(existencias).values({
              empresaId: user.empresaId,
              productoId: productoId!,
              almacenId: almacen.id,
              cantidad: dec(fila.existenciaInicial),
            });
          }

          if (Math.abs(diff) > 0.0001) {
            await tx.insert(movimientosInventario).values({
              empresaId: user.empresaId,
              productoId: productoId!,
              almacenId: almacen.id,
              tipo: diff >= 0 ? "ajuste_entrada" : "ajuste_salida",
              cantidad: dec(diff),
              costoUnitario: dec(fila.costoPromedio),
              referenciaTabla: "importacion_productos",
              notas: `Importacion de inventario, fila ${fila.fila}`,
              usuarioId: user.id,
            });
            stockAjustado++;
          }
        }
      }
    });

    if (!almacen && filas.some((f) => f.existenciaInicial > 0)) {
      mensajes.push("No hay almacen activo; se cargaron productos sin existencia inicial.");
    }

    revalidatePath("/inventario");
    return { ok: true, creados, actualizados, advertencias, stockAjustado, mensajes };
  } catch (err) {
    console.error("[importarProductosInventario]", err);
    return { ok: false, error: "No pudimos importar el inventario." };
  }
}

export async function crearMarca(
  input: unknown,
): Promise<{ ok: true; id: string; nombre: string } | { ok: false; error: string }> {
  const user = await requireSession();
  const acceso = await validarAccion(user, {
    modulo: "inventario",
    permisos: "inventario.ajustar",
  });
  if (!acceso.ok) return acceso;
  const parsed = crearMarcaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const nombre = parsed.data.nombre.trim();
  try {
    const yaExiste = await db
      .select({ id: marcas.id, nombre: marcas.nombre })
      .from(marcas)
      .where(and(eq(marcas.empresaId, user.empresaId), eq(marcas.nombre, nombre)))
      .limit(1);
    if (yaExiste.length > 0) {
      return { ok: true, id: yaExiste[0].id, nombre: yaExiste[0].nombre };
    }
    const [creada] = await db
      .insert(marcas)
      .values({ empresaId: user.empresaId, nombre })
      .returning({ id: marcas.id, nombre: marcas.nombre });
    revalidatePath("/inventario/nuevo");
    return { ok: true, id: creada.id, nombre: creada.nombre };
  } catch (err) {
    console.error("[crearMarca]", err);
    return { ok: false, error: "No pudimos crear la marca." };
  }
}

export async function crearCategoria(
  input: unknown,
): Promise<{ ok: true; id: string; nombre: string } | { ok: false; error: string }> {
  const user = await requireSession();
  const acceso = await validarAccion(user, {
    modulo: "inventario",
    permisos: "inventario.ajustar",
  });
  if (!acceso.ok) return acceso;
  const parsed = crearCategoriaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const nombre = parsed.data.nombre.trim();
  try {
    const yaExiste = await db
      .select({ id: categorias.id, nombre: categorias.nombre })
      .from(categorias)
      .where(and(eq(categorias.empresaId, user.empresaId), eq(categorias.nombre, nombre)))
      .limit(1);
    if (yaExiste.length > 0) {
      return { ok: true, id: yaExiste[0].id, nombre: yaExiste[0].nombre };
    }
    const [creada] = await db
      .insert(categorias)
      .values({ empresaId: user.empresaId, nombre })
      .returning({ id: categorias.id, nombre: categorias.nombre });
    revalidatePath("/inventario/nuevo");
    return { ok: true, id: creada.id, nombre: creada.nombre };
  } catch (err) {
    console.error("[crearCategoria]", err);
    return { ok: false, error: "No pudimos crear la categoría." };
  }
}

export async function eliminarProducto(id: string): Promise<Resultado> {
  const user = await requireSession();
  const acceso = await validarAccion(user, {
    modulo: "inventario",
    permisos: "inventario.ajustar",
  });
  if (!acceso.ok) return acceso;
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

export async function resolverAdvertenciaProducto(id: string): Promise<ResultadoSimple> {
  const user = await requireSession();
  const acceso = await validarAccion(user, {
    modulo: "inventario",
    permisos: "inventario.ajustar",
  });
  if (!acceso.ok) return acceso;
  try {
    await db
      .update(productoAdvertencias)
      .set({ resuelta: true })
      .where(
        and(
          eq(productoAdvertencias.id, id),
          eq(productoAdvertencias.empresaId, user.empresaId),
        ),
      );
    revalidatePath("/inventario");
    return { ok: true };
  } catch (err) {
    console.error("[resolverAdvertenciaProducto]", err);
    return { ok: false, error: "No pudimos marcar la advertencia." };
  }
}
