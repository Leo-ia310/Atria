import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  categorias,
  marcas,
  unidadesMedida,
  impuestos,
  productos,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProductoForm } from "@/components/productos/ProductoForm";
import { desdeDecimal } from "@/lib/utils";

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireSession();

  const [producto] = await db
    .select()
    .from(productos)
    .where(
      and(
        eq(productos.id, id),
        eq(productos.empresaId, user.empresaId),
        isNull(productos.eliminadoEn),
      ),
    )
    .limit(1);

  if (!producto) notFound();

  const [cats, mks, uns, imps] = await Promise.all([
    db.select({ id: categorias.id, nombre: categorias.nombre }).from(categorias).where(eq(categorias.empresaId, user.empresaId)),
    db.select({ id: marcas.id, nombre: marcas.nombre }).from(marcas).where(eq(marcas.empresaId, user.empresaId)),
    db.select({ id: unidadesMedida.id, nombre: unidadesMedida.nombre }).from(unidadesMedida).where(eq(unidadesMedida.empresaId, user.empresaId)),
    db.select({ id: impuestos.id, nombre: impuestos.nombre, tasa: impuestos.tasa }).from(impuestos).where(eq(impuestos.empresaId, user.empresaId)),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={producto.nombre} subtitle={`SKU ${producto.sku}`} />
      <ProductoForm
        productoId={producto.id}
        defaults={{
          sku: producto.sku,
          codigoBarras: producto.codigoBarras ?? "",
          nombre: producto.nombre,
          descripcion: producto.descripcion ?? "",
          tipo: producto.tipo,
          categoriaId: producto.categoriaId ?? "",
          marcaId: producto.marcaId ?? "",
          unidadBaseId: producto.unidadBaseId ?? "",
          impuestoId: producto.impuestoId ?? "",
          precioBase: desdeDecimal(producto.precioBase),
          costoPromedio: desdeDecimal(producto.costoPromedio),
          stockMinimo: desdeDecimal(producto.stockMinimo),
          stockMaximo: producto.stockMaximo ? desdeDecimal(producto.stockMaximo) : undefined,
          metodoCosteo: producto.metodoCosteo,
          manejaLotes: producto.manejaLotes,
          manejaSeries: producto.manejaSeries,
          fechaVencimiento: producto.fechaVencimiento ?? "",
        }}
        categorias={cats.map((c) => ({ value: c.id, label: c.nombre }))}
        marcas={mks.map((m) => ({ value: m.id, label: m.nombre }))}
        unidades={uns.map((u) => ({ value: u.id, label: u.nombre }))}
        impuestos={imps.map((i) => ({
          value: i.id,
          label: `${i.nombre} (${(parseFloat(i.tasa) * 100).toFixed(0)}%)`,
        }))}
      />
    </div>
  );
}
