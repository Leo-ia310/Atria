"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray, isNull, like, ne } from "drizzle-orm";
import { dbConEmpresa } from "@/lib/db";
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
  entradaInventarioLectorSchema,
  crearMarcaSchema,
  crearCategoriaSchema,
  importarProductosSchema,
} from "@/lib/validations/productos";
import { requireSession } from "@/lib/actions/session-helpers";
import { invalidarModulos } from "@/lib/redis/cache";
import { MODULOS } from "@/lib/redis/keys";
import { validarAccion, validarLimitePlan } from "@/lib/server-access";
import { formatearSku, normalizarSku, prefijoSkuCategoria } from "@/lib/sku";
import type { TX } from "@/lib/contabilidad/helpers";

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
type ResultadoEntradaLector =
  | { ok: true; productoId: string; existencia: number }
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

async function nombreCategoriaSku(
  tx: TX,
  empresaId: string,
  categoriaId: unknown,
): Promise<string | null> {
  const id = typeof categoriaId === "string" && categoriaId ? categoriaId : null;
  if (!id) return null;
  const [categoria] = await tx
    .select({ nombre: categorias.nombre })
    .from(categorias)
    .where(and(eq(categorias.id, id), eq(categorias.empresaId, empresaId)))
    .limit(1);
  if (!categoria) {
    throw new Error("Categoria no valida para esta empresa");
  }
  return categoria.nombre;
}

async function siguienteSkuCategoria(
  tx: TX,
  empresaId: string,
  categoriaNombre: string | null,
  tipo: string,
): Promise<string> {
  const prefijo = prefijoSkuCategoria(categoriaNombre, tipo);
  const existentes = await tx
    .select({ sku: productos.sku })
    .from(productos)
    .where(
      and(
        eq(productos.empresaId, empresaId),
        like(productos.sku, `${prefijo}-%`),
        isNull(productos.eliminadoEn),
      ),
    )
    .limit(5000);

  const usados = new Set(existentes.map((row) => row.sku));
  const max = existentes.reduce((actual, row) => {
    const numero = Number(row.sku.match(/-(\d+)$/)?.[1] ?? 0);
    return Number.isFinite(numero) ? Math.max(actual, numero) : actual;
  }, 0);

  let siguiente = max + 1;
  let sku = formatearSku(prefijo, siguiente);
  while (usados.has(sku)) {
    siguiente += 1;
    sku = formatearSku(prefijo, siguiente);
  }
  return sku;
}

async function resolverSkuProducto(
  tx: TX,
  empresaId: string,
  datos: { sku?: string | null; categoriaId?: unknown; tipo: string },
): Promise<string> {
  const manual = normalizarSku(String(datos.sku ?? ""));
  if (manual) return manual;
  const categoriaNombre = await nombreCategoriaSku(tx, empresaId, datos.categoriaId);
  return siguienteSkuCategoria(tx, empresaId, categoriaNombre, datos.tipo);
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
    const codigoBarras = String(datos.codigoBarras ?? "").trim();
    const creado = await dbConEmpresa(user.empresaId, async (tx) => {
      const sku = await resolverSkuProducto(tx, user.empresaId, datos);
      const yaExiste = await tx
        .select({ id: productos.id })
        .from(productos)
        .where(
          and(
            eq(productos.empresaId, user.empresaId),
            eq(productos.sku, sku),
            isNull(productos.eliminadoEn),
          ),
        )
        .limit(1);
      if (yaExiste.length > 0) return null;
      if (codigoBarras) {
        const duplicado = await tx
          .select({ id: productos.id })
          .from(productos)
          .where(
            and(
              eq(productos.empresaId, user.empresaId),
              eq(productos.codigoBarras, codigoBarras),
              isNull(productos.eliminadoEn),
            ),
          )
          .limit(1);
        if (duplicado.length > 0) return "dup" as const;
      }

      const [fila] = await tx
        .insert(productos)
        .values({
          empresaId: user.empresaId,
          sku,
          codigoBarras: codigoBarras || null,
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
      return fila;
    });

    if (creado === null) return { ok: false, error: "Ya existe un producto con ese SKU" };
    if (creado === "dup") {
      return { ok: false, error: "Ya existe un producto con ese codigo de barras" };
    }

    revalidatePath("/inventario");
    await invalidarModulos(user.empresaId, [MODULOS.REPORTES, MODULOS.DASHBOARD]);
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
  const codigoBarras = String(datos.codigoBarras ?? "").trim();

  try {
    const resultado = await dbConEmpresa(user.empresaId, async (tx) => {
      const sku = await resolverSkuProducto(tx, user.empresaId, datos);
      const existente = await tx
        .select({ id: productos.id })
        .from(productos)
        .where(and(eq(productos.id, id), eq(productos.empresaId, user.empresaId)))
        .limit(1);
      if (existente.length === 0) return "no-existe" as const;
      const skuDuplicado = await tx
        .select({ id: productos.id })
        .from(productos)
        .where(
          and(
            eq(productos.empresaId, user.empresaId),
            eq(productos.sku, sku),
            ne(productos.id, id),
            isNull(productos.eliminadoEn),
          ),
        )
        .limit(1);
      if (skuDuplicado.length > 0) return "sku-dup" as const;
      if (codigoBarras) {
        const duplicado = await tx
          .select({ id: productos.id })
          .from(productos)
          .where(
            and(
              eq(productos.empresaId, user.empresaId),
              eq(productos.codigoBarras, codigoBarras),
              ne(productos.id, id),
              isNull(productos.eliminadoEn),
            ),
          )
          .limit(1);
        if (duplicado.length > 0) return "dup" as const;
      }

      await tx
        .update(productos)
        .set({
          sku,
          codigoBarras: codigoBarras || null,
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
      await tx
        .update(productoAdvertencias)
        .set({ resuelta: true })
        .where(
          and(
            eq(productoAdvertencias.productoId, id),
            eq(productoAdvertencias.empresaId, user.empresaId),
          ),
        );
      return "ok" as const;
    });

    if (resultado === "no-existe") return { ok: false, error: "Producto no encontrado" };
    if (resultado === "sku-dup") return { ok: false, error: "Ya existe otro producto con ese SKU" };
    if (resultado === "dup") {
      return { ok: false, error: "Ya existe otro producto con ese codigo de barras" };
    }

    revalidatePath("/inventario");
    revalidatePath(`/inventario/${id}`);
    await invalidarModulos(user.empresaId, [MODULOS.REPORTES]);
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
    ? await dbConEmpresa(user.empresaId, (tx) =>
        tx
          .select({ id: productos.id, sku: productos.sku })
          .from(productos)
          .where(
            and(
              eq(productos.empresaId, user.empresaId),
              inArray(productos.sku, skus),
              isNull(productos.eliminadoEn),
            ),
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

  try {
    let creados = 0;
    let actualizados = 0;
    let advertencias = 0;
    let stockAjustado = 0;
    const mensajes: string[] = [];

    const almacen = await dbConEmpresa(user.empresaId, async (tx) => {
      const [alm] = await tx
        .select({ id: almacenes.id })
        .from(almacenes)
        .where(and(eq(almacenes.empresaId, user.empresaId), eq(almacenes.activo, true)))
        .orderBy(desc(almacenes.esPrincipal), almacenes.nombre)
        .limit(1);

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

        if (alm && fila.existenciaInicial > 0) {
          const [existencia] = await tx
            .select({ id: existencias.id, cantidad: existencias.cantidad })
            .from(existencias)
            .where(
              and(
                eq(existencias.empresaId, user.empresaId),
                eq(existencias.productoId, productoId!),
                eq(existencias.almacenId, alm.id),
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
              almacenId: alm.id,
              cantidad: dec(fila.existenciaInicial),
            });
          }

          if (Math.abs(diff) > 0.0001) {
            await tx.insert(movimientosInventario).values({
              empresaId: user.empresaId,
              productoId: productoId!,
              almacenId: alm.id,
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
      return alm;
    });

    if (!almacen && filas.some((f) => f.existenciaInicial > 0)) {
      mensajes.push("No hay almacen activo; se cargaron productos sin existencia inicial.");
    }

    revalidatePath("/inventario");
    await invalidarModulos(user.empresaId, [MODULOS.REPORTES, MODULOS.DASHBOARD]);
    return { ok: true, creados, actualizados, advertencias, stockAjustado, mensajes };
  } catch (err) {
    console.error("[importarProductosInventario]", err);
    return { ok: false, error: "No pudimos importar el inventario." };
  }
}

export async function registrarEntradaInventarioPorLector(
  input: unknown,
): Promise<ResultadoEntradaLector> {
  const user = await requireSession();
  const acceso = await validarAccion(user, {
    modulo: "inventario",
    permisos: "inventario.ajustar",
  });
  if (!acceso.ok) return acceso;
  const parsed = entradaInventarioLectorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const data = parsed.data;
  const codigoBarras = data.codigoBarras.trim();

  try {
    const [[producto], [almacen]] = await dbConEmpresa(user.empresaId, (tx) =>
      Promise.all([
        tx
          .select({
            id: productos.id,
            nombre: productos.nombre,
            codigoBarras: productos.codigoBarras,
            tipo: productos.tipo,
          })
          .from(productos)
          .where(
            and(
              eq(productos.id, data.productoId),
              eq(productos.empresaId, user.empresaId),
              isNull(productos.eliminadoEn),
            ),
          )
          .limit(1),
        tx
          .select({ id: almacenes.id })
          .from(almacenes)
          .where(
            and(
              eq(almacenes.id, data.almacenId),
              eq(almacenes.empresaId, user.empresaId),
              eq(almacenes.activo, true),
            ),
          )
          .limit(1),
      ]),
    );

    if (!producto) return { ok: false, error: "Producto no encontrado" };
    if (!almacen) return { ok: false, error: "Almacen no disponible" };
    if (producto.tipo === "servicio") {
      return { ok: false, error: "Los servicios no manejan existencia" };
    }
    if ((producto.codigoBarras ?? "").trim() !== codigoBarras) {
      return {
        ok: false,
        error: "El codigo escaneado ya no coincide con este producto",
      };
    }

    const existenciaFinal = await dbConEmpresa(user.empresaId, async (tx) => {
      const [existencia] = await tx
        .select({ id: existencias.id, cantidad: existencias.cantidad })
        .from(existencias)
        .where(
          and(
            eq(existencias.empresaId, user.empresaId),
            eq(existencias.productoId, producto.id),
            eq(existencias.almacenId, almacen.id),
            isNull(existencias.loteId),
          ),
        )
        .limit(1);

      const actual = existencia ? parseFloat(existencia.cantidad) : 0;
      const siguiente = actual + data.cantidad;
      if (existencia) {
        await tx
          .update(existencias)
          .set({
            cantidad: dec(siguiente),
            actualizadoEn: new Date(),
          })
          .where(eq(existencias.id, existencia.id));
      } else {
        await tx.insert(existencias).values({
          empresaId: user.empresaId,
          productoId: producto.id,
          almacenId: almacen.id,
          cantidad: dec(data.cantidad),
        });
      }

      await tx.insert(movimientosInventario).values({
        empresaId: user.empresaId,
        productoId: producto.id,
        almacenId: almacen.id,
        tipo: "ajuste_entrada",
        cantidad: dec(data.cantidad),
        costoUnitario: dec(data.costoPromedio),
        referenciaTabla: "lector_codigo_barras",
        notas: [
          `Entrada por lector: ${codigoBarras}`,
          data.fechaVencimiento ? `vence ${data.fechaVencimiento}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
        usuarioId: user.id,
      });

      await tx
        .update(productos)
        .set({
          precioBase: dec(data.precioBase),
          costoPromedio: dec(data.costoPromedio),
          fechaVencimiento: data.fechaVencimiento || null,
          actualizadoEn: new Date(),
        })
        .where(
          and(eq(productos.id, producto.id), eq(productos.empresaId, user.empresaId)),
        );

      return siguiente;
    });

    revalidatePath("/inventario");
    revalidatePath("/pos");
    await invalidarModulos(user.empresaId, [MODULOS.REPORTES, MODULOS.CONTABILIDAD]);
    return { ok: true, productoId: producto.id, existencia: existenciaFinal };
  } catch (err) {
    console.error("[registrarEntradaInventarioPorLector]", err);
    return { ok: false, error: "No pudimos registrar la entrada por lector." };
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
    const creada = await dbConEmpresa(user.empresaId, async (tx) => {
      const yaExiste = await tx
        .select({ id: marcas.id, nombre: marcas.nombre })
        .from(marcas)
        .where(and(eq(marcas.empresaId, user.empresaId), eq(marcas.nombre, nombre)))
        .limit(1);
      if (yaExiste.length > 0) return yaExiste[0];
      const [nueva] = await tx
        .insert(marcas)
        .values({ empresaId: user.empresaId, nombre })
        .returning({ id: marcas.id, nombre: marcas.nombre });
      return nueva;
    });
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
    const creada = await dbConEmpresa(user.empresaId, async (tx) => {
      const yaExiste = await tx
        .select({ id: categorias.id, nombre: categorias.nombre })
        .from(categorias)
        .where(and(eq(categorias.empresaId, user.empresaId), eq(categorias.nombre, nombre)))
        .limit(1);
      if (yaExiste.length > 0) return yaExiste[0];
      const [nueva] = await tx
        .insert(categorias)
        .values({ empresaId: user.empresaId, nombre })
        .returning({ id: categorias.id, nombre: categorias.nombre });
      return nueva;
    });
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
    await dbConEmpresa(user.empresaId, (tx) =>
      tx
        .update(productos)
        .set({ eliminadoEn: new Date(), activo: false })
        .where(and(eq(productos.id, id), eq(productos.empresaId, user.empresaId))),
    );
    revalidatePath("/inventario");
    await invalidarModulos(user.empresaId, [MODULOS.REPORTES, MODULOS.DASHBOARD]);
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
    await dbConEmpresa(user.empresaId, (tx) =>
      tx
        .update(productoAdvertencias)
        .set({ resuelta: true })
        .where(
          and(
            eq(productoAdvertencias.id, id),
            eq(productoAdvertencias.empresaId, user.empresaId),
          ),
        ),
    );
    revalidatePath("/inventario");
    return { ok: true };
  } catch (err) {
    console.error("[resolverAdvertenciaProducto]", err);
    return { ok: false, error: "No pudimos marcar la advertencia." };
  }
}
