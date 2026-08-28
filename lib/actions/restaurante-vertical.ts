"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { and, desc, eq, inArray, isNull, like, ne, or, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { dbConEmpresa, dbSuperAdmin, type Tx } from "@/lib/db";
import {
  almacenes,
  auditoria,
  categorias,
  empresas,
  existencias,
  menuPlatillos,
  menusVirtuales,
  movimientosInventario,
  productos,
  restauranteAreas,
  restauranteComandaItems,
  restauranteComandas,
  restauranteComensalTokens,
  restauranteComensales,
  restauranteEstaciones,
  restauranteListaEspera,
  restauranteMermas,
  restauranteMesas,
  restauranteOrdenItems,
  restauranteOrdenes,
  restauranteProductos,
  restaurantePromociones,
  restauranteRecetaIngredientes,
  restauranteRecetas,
  restauranteReservaciones,
  restauranteVisitasComensal,
  sucursales,
  unidadesMedida,
} from "@/lib/db/schema";
import { requireSession, type SessionUser } from "@/lib/actions/session-helpers";
import { validarAccion } from "@/lib/server-access";
import { aDecimalStr, dinero } from "@/lib/contabilidad/helpers";
import {
  RESTAURANTE_GUEST_COOKIE,
  calcularCostoPorPorcion,
  calcularFoodCostPct,
  crearTokenOpaco,
  hashToken,
  normalizarEmail,
  normalizarTelefono,
  sumarDias,
  ultimos4Token,
} from "@/lib/restaurante/core";
import {
  restauranteAreaSchema,
  restauranteComandaEstadoSchema,
  restauranteComensalManualSchema,
  restauranteComensalPublicoSchema,
  restauranteEnviarComandaSchema,
  restauranteEsperaSchema,
  restauranteMermaSchema,
  restauranteMesaEstadoSchema,
  restauranteMesaSchema,
  restauranteOrdenItemSchema,
  restauranteOrdenSchema,
  restauranteProductoSchema,
  restaurantePromocionSchema,
  restauranteRecetaIngredienteSchema,
  restauranteRecetaSchema,
  restauranteReservacionSchema,
} from "@/lib/validations/restaurante-vertical";
import { rateLimit } from "@/lib/redis/rate-limit";

type Resultado = { ok: true; id?: string; token?: string } | { ok: false; error: string };
type ModuloRestaurante =
  | "restaurante-dashboard"
  | "restaurante-pos"
  | "restaurante-mesas"
  | "restaurante-ordenes"
  | "restaurante-kds"
  | "restaurante-menu"
  | "restaurante-recetas"
  | "restaurante-inventario"
  | "restaurante-mermas"
  | "restaurante-reservaciones"
  | "restaurante-comensales"
  | "restaurante-reportes"
  | "restaurante-promociones";

function texto(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function checkbox(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true";
}

function listaTexto(valor: string | null | undefined): string[] {
  return (valor ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}

async function requireRestaurante(
  modulo: ModuloRestaurante,
  permisos?: string | string[],
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const user = await requireSession();
  const acceso = await validarAccion(user, { modulo, permisos });
  if (!acceso.ok) return acceso;
  if (
    acceso.access.verticalEmpresa !== "restaurante" &&
    acceso.access.tipoEmpresa !== "restaurante"
  ) {
    return { ok: false, error: "Esta empresa no usa la vertical restaurante." };
  }
  return { ok: true, user };
}

async function auditar(
  tx: Tx,
  data: {
    empresaId: string;
    usuarioId: string;
    accion: string;
    tabla: string;
    registroId?: string | null;
    datosDespues?: Record<string, unknown>;
  },
) {
  await tx.insert(auditoria).values({
    empresaId: data.empresaId,
    usuarioId: data.usuarioId,
    accion: data.accion,
    tabla: data.tabla,
    registroId: data.registroId ?? null,
    datosDespues: data.datosDespues ?? null,
  });
}

export async function crearAreaRestaurante(formData: FormData): Promise<Resultado> {
  const acceso = await requireRestaurante("restaurante-mesas", "restaurante.mesas.editar");
  if (!acceso.ok) return acceso;
  const parsed = restauranteAreaSchema.safeParse({
    sucursalId: texto(formData, "sucursalId"),
    nombre: texto(formData, "nombre"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const { user } = acceso;
  const data = parsed.data;
  const resultado = await dbConEmpresa(user.empresaId, async (tx) => {
    const [sucursal] = await tx
      .select({ id: sucursales.id })
      .from(sucursales)
      .where(and(eq(sucursales.id, data.sucursalId), eq(sucursales.empresaId, user.empresaId)))
      .limit(1);
    if (!sucursal) return { ok: false as const, error: "Sucursal no valida" };

    const [area] = await tx
      .insert(restauranteAreas)
      .values({
        empresaId: user.empresaId,
        sucursalId: data.sucursalId,
        nombre: data.nombre,
      })
      .returning({ id: restauranteAreas.id });
    await auditar(tx, {
      empresaId: user.empresaId,
      usuarioId: user.id,
      accion: "restaurante.area.crear",
      tabla: "restaurante_areas",
      registroId: area.id,
      datosDespues: { sucursalId: data.sucursalId, nombre: data.nombre },
    });
    return { ok: true as const, id: area.id };
  });
  revalidatePath("/restaurante/mesas");
  return resultado;
}

export async function crearAreaRestauranteForm(formData: FormData): Promise<void> {
  await crearAreaRestaurante(formData);
}

export async function crearMesaRestaurante(formData: FormData): Promise<Resultado> {
  const acceso = await requireRestaurante("restaurante-mesas", "restaurante.mesas.editar");
  if (!acceso.ok) return acceso;
  const parsed = restauranteMesaSchema.safeParse({
    sucursalId: texto(formData, "sucursalId"),
    areaId: texto(formData, "areaId"),
    nombre: texto(formData, "nombre"),
    capacidad: texto(formData, "capacidad") || "2",
    forma: texto(formData, "forma") || "rectangular",
    posX: texto(formData, "posX") || "0.5",
    posY: texto(formData, "posY") || "0.5",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { user } = acceso;
  const data = parsed.data;
  const token = crearTokenOpaco();

  const resultado = await dbConEmpresa(user.empresaId, async (tx) => {
    const [mesa] = await tx
      .insert(restauranteMesas)
      .values({
        empresaId: user.empresaId,
        sucursalId: data.sucursalId,
        areaId: data.areaId || null,
        nombre: data.nombre,
        capacidad: data.capacidad,
        forma: data.forma,
        posX: aDecimalStr(data.posX),
        posY: aDecimalStr(data.posY),
        qrTokenHash: hashToken(token),
        qrTokenUltimos4: ultimos4Token(token),
      })
      .returning({ id: restauranteMesas.id });
    await auditar(tx, {
      empresaId: user.empresaId,
      usuarioId: user.id,
      accion: "restaurante.mesa.crear",
      tabla: "restaurante_mesas",
      registroId: mesa.id,
      datosDespues: { sucursalId: data.sucursalId, nombre: data.nombre },
    });
    return { ok: true as const, id: mesa.id, token };
  });
  revalidatePath("/restaurante/mesas");
  return resultado;
}

export async function crearMesaRestauranteForm(formData: FormData): Promise<void> {
  await crearMesaRestaurante(formData);
}

export async function actualizarEstadoMesaRestaurante(formData: FormData): Promise<Resultado> {
  const acceso = await requireRestaurante("restaurante-mesas", "restaurante.mesas.editar");
  if (!acceso.ok) return acceso;
  const parsed = restauranteMesaEstadoSchema.safeParse({
    mesaId: texto(formData, "mesaId"),
    estado: texto(formData, "estado"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { user } = acceso;
  const data = parsed.data;
  await dbConEmpresa(user.empresaId, async (tx) => {
    await tx
      .update(restauranteMesas)
      .set({ estado: data.estado, actualizadoEn: new Date() })
      .where(and(eq(restauranteMesas.id, data.mesaId), eq(restauranteMesas.empresaId, user.empresaId)));
    await auditar(tx, {
      empresaId: user.empresaId,
      usuarioId: user.id,
      accion: "restaurante.mesa.estado",
      tabla: "restaurante_mesas",
      registroId: data.mesaId,
      datosDespues: { estado: data.estado },
    });
  });
  revalidatePath("/restaurante/mesas");
  revalidatePath("/restaurante/pos");
  return { ok: true };
}

export async function actualizarEstadoMesaRestauranteForm(
  formData: FormData,
): Promise<void> {
  await actualizarEstadoMesaRestaurante(formData);
}

export async function configurarProductoRestaurante(formData: FormData): Promise<Resultado> {
  const acceso = await requireRestaurante("restaurante-recetas", "restaurante.recetas.editar");
  if (!acceso.ok) return acceso;
  const parsed = restauranteProductoSchema.safeParse({
    productoId: texto(formData, "productoId"),
    tipo: texto(formData, "tipo"),
    estacionId: texto(formData, "estacionId"),
    disponibleQr: checkbox(formData, "disponibleQr"),
    consumeInventario: checkbox(formData, "consumeInventario"),
    tiempoPreparacionMin: texto(formData, "tiempoPreparacionMin") || "0",
    alergenos: texto(formData, "alergenos"),
    etiquetas: texto(formData, "etiquetas"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const { user } = acceso;
  const data = parsed.data;
  const [row] = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .insert(restauranteProductos)
      .values({
        empresaId: user.empresaId,
        productoId: data.productoId,
        tipo: data.tipo,
        estacionId: data.estacionId || null,
        disponibleQr: data.disponibleQr,
        consumeInventario: data.consumeInventario,
        tiempoPreparacionMin: data.tiempoPreparacionMin,
        alergenos: listaTexto(data.alergenos),
        etiquetas: listaTexto(data.etiquetas),
      })
      .onConflictDoUpdate({
        target: [restauranteProductos.empresaId, restauranteProductos.productoId],
        set: {
          tipo: data.tipo,
          estacionId: data.estacionId || null,
          disponibleQr: data.disponibleQr,
          consumeInventario: data.consumeInventario,
          tiempoPreparacionMin: data.tiempoPreparacionMin,
          alergenos: listaTexto(data.alergenos),
          etiquetas: listaTexto(data.etiquetas),
          actualizadoEn: new Date(),
        },
      })
      .returning({ id: restauranteProductos.id }),
  );
  revalidatePath("/restaurante/recetas");
  revalidatePath("/restaurante/menu");
  return { ok: true, id: row?.id };
}

export async function configurarProductoRestauranteForm(formData: FormData): Promise<void> {
  await configurarProductoRestaurante(formData);
}

export async function crearRecetaRestaurante(formData: FormData): Promise<Resultado> {
  const acceso = await requireRestaurante("restaurante-recetas", "restaurante.recetas.editar");
  if (!acceso.ok) return acceso;
  const parsed = restauranteRecetaSchema.safeParse({
    productoId: texto(formData, "productoId"),
    nombre: texto(formData, "nombre"),
    tipo: texto(formData, "tipo") || "platillo",
    rendimientoCantidad: texto(formData, "rendimientoCantidad") || "1",
    rendimientoUnidadId: texto(formData, "rendimientoUnidadId"),
    precioVenta: texto(formData, "precioVenta") || "0",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { user } = acceso;
  const data = parsed.data;
  const costoPorPorcion = calcularCostoPorPorcion(0, data.rendimientoCantidad);
  const [receta] = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .insert(restauranteRecetas)
      .values({
        empresaId: user.empresaId,
        productoId: data.productoId,
        nombre: data.nombre,
        tipo: data.tipo,
        rendimientoCantidad: aDecimalStr(data.rendimientoCantidad),
        rendimientoUnidadId: data.rendimientoUnidadId || null,
        precioVenta: aDecimalStr(data.precioVenta),
        costoPorPorcion: aDecimalStr(costoPorPorcion),
        foodCostPct: aDecimalStr(calcularFoodCostPct(costoPorPorcion, data.precioVenta)),
        creadoPor: user.id,
      })
      .onConflictDoUpdate({
        target: [restauranteRecetas.empresaId, restauranteRecetas.productoId],
        set: {
          nombre: data.nombre,
          tipo: data.tipo,
          rendimientoCantidad: aDecimalStr(data.rendimientoCantidad),
          rendimientoUnidadId: data.rendimientoUnidadId || null,
          precioVenta: aDecimalStr(data.precioVenta),
          actualizadoEn: new Date(),
        },
      })
      .returning({ id: restauranteRecetas.id }),
  );
  revalidatePath("/restaurante/recetas");
  return { ok: true, id: receta?.id };
}

export async function crearRecetaRestauranteForm(formData: FormData): Promise<void> {
  await crearRecetaRestaurante(formData);
}

export async function agregarIngredienteRecetaRestaurante(
  formData: FormData,
): Promise<Resultado> {
  const acceso = await requireRestaurante("restaurante-recetas", "restaurante.recetas.editar");
  if (!acceso.ok) return acceso;
  const parsed = restauranteRecetaIngredienteSchema.safeParse({
    recetaId: texto(formData, "recetaId"),
    ingredienteProductoId: texto(formData, "ingredienteProductoId"),
    unidadId: texto(formData, "unidadId"),
    cantidad: texto(formData, "cantidad"),
    costoUnitario: texto(formData, "costoUnitario") || "0",
    mermaPct: texto(formData, "mermaPct") || "0",
    notas: texto(formData, "notas"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { user } = acceso;
  const data = parsed.data;

  const resultado = await dbConEmpresa(user.empresaId, async (tx) => {
    const [ingrediente] = await tx
      .insert(restauranteRecetaIngredientes)
      .values({
        empresaId: user.empresaId,
        recetaId: data.recetaId,
        ingredienteProductoId: data.ingredienteProductoId,
        unidadId: data.unidadId || null,
        cantidad: aDecimalStr(data.cantidad),
        costoUnitario: aDecimalStr(data.costoUnitario),
        mermaPct: aDecimalStr(data.mermaPct),
        notas: data.notas || null,
      })
      .returning({ id: restauranteRecetaIngredientes.id });
    await recalcularReceta(tx, user.empresaId, data.recetaId);
    return { ok: true as const, id: ingrediente.id };
  });
  revalidatePath("/restaurante/recetas");
  return resultado;
}

export async function agregarIngredienteRecetaRestauranteForm(
  formData: FormData,
): Promise<void> {
  await agregarIngredienteRecetaRestaurante(formData);
}

export async function registrarMermaRestaurante(formData: FormData): Promise<Resultado> {
  const acceso = await requireRestaurante("restaurante-mermas", "restaurante.mermas.crear");
  if (!acceso.ok) return acceso;
  const parsed = restauranteMermaSchema.safeParse({
    sucursalId: texto(formData, "sucursalId"),
    almacenId: texto(formData, "almacenId"),
    productoId: texto(formData, "productoId"),
    unidadId: texto(formData, "unidadId"),
    cantidad: texto(formData, "cantidad"),
    costoUnitario: texto(formData, "costoUnitario") || "0",
    motivo: texto(formData, "motivo"),
    observacion: texto(formData, "observacion"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { user } = acceso;
  const data = parsed.data;

  const resultado = await dbConEmpresa(user.empresaId, async (tx) => {
    const [almacen] = await tx
      .select({ id: almacenes.id, sucursalId: almacenes.sucursalId })
      .from(almacenes)
      .where(
        and(
          eq(almacenes.id, data.almacenId),
          eq(almacenes.empresaId, user.empresaId),
          eq(almacenes.activo, true),
        ),
      )
      .limit(1);
    if (!almacen || almacen.sucursalId !== data.sucursalId) {
      return { ok: false as const, error: "Almacen no valido para la sucursal" };
    }

    const [movimiento] = await tx
      .insert(movimientosInventario)
      .values({
        empresaId: user.empresaId,
        productoId: data.productoId,
        almacenId: data.almacenId,
        tipo: "merma",
        cantidad: aDecimalStr(-data.cantidad),
        costoUnitario: aDecimalStr(data.costoUnitario),
        referenciaTabla: "restaurante_mermas",
        usuarioId: user.id,
        notas: data.observacion || null,
      })
      .returning({ id: movimientosInventario.id });

    const [merma] = await tx
      .insert(restauranteMermas)
      .values({
        empresaId: user.empresaId,
        sucursalId: data.sucursalId,
        almacenId: data.almacenId,
        productoId: data.productoId,
        unidadId: data.unidadId || null,
        cantidad: aDecimalStr(data.cantidad),
        costoUnitario: aDecimalStr(data.costoUnitario),
        motivo: data.motivo,
        observacion: data.observacion || null,
        movimientoInventarioId: movimiento.id,
        creadoPor: user.id,
      })
      .returning({ id: restauranteMermas.id });

    await tx
      .update(movimientosInventario)
      .set({ referenciaId: merma.id })
      .where(eq(movimientosInventario.id, movimiento.id));

    await tx
      .update(existencias)
      .set({
        cantidad: sql`${existencias.cantidad} - ${data.cantidad}`,
        actualizadoEn: new Date(),
      })
      .where(
        and(
          eq(existencias.empresaId, user.empresaId),
          eq(existencias.productoId, data.productoId),
          eq(existencias.almacenId, data.almacenId),
        ),
      );

    await auditar(tx, {
      empresaId: user.empresaId,
      usuarioId: user.id,
      accion: "restaurante.merma.crear",
      tabla: "restaurante_mermas",
      registroId: merma.id,
      datosDespues: { productoId: data.productoId, cantidad: data.cantidad, motivo: data.motivo },
    });
    return { ok: true as const, id: merma.id };
  });
  revalidatePath("/restaurante/inventario");
  revalidatePath("/restaurante/mermas");
  revalidatePath("/restaurante");
  return resultado;
}

export async function registrarMermaRestauranteForm(formData: FormData): Promise<void> {
  await registrarMermaRestaurante(formData);
}

export async function crearOrdenRestaurante(formData: FormData): Promise<Resultado> {
  const acceso = await requireRestaurante("restaurante-pos", "restaurante.ordenes.crear");
  if (!acceso.ok) return acceso;
  const parsed = restauranteOrdenSchema.safeParse({
    sucursalId: texto(formData, "sucursalId"),
    mesaId: texto(formData, "mesaId"),
    canal: texto(formData, "canal") || "salon",
    personas: texto(formData, "personas") || "1",
    notas: texto(formData, "notas"),
    idempotencyKey: texto(formData, "idempotencyKey"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { user } = acceso;
  const data = parsed.data;
  const usaMesa = data.canal === "salon" || data.canal === "qr_mesa";
  const mesaId = usaMesa ? data.mesaId : "";

  const resultado = await dbConEmpresa(user.empresaId, async (tx) => {
    if (data.idempotencyKey) {
      const [existente] = await tx
        .select({ id: restauranteOrdenes.id })
        .from(restauranteOrdenes)
        .where(
          and(
            eq(restauranteOrdenes.empresaId, user.empresaId),
            eq(restauranteOrdenes.idempotencyKey, data.idempotencyKey),
          ),
        )
        .limit(1);
      if (existente) return { ok: true as const, id: existente.id };
    }

    if (mesaId) {
      const [mesa] = await tx
        .select({ id: restauranteMesas.id, sucursalId: restauranteMesas.sucursalId })
        .from(restauranteMesas)
        .where(and(eq(restauranteMesas.id, mesaId), eq(restauranteMesas.empresaId, user.empresaId)))
        .limit(1);
      if (!mesa || mesa.sucursalId !== data.sucursalId) {
        return { ok: false as const, error: "Mesa no valida para la sucursal." };
      }
      const ordenesAbiertas = await tx
        .select({ id: restauranteOrdenes.id })
        .from(restauranteOrdenes)
        .where(
          and(
            eq(restauranteOrdenes.empresaId, user.empresaId),
            eq(restauranteOrdenes.mesaId, mesaId),
            inArray(restauranteOrdenes.estado, [
              "abierta",
              "borrador",
              "en_cocina",
              "cuenta_solicitada",
            ]),
          ),
        )
        .limit(1);
      if (ordenesAbiertas.length > 0) {
        return { ok: false as const, error: "La mesa ya tiene una orden abierta." };
      }
    }

    const numero = await siguienteNumeroOrden(tx, user.empresaId);
    const [orden] = await tx
      .insert(restauranteOrdenes)
      .values({
        empresaId: user.empresaId,
        sucursalId: data.sucursalId,
        mesaId: mesaId || null,
        numero,
        canal: data.canal,
        personas: data.personas,
        notas: data.notas || null,
        idempotencyKey: data.idempotencyKey || null,
        abiertoPor: user.id,
      })
      .returning({ id: restauranteOrdenes.id });

    if (mesaId) {
      await tx
        .update(restauranteMesas)
        .set({ estado: "ocupada", actualizadoEn: new Date() })
        .where(and(eq(restauranteMesas.id, mesaId), eq(restauranteMesas.empresaId, user.empresaId)));
    }

    await auditar(tx, {
      empresaId: user.empresaId,
      usuarioId: user.id,
      accion: "restaurante.orden.crear",
      tabla: "restaurante_ordenes",
      registroId: orden.id,
      datosDespues: { sucursalId: data.sucursalId, mesaId: mesaId || null, canal: data.canal },
    });
    return { ok: true as const, id: orden.id };
  });
  revalidatePath("/restaurante/pos");
  revalidatePath("/restaurante/ordenes");
  revalidatePath("/restaurante/mesas");
  return resultado;
}

export async function crearOrdenRestauranteForm(formData: FormData): Promise<void> {
  await crearOrdenRestaurante(formData);
}

export async function agregarItemOrdenRestaurante(formData: FormData): Promise<Resultado> {
  const acceso = await requireRestaurante("restaurante-ordenes", "restaurante.ordenes.editar");
  if (!acceso.ok) return acceso;
  const parsed = restauranteOrdenItemSchema.safeParse({
    ordenId: texto(formData, "ordenId"),
    productoId: texto(formData, "productoId"),
    cantidad: texto(formData, "cantidad"),
    precioUnitario: texto(formData, "precioUnitario"),
    descuento: texto(formData, "descuento") || "0",
    impuesto: texto(formData, "impuesto") || "0",
    costoUnitario: texto(formData, "costoUnitario") || "0",
    notasCocina: texto(formData, "notasCocina"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { user } = acceso;
  const data = parsed.data;

  const resultado = await dbConEmpresa(user.empresaId, async (tx) => {
    const [[orden], [producto]] = await Promise.all([
      tx
        .select({ id: restauranteOrdenes.id, estado: restauranteOrdenes.estado })
        .from(restauranteOrdenes)
        .where(and(eq(restauranteOrdenes.id, data.ordenId), eq(restauranteOrdenes.empresaId, user.empresaId)))
        .limit(1),
      tx
        .select({
          id: productos.id,
          nombre: productos.nombre,
          precioBase: productos.precioBase,
          costoPromedio: productos.costoPromedio,
        })
        .from(productos)
        .where(and(eq(productos.id, data.productoId), eq(productos.empresaId, user.empresaId)))
        .limit(1),
    ]);
    if (!orden || ["pagada", "cancelada"].includes(orden.estado)) {
      return { ok: false as const, error: "Orden no disponible para editar" };
    }
    if (!producto) return { ok: false as const, error: "Producto no valido" };

    const precioUnitario = data.precioUnitario || parseFloat(producto.precioBase);
    const costoUnitario = data.costoUnitario || parseFloat(producto.costoPromedio);
    const [item] = await tx
      .insert(restauranteOrdenItems)
      .values({
        empresaId: user.empresaId,
        ordenId: data.ordenId,
        productoId: data.productoId,
        nombreSnapshot: producto.nombre,
        cantidad: aDecimalStr(data.cantidad),
        precioUnitario: aDecimalStr(precioUnitario),
        descuento: aDecimalStr(data.descuento),
        impuesto: aDecimalStr(data.impuesto),
        costoUnitario: aDecimalStr(costoUnitario),
        notasCocina: data.notasCocina || null,
      })
      .returning({ id: restauranteOrdenItems.id });

    await recalcularOrden(tx, user.empresaId, data.ordenId);
    return { ok: true as const, id: item.id };
  });
  revalidatePath("/restaurante/pos");
  revalidatePath("/restaurante/ordenes");
  return resultado;
}

export async function agregarItemOrdenRestauranteForm(formData: FormData): Promise<void> {
  await agregarItemOrdenRestaurante(formData);
}

export async function enviarComandasOrdenRestaurante(formData: FormData): Promise<Resultado> {
  const acceso = await requireRestaurante("restaurante-ordenes", "restaurante.comandas.enviar");
  if (!acceso.ok) return acceso;
  const parsed = restauranteEnviarComandaSchema.safeParse({
    ordenId: texto(formData, "ordenId"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { user } = acceso;
  const { ordenId } = parsed.data;

  const resultado = await dbConEmpresa(user.empresaId, async (tx) => {
    const [orden] = await tx
      .select({ id: restauranteOrdenes.id, sucursalId: restauranteOrdenes.sucursalId })
      .from(restauranteOrdenes)
      .where(and(eq(restauranteOrdenes.id, ordenId), eq(restauranteOrdenes.empresaId, user.empresaId)))
      .limit(1);
    if (!orden) return { ok: false as const, error: "Orden no encontrada" };

    const items = await tx
      .select({
        id: restauranteOrdenItems.id,
        productoId: restauranteOrdenItems.productoId,
        nombreSnapshot: restauranteOrdenItems.nombreSnapshot,
        cantidad: restauranteOrdenItems.cantidad,
        notasCocina: restauranteOrdenItems.notasCocina,
        modificadoresSnapshot: restauranteOrdenItems.modificadoresSnapshot,
        estacionId: restauranteProductos.estacionId,
      })
      .from(restauranteOrdenItems)
      .leftJoin(
        restauranteProductos,
        and(
          eq(restauranteProductos.productoId, restauranteOrdenItems.productoId),
          eq(restauranteProductos.empresaId, user.empresaId),
        ),
      )
      .where(
        and(
          eq(restauranteOrdenItems.empresaId, user.empresaId),
          eq(restauranteOrdenItems.ordenId, ordenId),
          eq(restauranteOrdenItems.estado, "borrador"),
        ),
      );
    if (items.length === 0) {
      return { ok: false as const, error: "No hay items nuevos para enviar a cocina." };
    }

    const estacionDefault = await asegurarEstacionDefault(tx, user.empresaId, orden.sucursalId);
    const porEstacion = new Map<string, typeof items>();
    for (const item of items) {
      const estacionId = item.estacionId ?? estacionDefault.id;
      const lista = porEstacion.get(estacionId) ?? [];
      lista.push(item);
      porEstacion.set(estacionId, lista);
    }

    const estaciones = [...porEstacion.entries()];
    const primerNumero = await siguienteNumeroComanda(tx, user.empresaId);
    const prefijoNumero = primerNumero.replace(/\d+$/, "");
    const consecutivoBase = parseInt(primerNumero.slice(prefijoNumero.length), 10);
    const comandaIds = await Promise.all(
      estaciones.map(async ([estacionId, lista], index) => {
        const numero = `${prefijoNumero}${String(consecutivoBase + index).padStart(6, "0")}`;
        const [comanda] = await tx
          .insert(restauranteComandas)
          .values({
            empresaId: user.empresaId,
            sucursalId: orden.sucursalId,
            ordenId,
            estacionId,
            numero,
            estado: "enviada",
            enviadaPor: user.id,
          })
          .returning({ id: restauranteComandas.id });

        await tx.insert(restauranteComandaItems).values(
          lista.map((item) => ({
            empresaId: user.empresaId,
            comandaId: comanda.id,
            ordenItemId: item.id,
            productoId: item.productoId,
            nombreSnapshot: item.nombreSnapshot,
            cantidad: item.cantidad,
            notasCocina: item.notasCocina,
            modificadoresSnapshot: item.modificadoresSnapshot,
            estado: "enviada" as const,
          })),
        );
        return comanda.id;
      }),
    );
    const primeraComandaId = comandaIds[0];

    await tx
      .update(restauranteOrdenItems)
      .set({ estado: "enviado", enviadoCocinaEn: new Date(), actualizadoEn: new Date() })
      .where(
        and(
          eq(restauranteOrdenItems.empresaId, user.empresaId),
          inArray(
            restauranteOrdenItems.id,
            items.map((item) => item.id),
          ),
        ),
      );
    await tx
      .update(restauranteOrdenes)
      .set({ estado: "en_cocina", actualizadoEn: new Date() })
      .where(eq(restauranteOrdenes.id, ordenId));
    await auditar(tx, {
      empresaId: user.empresaId,
      usuarioId: user.id,
      accion: "restaurante.comanda.enviar",
      tabla: "restaurante_ordenes",
      registroId: ordenId,
      datosDespues: { items: items.length, estaciones: porEstacion.size },
    });
    return { ok: true as const, id: primeraComandaId };
  });
  revalidatePath("/restaurante/kds");
  revalidatePath("/restaurante/ordenes");
  revalidatePath("/restaurante");
  return resultado;
}

export async function enviarComandasOrdenRestauranteForm(formData: FormData): Promise<void> {
  await enviarComandasOrdenRestaurante(formData);
}

export async function actualizarEstadoComandaRestaurante(formData: FormData): Promise<Resultado> {
  const acceso = await requireRestaurante("restaurante-kds", "restaurante.kds.actualizar");
  if (!acceso.ok) return acceso;
  const parsed = restauranteComandaEstadoSchema.safeParse({
    comandaId: texto(formData, "comandaId"),
    estado: texto(formData, "estado"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { user } = acceso;
  const data = parsed.data;
  const ahora = new Date();
  const update: Partial<typeof restauranteComandas.$inferInsert> = {
    estado: data.estado,
    actualizadoEn: ahora,
  };
  if (data.estado === "recibida") update.recibidaEn = ahora;
  if (data.estado === "preparando") update.preparandoEn = ahora;
  if (data.estado === "lista") update.listaEn = ahora;
  if (data.estado === "entregada") update.entregadaEn = ahora;
  if (data.estado === "cancelada") update.canceladaEn = ahora;

  await dbConEmpresa(user.empresaId, async (tx) => {
    await tx
      .update(restauranteComandas)
      .set(update)
      .where(and(eq(restauranteComandas.id, data.comandaId), eq(restauranteComandas.empresaId, user.empresaId)));
    await tx
      .update(restauranteComandaItems)
      .set({ estado: data.estado })
      .where(
        and(
          eq(restauranteComandaItems.comandaId, data.comandaId),
          eq(restauranteComandaItems.empresaId, user.empresaId),
        ),
      );
    await auditar(tx, {
      empresaId: user.empresaId,
      usuarioId: user.id,
      accion: "restaurante.kds.estado",
      tabla: "restaurante_comandas",
      registroId: data.comandaId,
      datosDespues: { estado: data.estado },
    });
  });
  revalidatePath("/restaurante/kds");
  revalidatePath("/restaurante");
  return { ok: true };
}

export async function actualizarEstadoComandaRestauranteForm(
  formData: FormData,
): Promise<void> {
  await actualizarEstadoComandaRestaurante(formData);
}

export async function crearReservacionRestaurante(formData: FormData): Promise<Resultado> {
  const acceso = await requireRestaurante(
    "restaurante-reservaciones",
    "restaurante.reservaciones.editar",
  );
  if (!acceso.ok) return acceso;
  const parsed = restauranteReservacionSchema.safeParse({
    sucursalId: texto(formData, "sucursalId"),
    mesaId: texto(formData, "mesaId"),
    nombre: texto(formData, "nombre"),
    telefono: texto(formData, "telefono"),
    email: texto(formData, "email"),
    fecha: texto(formData, "fecha"),
    hora: texto(formData, "hora"),
    personas: texto(formData, "personas"),
    ocasionEspecial: texto(formData, "ocasionEspecial"),
    notas: texto(formData, "notas"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { user } = acceso;
  const data = parsed.data;
  const [reservacion] = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .insert(restauranteReservaciones)
      .values({
        empresaId: user.empresaId,
        sucursalId: data.sucursalId,
        mesaId: data.mesaId || null,
        nombre: data.nombre,
        telefono: data.telefono || null,
        email: data.email || null,
        fecha: data.fecha,
        hora: data.hora,
        personas: data.personas,
        ocasionEspecial: data.ocasionEspecial || null,
        notas: data.notas || null,
        creadoPor: user.id,
      })
      .returning({ id: restauranteReservaciones.id }),
  );
  revalidatePath("/restaurante/reservaciones");
  revalidatePath("/restaurante");
  return { ok: true, id: reservacion?.id };
}

export async function crearReservacionRestauranteForm(formData: FormData): Promise<void> {
  await crearReservacionRestaurante(formData);
}

export async function crearListaEsperaRestaurante(formData: FormData): Promise<Resultado> {
  const acceso = await requireRestaurante(
    "restaurante-reservaciones",
    "restaurante.reservaciones.editar",
  );
  if (!acceso.ok) return acceso;
  const parsed = restauranteEsperaSchema.safeParse({
    sucursalId: texto(formData, "sucursalId"),
    nombre: texto(formData, "nombreEspera"),
    telefono: texto(formData, "telefonoEspera"),
    personas: texto(formData, "personasEspera"),
    esperaEstimadaMin: texto(formData, "esperaEstimadaMin") || "0",
    preferencia: texto(formData, "preferencia"),
    notas: texto(formData, "notasEspera"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { user } = acceso;
  const data = parsed.data;
  const [row] = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .insert(restauranteListaEspera)
      .values({
        empresaId: user.empresaId,
        sucursalId: data.sucursalId,
        nombre: data.nombre,
        telefono: data.telefono || null,
        personas: data.personas,
        esperaEstimadaMin: data.esperaEstimadaMin ?? null,
        preferencia: data.preferencia || null,
        notas: data.notas || null,
        creadoPor: user.id,
      })
      .returning({ id: restauranteListaEspera.id }),
  );
  revalidatePath("/restaurante/reservaciones");
  revalidatePath("/restaurante");
  return { ok: true, id: row?.id };
}

export async function crearListaEsperaRestauranteForm(formData: FormData): Promise<void> {
  await crearListaEsperaRestaurante(formData);
}

export async function guardarComensalRestaurante(formData: FormData): Promise<Resultado> {
  const acceso = await requireRestaurante("restaurante-comensales", "restaurante.crm.ver");
  if (!acceso.ok) return acceso;
  const parsed = restauranteComensalManualSchema.safeParse({
    nombre: texto(formData, "nombre"),
    telefono: texto(formData, "telefono"),
    email: texto(formData, "email"),
    cumpleanos: texto(formData, "cumpleanos"),
    preferencias: texto(formData, "preferencias"),
    alergias: texto(formData, "alergias"),
    ocasionesEspeciales: texto(formData, "ocasionesEspeciales"),
    notas: texto(formData, "notas"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const { user } = acceso;
  const data = parsed.data;
  const email = normalizarEmail(data.email);
  const telefono = normalizarTelefono(data.telefono);

  const resultado = await dbConEmpresa(user.empresaId, async (tx) => {
    const [existente] =
      email || telefono
        ? await tx
            .select({ id: restauranteComensales.id })
            .from(restauranteComensales)
            .where(
              and(
                eq(restauranteComensales.empresaId, user.empresaId),
                or(
                  email ? eq(restauranteComensales.email, email) : undefined,
                  telefono ? eq(restauranteComensales.telefono, telefono) : undefined,
                ),
              ),
            )
            .limit(1)
        : [];

    const valores = {
      nombre: data.nombre,
      telefono,
      email,
      cumpleanos: data.cumpleanos || null,
      preferencias: data.preferencias || null,
      alergias: data.alergias || null,
      ocasionesEspeciales: data.ocasionesEspeciales || null,
      notas: data.notas || null,
      actualizadoEn: new Date(),
    };

    if (existente) {
      await tx
        .update(restauranteComensales)
        .set(valores)
        .where(
          and(
            eq(restauranteComensales.id, existente.id),
            eq(restauranteComensales.empresaId, user.empresaId),
          ),
        );
      await auditar(tx, {
        empresaId: user.empresaId,
        usuarioId: user.id,
        accion: "restaurante.comensal.actualizar",
        tabla: "restaurante_comensales",
        registroId: existente.id,
        datosDespues: { nombre: data.nombre, email, telefono },
      });
      return { ok: true as const, id: existente.id };
    }

    const [comensal] = await tx
      .insert(restauranteComensales)
      .values({
        empresaId: user.empresaId,
        ...valores,
      })
      .returning({ id: restauranteComensales.id });
    await auditar(tx, {
      empresaId: user.empresaId,
      usuarioId: user.id,
      accion: "restaurante.comensal.crear",
      tabla: "restaurante_comensales",
      registroId: comensal.id,
      datosDespues: { nombre: data.nombre, email, telefono },
    });
    return { ok: true as const, id: comensal.id };
  });

  revalidatePath("/restaurante/comensales");
  revalidatePath("/restaurante");
  return resultado;
}

export async function guardarComensalRestauranteForm(formData: FormData): Promise<void> {
  await guardarComensalRestaurante(formData);
}

export async function registrarComensalMenuPublico(input: unknown): Promise<Resultado> {
  await auth();

  const parsed = restauranteComensalPublicoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const data = parsed.data;
  const identidad = normalizarEmail(data.email) ?? normalizarTelefono(data.telefono) ?? data.slug;
  const limite = await rateLimit("restaurante-guest", `${data.slug}:${identidad}`, 12, 60 * 60);
  if (!limite.permitido) {
    return { ok: false, error: "Demasiados intentos. Intenta mas tarde." };
  }

  const resultado = await dbSuperAdmin(async (tx) => {
    const [menu] = await tx
      .select({
        id: menusVirtuales.id,
        empresaId: menusVirtuales.empresaId,
        empresaActiva: empresas.activa,
        verticalEmpresa: empresas.verticalEmpresa,
        tipoEmpresa: empresas.tipoEmpresa,
      })
      .from(menusVirtuales)
      .innerJoin(empresas, eq(empresas.id, menusVirtuales.empresaId))
      .where(and(eq(menusVirtuales.slug, data.slug), eq(menusVirtuales.publicado, true)))
      .limit(1);
    if (
      !menu ||
      !menu.empresaActiva ||
      (menu.verticalEmpresa !== "restaurante" && menu.tipoEmpresa !== "restaurante")
    ) {
      return { ok: false as const, error: "Menu no disponible." };
    }

    const email = normalizarEmail(data.email);
    const telefono = normalizarTelefono(data.telefono);
    const [existente] =
      email || telefono
        ? await tx
            .select({ id: restauranteComensales.id })
            .from(restauranteComensales)
            .where(
              and(
                eq(restauranteComensales.empresaId, menu.empresaId),
                or(
                  email ? eq(restauranteComensales.email, email) : undefined,
                  telefono ? eq(restauranteComensales.telefono, telefono) : undefined,
                ),
              ),
            )
            .limit(1)
        : [];

    const notas = [
      data.primeraVisita ? `Primera visita: ${data.primeraVisita}` : null,
      data.comoNosConocio ? `Como nos conocio: ${data.comoNosConocio}` : null,
      data.comidaFavorita ? `Comida favorita: ${data.comidaFavorita}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const comensalId = existente
      ? existente.id
      : (
          await tx
            .insert(restauranteComensales)
            .values({
              empresaId: menu.empresaId,
              nombre: data.nombre,
              telefono,
              email,
              cumpleanos: data.cumpleanos || null,
              alergias: data.alergias || null,
              preferencias: data.comidaFavorita || null,
              notas: notas || null,
              ultimaVisitaEn: new Date(),
              visitas: 1,
            })
            .returning({ id: restauranteComensales.id })
        )[0].id;

    if (existente) {
      await tx
        .update(restauranteComensales)
        .set({
          nombre: data.nombre,
          telefono,
          email,
          cumpleanos: data.cumpleanos || null,
          alergias: data.alergias || null,
          preferencias: data.comidaFavorita || null,
          notas: notas || null,
          ultimaVisitaEn: new Date(),
          visitas: sql`${restauranteComensales.visitas} + 1`,
          actualizadoEn: new Date(),
        })
        .where(eq(restauranteComensales.id, comensalId));
    }

    await tx.insert(restauranteVisitasComensal).values({
      empresaId: menu.empresaId,
      comensalId,
      canal: "qr_mesa",
      metadata: { slug: data.slug },
    });

    const token = crearTokenOpaco();
    await tx.insert(restauranteComensalTokens).values({
      empresaId: menu.empresaId,
      comensalId,
      tokenHash: hashToken(token),
      tokenUltimos4: ultimos4Token(token),
      expiraEn: sumarDias(new Date(), 180),
      ultimoUsoEn: new Date(),
    });
    return { ok: true as const, id: comensalId, token };
  });

  if (!resultado.ok || !resultado.token) return resultado;
  const store = await cookies();
  store.set(RESTAURANTE_GUEST_COOKIE, resultado.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 180 * 24 * 60 * 60,
  });
  return { ok: true, id: resultado.id };
}

export async function crearPromocionRestaurante(formData: FormData): Promise<Resultado> {
  const acceso = await requireRestaurante(
    "restaurante-promociones",
    "restaurante.promociones.editar",
  );
  if (!acceso.ok) return acceso;
  const parsed = restaurantePromocionSchema.safeParse({
    nombre: texto(formData, "nombre"),
    descripcion: texto(formData, "descripcion"),
    tipo: texto(formData, "tipo") || "porcentaje",
    valor: texto(formData, "valor") || "0",
    productoId: texto(formData, "productoId"),
    categoriaId: texto(formData, "categoriaId"),
    diasSemana: formData.getAll("diasSemana"),
    horaInicio: texto(formData, "horaInicio"),
    horaFin: texto(formData, "horaFin"),
    fechaInicio: texto(formData, "fechaInicio"),
    fechaFin: texto(formData, "fechaFin"),
    activa: checkbox(formData, "activa"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { user } = acceso;
  const data = parsed.data;

  const resultado = await dbConEmpresa(user.empresaId, async (tx) => {
    if (data.productoId) {
      const [producto] = await tx
        .select({ id: productos.id })
        .from(productos)
        .where(and(eq(productos.id, data.productoId), eq(productos.empresaId, user.empresaId)))
        .limit(1);
      if (!producto) return { ok: false as const, error: "Producto no valido" };
    }
    if (data.categoriaId) {
      const [categoria] = await tx
        .select({ id: categorias.id })
        .from(categorias)
        .where(and(eq(categorias.id, data.categoriaId), eq(categorias.empresaId, user.empresaId)))
        .limit(1);
      if (!categoria) return { ok: false as const, error: "Categoria no valida" };
    }

    const [promo] = await tx
      .insert(restaurantePromociones)
      .values({
        empresaId: user.empresaId,
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        tipo: data.tipo,
        valor: aDecimalStr(data.valor),
        productoId: data.productoId || null,
        categoriaId: data.categoriaId || null,
        diasSemana: data.diasSemana,
        horaInicio: data.horaInicio || null,
        horaFin: data.horaFin || null,
        fechaInicio: data.fechaInicio || null,
        fechaFin: data.fechaFin || null,
        activa: data.activa,
        creadoPor: user.id,
      })
      .returning({ id: restaurantePromociones.id });
    await auditar(tx, {
      empresaId: user.empresaId,
      usuarioId: user.id,
      accion: "restaurante.promocion.crear",
      tabla: "restaurante_promociones",
      registroId: promo.id,
      datosDespues: { nombre: data.nombre, tipo: data.tipo },
    });
    return { ok: true as const, id: promo.id };
  });
  revalidatePath("/restaurante/promociones");
  revalidatePath("/restaurante/menu");
  return resultado;
}

export async function crearPromocionRestauranteForm(formData: FormData): Promise<void> {
  await crearPromocionRestaurante(formData);
}

export async function resolverComensalDesdeCookie(
  empresaId: string,
): Promise<{ id: string; nombre: string } | null> {
  const token = (await cookies()).get(RESTAURANTE_GUEST_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = hashToken(token);
  const ahora = new Date();
  const [row] = await dbSuperAdmin((tx) =>
    tx
      .select({
        tokenId: restauranteComensalTokens.id,
        comensalId: restauranteComensales.id,
        nombre: restauranteComensales.nombre,
      })
      .from(restauranteComensalTokens)
      .innerJoin(
        restauranteComensales,
        eq(restauranteComensales.id, restauranteComensalTokens.comensalId),
      )
      .where(
        and(
          eq(restauranteComensalTokens.empresaId, empresaId),
          eq(restauranteComensalTokens.tokenHash, tokenHash),
          isNull(restauranteComensalTokens.revocadoEn),
          sql`${restauranteComensalTokens.expiraEn} > ${ahora}`,
        ),
      )
      .limit(1),
  );
  if (!row) return null;

  await dbSuperAdmin(async (tx) => {
    await tx
      .update(restauranteComensalTokens)
      .set({ ultimoUsoEn: ahora, expiraEn: sumarDias(ahora, 180) })
      .where(eq(restauranteComensalTokens.id, row.tokenId));
    await tx
      .update(restauranteComensales)
      .set({ ultimaVisitaEn: ahora, actualizadoEn: ahora })
      .where(eq(restauranteComensales.id, row.comensalId));
  });

  return { id: row.comensalId, nombre: row.nombre };
}

async function recalcularReceta(tx: Tx, empresaId: string, recetaId: string) {
  const [receta] = await tx
    .select({
      id: restauranteRecetas.id,
      rendimientoCantidad: restauranteRecetas.rendimientoCantidad,
      precioVenta: restauranteRecetas.precioVenta,
    })
    .from(restauranteRecetas)
    .where(and(eq(restauranteRecetas.id, recetaId), eq(restauranteRecetas.empresaId, empresaId)))
    .limit(1);
  if (!receta) return;
  const [totales] = await tx
    .select({
      costo: sql<string>`COALESCE(SUM(${restauranteRecetaIngredientes.cantidad} * ${restauranteRecetaIngredientes.costoUnitario}), 0)`,
    })
    .from(restauranteRecetaIngredientes)
    .where(
      and(
        eq(restauranteRecetaIngredientes.recetaId, recetaId),
        eq(restauranteRecetaIngredientes.empresaId, empresaId),
      ),
    );
  const costoTotal = dinero(totales?.costo ?? "0");
  const rendimiento = parseFloat(receta.rendimientoCantidad);
  const precioVenta = parseFloat(receta.precioVenta);
  const costoPorPorcion = calcularCostoPorPorcion(costoTotal, rendimiento);
  await tx
    .update(restauranteRecetas)
    .set({
      costoTotal: aDecimalStr(costoTotal),
      costoPorPorcion: aDecimalStr(costoPorPorcion),
      foodCostPct: aDecimalStr(calcularFoodCostPct(costoPorPorcion, precioVenta)),
      actualizadoEn: new Date(),
    })
    .where(eq(restauranteRecetas.id, recetaId));
}

async function recalcularOrden(tx: Tx, empresaId: string, ordenId: string) {
  const [totales] = await tx
    .select({
      subtotal: sql<string>`COALESCE(SUM((${restauranteOrdenItems.cantidad} * ${restauranteOrdenItems.precioUnitario}) - ${restauranteOrdenItems.descuento}), 0)`,
      descuento: sql<string>`COALESCE(SUM(${restauranteOrdenItems.descuento}), 0)`,
      impuesto: sql<string>`COALESCE(SUM(${restauranteOrdenItems.impuesto}), 0)`,
    })
    .from(restauranteOrdenItems)
    .where(
      and(
        eq(restauranteOrdenItems.empresaId, empresaId),
        eq(restauranteOrdenItems.ordenId, ordenId),
        ne(restauranteOrdenItems.estado, "cancelado"),
      ),
    );
  const subtotal = dinero(totales?.subtotal ?? "0");
  const descuento = dinero(totales?.descuento ?? "0");
  const impuesto = dinero(totales?.impuesto ?? "0");
  const total = dinero(subtotal + impuesto);
  await tx
    .update(restauranteOrdenes)
    .set({
      subtotal: aDecimalStr(subtotal),
      descuento: aDecimalStr(descuento),
      impuesto: aDecimalStr(impuesto),
      total: aDecimalStr(total),
      actualizadoEn: new Date(),
      version: sql`${restauranteOrdenes.version} + 1`,
    })
    .where(and(eq(restauranteOrdenes.id, ordenId), eq(restauranteOrdenes.empresaId, empresaId)));
}

async function asegurarEstacionDefault(tx: Tx, empresaId: string, sucursalId: string) {
  const [estacion] = await tx
    .select({ id: restauranteEstaciones.id })
    .from(restauranteEstaciones)
    .where(
      and(
        eq(restauranteEstaciones.empresaId, empresaId),
        eq(restauranteEstaciones.sucursalId, sucursalId),
        eq(restauranteEstaciones.activa, true),
      ),
    )
    .orderBy(restauranteEstaciones.orden)
    .limit(1);
  if (estacion) return estacion;
  const [creada] = await tx
    .insert(restauranteEstaciones)
    .values({
      empresaId,
      sucursalId,
      nombre: "Cocina",
      tipo: "cocina",
      orden: 10,
    })
    .returning({ id: restauranteEstaciones.id });
  return creada;
}

async function siguienteNumeroOrden(tx: Tx, empresaId: string): Promise<string> {
  const anio = new Date().getFullYear();
  const prefijo = `R-${anio}-`;
  const [ultimo] = await tx
    .select({ numero: restauranteOrdenes.numero })
    .from(restauranteOrdenes)
    .where(and(eq(restauranteOrdenes.empresaId, empresaId), like(restauranteOrdenes.numero, `${prefijo}%`)))
    .orderBy(desc(restauranteOrdenes.numero))
    .limit(1);
  const siguiente = ultimo ? parseInt(ultimo.numero.split("-").pop() ?? "0", 10) + 1 : 1;
  return prefijo + String(siguiente).padStart(6, "0");
}

async function siguienteNumeroComanda(tx: Tx, empresaId: string): Promise<string> {
  const anio = new Date().getFullYear();
  const prefijo = `C-${anio}-`;
  const [ultimo] = await tx
    .select({ numero: restauranteComandas.numero })
    .from(restauranteComandas)
    .where(and(eq(restauranteComandas.empresaId, empresaId), like(restauranteComandas.numero, `${prefijo}%`)))
    .orderBy(desc(restauranteComandas.numero))
    .limit(1);
  const siguiente = ultimo ? parseInt(ultimo.numero.split("-").pop() ?? "0", 10) + 1 : 1;
  return prefijo + String(siguiente).padStart(6, "0");
}
