import { redirect } from "next/navigation";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  productos,
  clientes,
  sucursales,
  almacenes,
  existencias,
  formasPago,
  impuestos,
  empresas,
  cajas,
  sesionesCaja,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { POSContenedor } from "@/components/pos/POSContenedor";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";

export default async function POSPage() {
  const user = await requireSession();

  const [empresa] = await db
    .select({ pais: empresas.pais, moneda: empresas.moneda })
    .from(empresas)
    .where(eq(empresas.id, user.empresaId))
    .limit(1);

  const scope = await getSucursalScope(user);
  const sucursalIds = selectedSucursalIds(scope);
  const sucursalesActivas = await db
    .select({ id: sucursales.id, nombre: sucursales.nombre, esPrincipal: sucursales.esPrincipal })
    .from(sucursales)
    .where(
      and(
        eq(sucursales.empresaId, user.empresaId),
        eq(sucursales.activa, true),
        isNull(sucursales.eliminadoEn),
        sucursalIds ? inArray(sucursales.id, sucursalIds) : undefined,
      ),
    )
    .orderBy(desc(sucursales.esPrincipal), sucursales.nombre);

  const sucursalOperativa =
    sucursalIds?.length === 1
      ? sucursalesActivas[0]
      : sucursalesActivas.find((s) => s.esPrincipal) ?? sucursalesActivas[0];

  if (!sucursalOperativa) {
    redirect("/configuracion/sucursales");
  }

  const [almacenOperativo] = await db
    .select({ id: almacenes.id, nombre: almacenes.nombre })
    .from(almacenes)
    .where(
      and(
        eq(almacenes.empresaId, user.empresaId),
        eq(almacenes.sucursalId, sucursalOperativa.id),
        eq(almacenes.activo, true),
      ),
    )
    .orderBy(desc(almacenes.esPrincipal), almacenes.nombre)
    .limit(1);

  if (!almacenOperativo) {
    redirect("/configuracion/sucursales");
  }

  const stockRows = await db
    .select({ productoId: existencias.productoId })
    .from(existencias)
    .where(
      and(
        eq(existencias.empresaId, user.empresaId),
        eq(existencias.almacenId, almacenOperativo.id),
      ),
    );
  const productosEnAlmacen = [...new Set(stockRows.map((row) => row.productoId))];
  const filtroProductoOperativo =
    productosEnAlmacen.length > 0
      ? or(eq(productos.tipo, "servicio"), inArray(productos.id, productosEnAlmacen))
      : eq(productos.tipo, "servicio");

  const productosList = await db
    .select({
      id: productos.id,
      sku: productos.sku,
      codigoBarras: productos.codigoBarras,
      nombre: productos.nombre,
      precio: productos.precioBase,
      costo: productos.costoPromedio,
      impuestoId: productos.impuestoId,
    })
    .from(productos)
    .where(
      and(
        eq(productos.empresaId, user.empresaId),
        eq(productos.activo, true),
        isNull(productos.eliminadoEn),
        filtroProductoOperativo,
      ),
    )
    .orderBy(desc(productos.creadoEn))
    .limit(500);

  const impuestosList = await db
    .select({ id: impuestos.id, tasa: impuestos.tasa })
    .from(impuestos)
    .where(eq(impuestos.empresaId, user.empresaId));
  const mapaImpuestos = new Map(impuestosList.map((i) => [i.id, parseFloat(i.tasa)]));

  const clientesList = await db
    .select({
      id: clientes.id,
      nombre: clientes.nombre,
      limiteCredito: clientes.limiteCredito,
      diasCredito: clientes.diasCredito,
      esConsumidorFinal: clientes.esConsumidorFinal,
    })
    .from(clientes)
    .where(and(eq(clientes.empresaId, user.empresaId), isNull(clientes.eliminadoEn)))
    .limit(500);

  const formasPagoList = await db
    .select({
      id: formasPago.id,
      codigo: formasPago.codigo,
      nombre: formasPago.nombre,
      requiereReferencia: formasPago.requiereReferencia,
    })
    .from(formasPago)
    .where(and(eq(formasPago.empresaId, user.empresaId), eq(formasPago.activa, true)));

  // Sesión de caja abierta para la sucursal operativa (si existe).
  const [sesionAbierta] = await db
    .select({ id: sesionesCaja.id, cajaNombre: cajas.nombre })
    .from(sesionesCaja)
    .innerJoin(cajas, eq(cajas.id, sesionesCaja.cajaId))
    .where(
      and(
        eq(sesionesCaja.empresaId, user.empresaId),
        eq(sesionesCaja.estado, "abierta"),
        eq(cajas.sucursalId, sucursalOperativa.id),
      ),
    )
    .limit(1);

  // Cajas activas de la sucursal para poder abrir sesión desde el POS.
  const cajasSucursal = await db
    .select({ id: cajas.id, codigo: cajas.codigo, nombre: cajas.nombre })
    .from(cajas)
    .where(
      and(
        eq(cajas.empresaId, user.empresaId),
        eq(cajas.sucursalId, sucursalOperativa.id),
        eq(cajas.activa, true),
      ),
    );

  return (
    <POSContenedor
      pais={empresa?.pais ?? "NI"}
      sucursalId={sucursalOperativa.id}
      sucursalNombre={sucursalOperativa.nombre}
      almacenId={almacenOperativo.id}
      nombreUsuario={user.nombre}
      hayCajaAbierta={!!sesionAbierta}
      cajas={cajasSucursal.map((c) => ({
        value: c.id,
        label: `${c.codigo} — ${c.nombre}`,
      }))}
      productos={productosList.map((p) => ({
        id: p.id,
        sku: p.sku,
        codigoBarras: p.codigoBarras ?? "",
        nombre: p.nombre,
        precio: parseFloat(p.precio),
        costo: parseFloat(p.costo),
        impuestoTasa: p.impuestoId ? (mapaImpuestos.get(p.impuestoId) ?? 0) : 0,
      }))}
      clientes={clientesList.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        tieneCredito: parseFloat(c.limiteCredito) > 0,
        diasCredito: c.diasCredito,
        esConsumidorFinal: c.esConsumidorFinal,
      }))}
      formasPago={formasPagoList}
    />
  );
}
