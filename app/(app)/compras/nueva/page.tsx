import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  proveedores,
  almacenes,
  cuentasFinancieras,
  productos,
  impuestos,
  empresas,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { NuevaCompraForm } from "@/components/compras/NuevaCompraForm";

export default async function NuevaCompraPage() {
  const user = await requireSession();
  const [empresa] = await db
    .select({ pais: empresas.pais })
    .from(empresas)
    .where(eq(empresas.id, user.empresaId))
    .limit(1);

  const [provs, alms, cfs, prods, imps] = await Promise.all([
    db
      .select({
        id: proveedores.id,
        razonSocial: proveedores.razonSocial,
        diasCredito: proveedores.diasCredito,
      })
      .from(proveedores)
      .where(and(eq(proveedores.empresaId, user.empresaId), isNull(proveedores.eliminadoEn))),
    db
      .select({ id: almacenes.id, nombre: almacenes.nombre })
      .from(almacenes)
      .where(eq(almacenes.empresaId, user.empresaId)),
    db
      .select({ id: cuentasFinancieras.id, nombre: cuentasFinancieras.nombre })
      .from(cuentasFinancieras)
      .where(
        and(
          eq(cuentasFinancieras.empresaId, user.empresaId),
          eq(cuentasFinancieras.activa, true),
        ),
      ),
    db
      .select({
        id: productos.id,
        sku: productos.sku,
        nombre: productos.nombre,
        costoPromedio: productos.costoPromedio,
        impuestoId: productos.impuestoId,
      })
      .from(productos)
      .where(
        and(
          eq(productos.empresaId, user.empresaId),
          eq(productos.activo, true),
          isNull(productos.eliminadoEn),
        ),
      ),
    db
      .select({ id: impuestos.id, tasa: impuestos.tasa })
      .from(impuestos)
      .where(eq(impuestos.empresaId, user.empresaId)),
  ]);

  const mapaImp = new Map(imps.map((i) => [i.id, parseFloat(i.tasa)]));

  return (
    <div>
      <PageHeader
        title="Registrar compra"
        subtitle="Entrada de inventario + cuenta por pagar (si aplica)"
      />
      <NuevaCompraForm
        pais={empresa?.pais ?? "NI"}
        proveedores={provs.map((p) => ({
          value: p.id,
          label: p.razonSocial,
          diasCredito: p.diasCredito,
        }))}
        almacenes={alms.map((a) => ({ value: a.id, label: a.nombre }))}
        cuentasFinancieras={cfs}
        productos={prods.map((p) => ({
          id: p.id,
          sku: p.sku,
          nombre: p.nombre,
          costoActual: parseFloat(p.costoPromedio),
          impuestoTasa: p.impuestoId ? (mapaImp.get(p.impuestoId) ?? 0) : 0,
        }))}
      />
    </div>
  );
}
