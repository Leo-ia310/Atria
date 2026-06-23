import { redirect } from "next/navigation";
import { and, eq, isNull, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  productos,
  clientes,
  sucursales,
  almacenes,
  formasPago,
  impuestos,
  empresas,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { POSContenedor } from "@/components/pos/POSContenedor";

export default async function POSPage() {
  const user = await requireSession();

  const [empresa] = await db
    .select({ pais: empresas.pais, moneda: empresas.moneda })
    .from(empresas)
    .where(eq(empresas.id, user.empresaId))
    .limit(1);

  const [sucursalPrincipal] = await db
    .select({ id: sucursales.id, nombre: sucursales.nombre })
    .from(sucursales)
    .where(
      and(
        eq(sucursales.empresaId, user.empresaId),
        eq(sucursales.esPrincipal, true),
        isNull(sucursales.eliminadoEn),
      ),
    )
    .limit(1);

  if (!sucursalPrincipal) {
    redirect("/configuracion/sucursales");
  }

  const [almacenPrincipal] = await db
    .select({ id: almacenes.id, nombre: almacenes.nombre })
    .from(almacenes)
    .where(
      and(
        eq(almacenes.empresaId, user.empresaId),
        eq(almacenes.esPrincipal, true),
      ),
    )
    .limit(1);

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

  return (
    <POSContenedor
      pais={empresa?.pais ?? "NI"}
      sucursalId={sucursalPrincipal.id}
      sucursalNombre={sucursalPrincipal.nombre}
      almacenId={almacenPrincipal!.id}
      nombreUsuario={user.nombre}
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
