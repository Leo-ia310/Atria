import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categorias, marcas, unidadesMedida, impuestos } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProductoForm } from "@/components/productos/ProductoForm";

export default async function NuevoProductoPage() {
  const user = await requireSession();

  const [cats, mks, uns, imps] = await Promise.all([
    db
      .select({ id: categorias.id, nombre: categorias.nombre })
      .from(categorias)
      .where(eq(categorias.empresaId, user.empresaId)),
    db
      .select({ id: marcas.id, nombre: marcas.nombre })
      .from(marcas)
      .where(eq(marcas.empresaId, user.empresaId)),
    db
      .select({ id: unidadesMedida.id, nombre: unidadesMedida.nombre })
      .from(unidadesMedida)
      .where(eq(unidadesMedida.empresaId, user.empresaId)),
    db
      .select({ id: impuestos.id, nombre: impuestos.nombre, tasa: impuestos.tasa })
      .from(impuestos)
      .where(eq(impuestos.empresaId, user.empresaId)),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nuevo producto" subtitle="Agrega un nuevo SKU a tu catálogo" />
      <ProductoForm
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
