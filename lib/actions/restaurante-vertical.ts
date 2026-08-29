"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray, isNull, like, ne, or, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { dbConEmpresa, dbSuperAdmin, type Tx } from "@/lib/db";
import {
  almacenes,
  auditoria,
  cajas,
  categorias,
  empresas,
  existencias,
  facturas,
  formasPago,
  menuPlatillos,
  menusVirtuales,
  movimientosInventario,
  pagosVenta,
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
  sesionesCaja,
  sucursales,
  unidadesMedida,
  ventaDetalle,
  ventas,
} from "@/lib/db/schema";
import { requireSession, type SessionUser } from "@/lib/actions/session-helpers";
import { validarAccion } from "@/lib/server-access";
import { aDecimalStr, dinero, siguienteNumero } from "@/lib/contabilidad/helpers";
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
  restauranteCobroOrdenSchema,
  restauranteEnviarComandaSchema,
  restauranteEsperaSchema,
  restauranteMermaSchema,
  restauranteMesaEstadoSchema,
  restauranteMesaLimpiaSchema,
  restauranteMesaSchema,
  restauranteOrdenItemSchema,
  restauranteOrdenSchema,
  restauranteProductoSchema,
  restaurantePromocionSchema,
  restauranteRecetaIngredienteSchema,
  restauranteRecetaSchema,
  restauranteReservacionSchema,
  restauranteSolicitarCuentaSchema,
} from "@/lib/validations/restaurante-vertical";
import { rateLimit } from "@/lib/redis/rate-limit";

type Resultado = { ok: true; id?: string; token?: string; numero?: string } | { ok: false; error: string };
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

function destinoFeedbackRestaurante(formData: FormData): string | null {
  const destino = texto(formData, "redirectTo").trim();
  const [ruta] = destino.split(/[?#]/);
  if (!ruta || ruta.startsWith("//") || (ruta !== "/restaurante" && !ruta.startsWith("/restaurante/"))) {
    return null;
  }
  return ruta;
}

function redirigirConFeedback(
  formData: FormData,
  resultado: Resultado,
  mensajeOk: string,
  params: Record<string, string | undefined> = {},
): void {
  const destino = destinoFeedbackRestaurante(formData);
  if (!destino) return;

  const query = new URLSearchParams();
  if (resultado.ok) {
    query.set("guardado", mensajeOk);
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }
  } else {
    query.set("error", resultado.error);
  }
  const ancla = params.ordenId ? `#orden-${encodeURIComponent(params.ordenId)}` : "";
  redirect(`${destino}?${query.toString()}${ancla}`);
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
        .select({ id: restauranteOrdenes.id, numero: restauranteOrdenes.numero })
        .from(restauranteOrdenes)
        .where(
          and(
            eq(restauranteOrdenes.empresaId, user.empresaId),
            eq(restauranteOrdenes.idempotencyKey, data.idempotencyKey),
          ),
        )
        .limit(1);
      if (existente) {
        return { ok: true as const, id: existente.id, numero: existente.numero };
      }
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
      .returning({ id: restauranteOrdenes.id, numero: restauranteOrdenes.numero });

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
    return { ok: true as const, id: orden.id, numero: orden.numero };
  });
  revalidatePath("/restaurante/pos");
  revalidatePath("/restaurante/ordenes");
  revalidatePath("/restaurante/mesas");
  return resultado;
}

export async function crearOrdenRestauranteForm(formData: FormData): Promise<void> {
  const resultado = await crearOrdenRestaurante(formData);
  redirigirConFeedback(
    formData,
    resultado,
    resultado.ok && resultado.numero ? `Orden ${resultado.numero} creada.` : "Orden creada.",
    {
      ordenId: resultado.ok ? resultado.id : undefined,
      ordenNumero: resultado.ok ? resultado.numero : undefined,
    },
  );
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

    const precioUnitario = parseFloat(producto.precioBase);
    const costoUnitario = parseFloat(producto.costoPromedio);
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
  const resultado = await agregarItemOrdenRestaurante(formData);
  redirigirConFeedback(formData, resultado, "Producto agregado a la orden.", {
    ordenId: texto(formData, "ordenId"),
  });
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
  revalidatePath("/restaurante/pos");
  revalidatePath("/restaurante/ordenes");
  revalidatePath("/restaurante");
  return resultado;
}

export async function enviarComandasOrdenRestauranteForm(formData: FormData): Promise<void> {
  const resultado = await enviarComandasOrdenRestaurante(formData);
  redirigirConFeedback(formData, resultado, "Comanda enviada a cocina.", {
    ordenId: texto(formData, "ordenId"),
  });
}

export async function solicitarCuentaRestaurante(formData: FormData): Promise<Resultado> {
  const acceso = await requireRestaurante("restaurante-ordenes", "restaurante.ordenes.editar");
  if (!acceso.ok) return acceso;
  const parsed = restauranteSolicitarCuentaSchema.safeParse({
    ordenId: texto(formData, "ordenId"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const { user } = acceso;
  const { ordenId } = parsed.data;
  const resultado = await dbConEmpresa(user.empresaId, async (tx) => {
    const [orden] = await tx
      .select({
        id: restauranteOrdenes.id,
        estado: restauranteOrdenes.estado,
        mesaId: restauranteOrdenes.mesaId,
      })
      .from(restauranteOrdenes)
      .where(and(eq(restauranteOrdenes.id, ordenId), eq(restauranteOrdenes.empresaId, user.empresaId)))
      .limit(1);
    if (!orden) return { ok: false as const, error: "Orden no encontrada" };
    if (orden.estado === "pagada" || orden.estado === "cancelada") {
      return { ok: false as const, error: "La orden ya esta cerrada." };
    }

    const [conteo] = await tx
      .select({
        items: sql<string>`COUNT(*)`,
      })
      .from(restauranteOrdenItems)
      .where(
        and(
          eq(restauranteOrdenItems.empresaId, user.empresaId),
          eq(restauranteOrdenItems.ordenId, ordenId),
          ne(restauranteOrdenItems.estado, "cancelado"),
        ),
      );
    if (Number(conteo?.items ?? 0) === 0) {
      return { ok: false as const, error: "Agrega productos antes de solicitar la cuenta." };
    }
    if (orden.estado === "cuenta_solicitada") {
      return { ok: true as const, id: orden.id };
    }

    const ahora = new Date();
    await tx
      .update(restauranteOrdenes)
      .set({
        estado: "cuenta_solicitada",
        cuentaSolicitadaEn: ahora,
        actualizadoEn: ahora,
        version: sql`${restauranteOrdenes.version} + 1`,
      })
      .where(and(eq(restauranteOrdenes.id, ordenId), eq(restauranteOrdenes.empresaId, user.empresaId)));

    if (orden.mesaId) {
      await tx
        .update(restauranteMesas)
        .set({ estado: "cuenta_solicitada", actualizadoEn: ahora })
        .where(
          and(
            eq(restauranteMesas.id, orden.mesaId),
            eq(restauranteMesas.empresaId, user.empresaId),
          ),
        );
    }

    await auditar(tx, {
      empresaId: user.empresaId,
      usuarioId: user.id,
      accion: "restaurante.orden.solicitar_cuenta",
      tabla: "restaurante_ordenes",
      registroId: ordenId,
      datosDespues: { estado: "cuenta_solicitada", mesaId: orden.mesaId },
    });
    return { ok: true as const, id: orden.id };
  });
  revalidarAtencionRestaurante();
  return resultado;
}

export async function solicitarCuentaRestauranteForm(formData: FormData): Promise<void> {
  const resultado = await solicitarCuentaRestaurante(formData);
  redirigirConFeedback(formData, resultado, "Cuenta solicitada.", {
    ordenId: texto(formData, "ordenId"),
  });
}

export async function cobrarOrdenRestaurante(formData: FormData): Promise<Resultado> {
  const acceso = await requireRestaurante("restaurante-ordenes", [
    "restaurante.ordenes.editar",
    "ventas.crear",
  ]);
  if (!acceso.ok) return acceso;
  const parsed = restauranteCobroOrdenSchema.safeParse({
    ordenId: texto(formData, "ordenId"),
    formaPagoId: texto(formData, "formaPagoId"),
    referencia: texto(formData, "referencia"),
    propina: texto(formData, "propina") || "0",
    idempotencyKey: texto(formData, "idempotencyKey"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const { user } = acceso;
  const data = parsed.data;
  const resultado = await dbConEmpresa(user.empresaId, async (tx) => {
    const [ordenBloqueada] = await tx
      .update(restauranteOrdenes)
      .set({
        actualizadoEn: new Date(),
        version: sql`${restauranteOrdenes.version} + 1`,
      })
      .where(
        and(
          eq(restauranteOrdenes.id, data.ordenId),
          eq(restauranteOrdenes.empresaId, user.empresaId),
          inArray(restauranteOrdenes.estado, [
            "abierta",
            "borrador",
            "en_cocina",
            "cuenta_solicitada",
          ]),
        ),
      )
      .returning({
        id: restauranteOrdenes.id,
        numero: restauranteOrdenes.numero,
        sucursalId: restauranteOrdenes.sucursalId,
        mesaId: restauranteOrdenes.mesaId,
        ventaId: restauranteOrdenes.ventaId,
        estado: restauranteOrdenes.estado,
        personas: restauranteOrdenes.personas,
      });

    if (!ordenBloqueada) {
      const [ordenExistente] = await tx
        .select({
          id: restauranteOrdenes.id,
          ventaId: restauranteOrdenes.ventaId,
          estado: restauranteOrdenes.estado,
        })
        .from(restauranteOrdenes)
        .where(
          and(
            eq(restauranteOrdenes.id, data.ordenId),
            eq(restauranteOrdenes.empresaId, user.empresaId),
          ),
        )
        .limit(1);
      if (ordenExistente?.estado === "pagada" && ordenExistente.ventaId) {
        return { ok: true as const, id: ordenExistente.ventaId };
      }
      return { ok: false as const, error: "Orden no disponible para cobrar." };
    }

    const [[formaPago], items, sesionesAbiertas] = await Promise.all([
      tx
        .select({
          id: formasPago.id,
          nombre: formasPago.nombre,
          requiereReferencia: formasPago.requiereReferencia,
        })
        .from(formasPago)
        .where(
          and(
            eq(formasPago.id, data.formaPagoId),
            eq(formasPago.empresaId, user.empresaId),
            eq(formasPago.activa, true),
          ),
        )
        .limit(1),
      tx
        .select({
          id: restauranteOrdenItems.id,
          productoId: restauranteOrdenItems.productoId,
          nombreSnapshot: restauranteOrdenItems.nombreSnapshot,
          cantidad: restauranteOrdenItems.cantidad,
          precioUnitario: restauranteOrdenItems.precioUnitario,
          descuento: restauranteOrdenItems.descuento,
          impuesto: restauranteOrdenItems.impuesto,
          costoUnitario: restauranteOrdenItems.costoUnitario,
          estado: restauranteOrdenItems.estado,
        })
        .from(restauranteOrdenItems)
        .where(
          and(
            eq(restauranteOrdenItems.empresaId, user.empresaId),
            eq(restauranteOrdenItems.ordenId, data.ordenId),
            ne(restauranteOrdenItems.estado, "cancelado"),
          ),
        ),
      tx
        .select({ id: sesionesCaja.id, usuarioId: sesionesCaja.usuarioId })
        .from(sesionesCaja)
        .innerJoin(cajas, eq(cajas.id, sesionesCaja.cajaId))
        .where(
          and(
            eq(sesionesCaja.empresaId, user.empresaId),
            eq(sesionesCaja.estado, "abierta"),
            eq(cajas.empresaId, user.empresaId),
            eq(cajas.sucursalId, ordenBloqueada.sucursalId),
          ),
        )
        .orderBy(desc(sesionesCaja.abiertaEn)),
    ]);

    if (!formaPago) return { ok: false as const, error: "Forma de pago no valida." };
    if (formaPago.requiereReferencia && !data.referencia) {
      return { ok: false as const, error: "Esta forma de pago requiere referencia." };
    }
    if (items.length === 0) {
      return { ok: false as const, error: "No se puede cobrar una orden sin productos." };
    }

    const subtotal = dinero(
      ...items.map((item) =>
        dinero(
          parseFloat(item.cantidad) * parseFloat(item.precioUnitario) -
            parseFloat(item.descuento),
        ),
      ),
    );
    const descuento = dinero(...items.map((item) => item.descuento));
    const impuesto = dinero(...items.map((item) => item.impuesto));
    const propina = dinero(data.propina);
    const total = dinero(subtotal + impuesto + propina);
    const costoTotal = dinero(
      ...items.map((item) =>
        dinero(parseFloat(item.cantidad) * parseFloat(item.costoUnitario)),
      ),
    );
    const sesionCajaId =
      sesionesAbiertas.find((sesion) => sesion.usuarioId === user.id)?.id ??
      sesionesAbiertas[0]?.id ??
      null;
    const ahora = new Date();
    const numeroVenta = await siguienteNumero(tx, {
      empresaId: user.empresaId,
      prefijo: "RV",
      fecha: ahora,
      tabla: ventas,
      columnaNumero: ventas.numero,
    });

    const [venta] = await tx
      .insert(ventas)
      .values({
        empresaId: user.empresaId,
        sucursalId: ordenBloqueada.sucursalId,
        sesionCajaId,
        clienteId: null,
        numero: numeroVenta,
        fecha: ahora,
        estado: "completada",
        esCredito: false,
        diasCredito: 0,
        subtotal: aDecimalStr(subtotal),
        descuento: aDecimalStr(descuento),
        impuesto: aDecimalStr(impuesto),
        total: aDecimalStr(total),
        costoTotal: aDecimalStr(costoTotal),
        notas: `Restaurante ${ordenBloqueada.numero}`,
        usuarioId: user.id,
      })
      .returning({ id: ventas.id, numero: ventas.numero });

    await tx.insert(ventaDetalle).values(
      items.map((item) => {
        const cantidad = parseFloat(item.cantidad);
        const precioUnitario = parseFloat(item.precioUnitario);
        const itemDescuento = parseFloat(item.descuento);
        return {
          ventaId: venta.id,
          productoId: item.productoId,
          cantidad: aDecimalStr(cantidad),
          precioUnitario: aDecimalStr(precioUnitario),
          descuento: aDecimalStr(itemDescuento),
          impuesto: aDecimalStr(parseFloat(item.impuesto)),
          costoUnitario: aDecimalStr(parseFloat(item.costoUnitario)),
          subtotal: aDecimalStr(dinero(cantidad * precioUnitario - itemDescuento)),
        };
      }),
    );

    await tx.insert(pagosVenta).values({
      ventaId: venta.id,
      formaPagoId: formaPago.id,
      monto: aDecimalStr(total),
      referencia: data.referencia || null,
      cambio: "0.0000",
    });

    await tx.insert(facturas).values({
      empresaId: user.empresaId,
      ventaId: venta.id,
      numero: venta.numero,
      fecha: ahora,
      vendedorId: user.id,
      vendedorNombre: user.nombre,
      clienteNombre: "Consumidor final",
      formasPago: formaPago.nombre,
      esCredito: false,
      total: aDecimalStr(total),
      snapshot: {
        numero: venta.numero,
        ordenRestaurante: ordenBloqueada.numero,
        fecha: ahora.toISOString(),
        cliente: "Consumidor final",
        cajero: user.nombre,
        mesaId: ordenBloqueada.mesaId,
        personas: ordenBloqueada.personas,
        items: items.map((item) => ({
          nombre: item.nombreSnapshot,
          cantidad: parseFloat(item.cantidad),
          precioUnitario: parseFloat(item.precioUnitario),
          descuento: parseFloat(item.descuento),
          impuesto: parseFloat(item.impuesto),
          subtotal: dinero(
            parseFloat(item.cantidad) * parseFloat(item.precioUnitario) -
              parseFloat(item.descuento),
          ),
        })),
        pagos: [
          {
            formaPago: formaPago.nombre,
            monto: total,
            referencia: data.referencia || null,
          },
        ],
        subtotal,
        descuento,
        impuesto,
        propina,
        total,
      },
    });

    await tx
      .update(restauranteOrdenes)
      .set({
        ventaId: venta.id,
        estado: "pagada",
        subtotal: aDecimalStr(subtotal),
        descuento: aDecimalStr(descuento),
        impuesto: aDecimalStr(impuesto),
        propina: aDecimalStr(propina),
        total: aDecimalStr(total),
        cerradoEn: ahora,
        actualizadoEn: ahora,
        version: sql`${restauranteOrdenes.version} + 1`,
      })
      .where(
        and(
          eq(restauranteOrdenes.id, ordenBloqueada.id),
          eq(restauranteOrdenes.empresaId, user.empresaId),
        ),
      );

    if (ordenBloqueada.mesaId) {
      await tx
        .update(restauranteMesas)
        .set({ estado: "por_limpiar", actualizadoEn: ahora })
        .where(
          and(
            eq(restauranteMesas.id, ordenBloqueada.mesaId),
            eq(restauranteMesas.empresaId, user.empresaId),
          ),
        );
    }

    await auditar(tx, {
      empresaId: user.empresaId,
      usuarioId: user.id,
      accion: "restaurante.orden.cobrar",
      tabla: "restaurante_ordenes",
      registroId: ordenBloqueada.id,
      datosDespues: {
        ventaId: venta.id,
        total,
        formaPago: formaPago.nombre,
        sesionCajaId,
      },
    });
    return { ok: true as const, id: venta.id };
  });
  revalidarAtencionRestaurante();
  revalidatePath("/ventas");
  return resultado;
}

export async function cobrarOrdenRestauranteForm(formData: FormData): Promise<void> {
  const resultado = await cobrarOrdenRestaurante(formData);
  redirigirConFeedback(formData, resultado, "Orden cobrada y venta registrada.", {
    ordenId: texto(formData, "ordenId"),
  });
}

export async function marcarMesaLimpiaRestaurante(formData: FormData): Promise<Resultado> {
  const acceso = await requireRestaurante("restaurante-mesas", "restaurante.mesas.editar");
  if (!acceso.ok) return acceso;
  const parsed = restauranteMesaLimpiaSchema.safeParse({
    mesaId: texto(formData, "mesaId"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const { user } = acceso;
  const { mesaId } = parsed.data;
  const resultado = await dbConEmpresa(user.empresaId, async (tx) => {
    const [mesa] = await tx
      .select({ id: restauranteMesas.id })
      .from(restauranteMesas)
      .where(and(eq(restauranteMesas.id, mesaId), eq(restauranteMesas.empresaId, user.empresaId)))
      .limit(1);
    if (!mesa) return { ok: false as const, error: "Mesa no encontrada" };

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
      return { ok: false as const, error: "La mesa todavia tiene una orden abierta." };
    }

    await tx
      .update(restauranteMesas)
      .set({ estado: "disponible", actualizadoEn: new Date() })
      .where(and(eq(restauranteMesas.id, mesaId), eq(restauranteMesas.empresaId, user.empresaId)));
    await auditar(tx, {
      empresaId: user.empresaId,
      usuarioId: user.id,
      accion: "restaurante.mesa.marcar_limpia",
      tabla: "restaurante_mesas",
      registroId: mesaId,
      datosDespues: { estado: "disponible" },
    });
    return { ok: true as const, id: mesaId };
  });
  revalidarAtencionRestaurante();
  return resultado;
}

export async function marcarMesaLimpiaRestauranteForm(formData: FormData): Promise<void> {
  await marcarMesaLimpiaRestaurante(formData);
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

function revalidarAtencionRestaurante() {
  revalidatePath("/restaurante");
  revalidatePath("/restaurante/pos");
  revalidatePath("/restaurante/mesas");
  revalidatePath("/restaurante/ordenes");
}
