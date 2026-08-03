"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  almacenes,
  empresas,
  existencias,
  menuPlatillos,
  menusVirtuales,
  pedidoCocinaItems,
  pedidosCocina,
  productos,
  sucursales,
} from "@/lib/db/schema";
import { pedidoMenuPublicoSchema } from "@/lib/validations/restaurante";
import { aDecimalStr } from "@/lib/contabilidad/helpers";

type ResultadoPedidoPublico =
  | { ok: true; numero: string }
  | { ok: false; error: string };

export async function crearPedidoMenuPublico(
  input: unknown,
): Promise<ResultadoPedidoPublico> {
  const parsed = pedidoMenuPublicoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const data = parsed.data;

  const [row] = await db
    .select({
      menu: menusVirtuales,
      empresa: {
        id: empresas.id,
        activa: empresas.activa,
        tipoEmpresa: empresas.tipoEmpresa,
      },
    })
    .from(menusVirtuales)
    .innerJoin(empresas, eq(empresas.id, menusVirtuales.empresaId))
    .where(and(eq(menusVirtuales.slug, data.slug), eq(menusVirtuales.publicado, true)))
    .limit(1);

  if (!row || !row.empresa.activa || row.empresa.tipoEmpresa !== "restaurante") {
    return { ok: false, error: "Menu no disponible." };
  }

  const sucursal = row.menu.sucursalId
    ? await buscarSucursal(row.empresa.id, row.menu.sucursalId)
    : await buscarSucursalPrincipal(row.empresa.id);
  if (!sucursal) {
    return { ok: false, error: "El restaurante no tiene sucursal activa para recibir pedidos." };
  }

  const mesaNumero = limpiarMesa(data.mesaNumero);
  if (mesaNumero) {
    const mesa = Number(mesaNumero);
    if (!Number.isInteger(mesa) || mesa < 1 || mesa > row.menu.cantidadMesas) {
      return { ok: false, error: "Mesa no disponible para este menu." };
    }
  }

  const cantidades = new Map<string, number>();
  for (const item of data.items) {
    cantidades.set(item.platilloId, (cantidades.get(item.platilloId) ?? 0) + item.cantidad);
  }
  const platilloIds = [...cantidades.keys()];

  const platillos = await db
    .select({
      id: menuPlatillos.id,
      nombre: menuPlatillos.nombre,
      productoId: menuPlatillos.productoId,
      disponible: menuPlatillos.disponible,
    })
    .from(menuPlatillos)
    .where(
      and(
        eq(menuPlatillos.menuId, row.menu.id),
        eq(menuPlatillos.empresaId, row.empresa.id),
        eq(menuPlatillos.disponible, true),
        inArray(menuPlatillos.id, platilloIds),
      ),
    );
  if (platillos.length !== platilloIds.length) {
    return { ok: false, error: "Uno o mas platillos ya no estan disponibles." };
  }

  const productoIds = [
    ...new Set(platillos.flatMap((platillo) => (platillo.productoId ? [platillo.productoId] : []))),
  ];
  const productosRows = productoIds.length
    ? await db
        .select({ id: productos.id, tipo: productos.tipo })
        .from(productos)
        .where(
          and(
            eq(productos.empresaId, row.empresa.id),
            eq(productos.activo, true),
            isNull(productos.eliminadoEn),
            inArray(productos.id, productoIds),
          ),
        )
    : [];
  const tipoPorProducto = new Map(productosRows.map((producto) => [producto.id, producto.tipo]));
  const stockPorProducto = productoIds.length
    ? await stockDisponiblePorProducto(row.empresa.id, sucursal.id, productoIds)
    : new Map<string, number>();

  for (const platillo of platillos) {
    if (!platillo.productoId) continue;
    const tipoProducto = tipoPorProducto.get(platillo.productoId);
    if (!tipoProducto) {
      return {
        ok: false,
        error: `${platillo.nombre} no esta disponible en este momento.`,
      };
    }
    if (tipoProducto === "servicio") continue;
    const solicitado = cantidades.get(platillo.id) ?? 0;
    const disponible = stockPorProducto.get(platillo.productoId) ?? 0;
    if (disponible < solicitado) {
      return {
        ok: false,
        error: `${platillo.nombre} no tiene inventario suficiente en este momento.`,
      };
    }
  }

  const numero = `M-${Date.now().toString(36).toUpperCase()}`;
  await db.transaction(async (tx) => {
    const [pedido] = await tx
      .insert(pedidosCocina)
      .values({
        empresaId: row.empresa.id,
        sucursalId: sucursal.id,
        ventaId: null,
        menuId: row.menu.id,
        numero,
        origen: "menu_virtual",
        mesaNumero,
        clienteNombre: limpiarVacio(data.clienteNombre) ?? (mesaNumero ? `Mesa ${mesaNumero}` : null),
        clienteTelefono: limpiarVacio(data.clienteTelefono),
        clienteDireccion: data.clienteDireccion || null,
        notas: data.notas || null,
        estado: "nuevo",
      })
      .returning({ id: pedidosCocina.id });

    await tx.insert(pedidoCocinaItems).values(
      platillos.map((platillo) => ({
        pedidoId: pedido.id,
        productoId: platillo.productoId,
        nombre: platillo.nombre,
        cantidad: aDecimalStr(cantidades.get(platillo.id) ?? 1),
      })),
    );
  });

  revalidatePath("/pedidos-cocina");
  return { ok: true, numero };
}

function limpiarMesa(valor?: string | null): string | null {
  const limpio = valor?.trim();
  return limpio ? limpio : null;
}

function limpiarVacio(valor?: string | null): string | null {
  const limpio = valor?.trim();
  return limpio ? limpio : null;
}

async function buscarSucursal(empresaId: string, sucursalId: string) {
  const [sucursal] = await db
    .select({ id: sucursales.id })
    .from(sucursales)
    .where(
      and(
        eq(sucursales.id, sucursalId),
        eq(sucursales.empresaId, empresaId),
        eq(sucursales.activa, true),
        isNull(sucursales.eliminadoEn),
      ),
    )
    .limit(1);
  return sucursal ?? null;
}

async function buscarSucursalPrincipal(empresaId: string) {
  const [sucursal] = await db
    .select({ id: sucursales.id })
    .from(sucursales)
    .where(
      and(
        eq(sucursales.empresaId, empresaId),
        eq(sucursales.activa, true),
        isNull(sucursales.eliminadoEn),
      ),
    )
    .orderBy(sql`${sucursales.esPrincipal} desc`, sucursales.nombre)
    .limit(1);
  return sucursal ?? null;
}

async function stockDisponiblePorProducto(
  empresaId: string,
  sucursalId: string,
  productoIds: string[],
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      productoId: existencias.productoId,
      cantidad: sql<string>`COALESCE(SUM(${existencias.cantidad}), 0)`,
    })
    .from(existencias)
    .innerJoin(almacenes, eq(almacenes.id, existencias.almacenId))
    .where(
      and(
        eq(existencias.empresaId, empresaId),
        eq(almacenes.empresaId, empresaId),
        eq(almacenes.sucursalId, sucursalId),
        eq(almacenes.activo, true),
        inArray(existencias.productoId, productoIds),
      ),
    )
    .groupBy(existencias.productoId);
  return new Map(rows.map((row) => [row.productoId, parseFloat(row.cantidad)]));
}
