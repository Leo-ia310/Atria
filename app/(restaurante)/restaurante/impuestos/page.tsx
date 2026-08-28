import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { Scale, ShieldCheck } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import { impuestos } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import {
  RestaurantCoreModulePage,
  RestaurantModuleGrid,
  RestaurantModuleList,
} from "@/components/restaurante/RestaurantCoreModulePage";
import { porcentaje } from "@/lib/restaurante/core-pages";

export const metadata: Metadata = {
  title: "Impuestos Restaurante | ARCA",
  description: "Motor de impuestos configurable consumido por ventas y compras restaurante.",
};

export default async function RestauranteImpuestosPage() {
  const user = await requireSession();
  await requireModulo(user, "restaurante-configuracion");
  const empresa = await getEmpresaMetadata(user.empresaId);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;

  const filas = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select({
        id: impuestos.id,
        codigo: impuestos.codigo,
        nombre: impuestos.nombre,
        tasa: impuestos.tasa,
        esRetencion: impuestos.esRetencion,
        activo: impuestos.activo,
      })
      .from(impuestos)
      .where(eq(impuestos.empresaId, user.empresaId))
      .orderBy(impuestos.codigo),
  );

  const trasladados = filas.filter((row) => !row.esRetencion && row.activo);
  const retenciones = filas.filter((row) => row.esRetencion && row.activo);
  const tasaVisible = trasladados[0]?.tasa ?? "0";

  return (
    <RestaurantCoreModulePage
      eyebrow={`${empresa?.pais ?? "NI"} / ${empresa?.moneda ?? "NIO"}`}
      title="Impuestos restaurante"
      subtitle="Configuracion tributaria reusable; las ventas conservan snapshots para no alterar historicos."
      actions={[
        { href: "/restaurante/facturacion", label: "Facturacion", icon: ShieldCheck },
        { href: "/restaurante/contabilidad", label: "Auxiliar contable", icon: Scale },
      ]}
      kpis={[
        { label: "Reglas activas", value: String(filas.filter((row) => row.activo).length), icon: ShieldCheck },
        { label: "Trasladados", value: String(trasladados.length) },
        { label: "Retenciones", value: String(retenciones.length) },
        { label: "Tasa visible", value: porcentaje(tasaVisible), hint: formatearMoneda(0, pais) },
      ]}
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <RestaurantModuleList
          title="Reglas configuradas"
          subtitle="No se hardcodea IVA en Restaurante; se consume la configuracion de ARCA Core."
          empty="No hay impuestos configurados para esta empresa."
          items={filas.map((row) => ({
            id: row.id,
            title: `${row.codigo} / ${row.nombre}`,
            subtitle: row.esRetencion ? "Retencion" : "Impuesto trasladado",
            value: porcentaje(row.tasa),
            badge: row.activo ? "Activo" : "Inactivo",
            tone: row.activo ? "success" : "neutral",
          }))}
        />
        <RestaurantModuleGrid
          title="Consumo del motor"
          subtitle="Usado por ventas, compras, devoluciones y reportes."
          actions={[
            { href: "/restaurante/facturacion", label: "Impuestos cobrados" },
            { href: "/restaurante/compras", label: "Impuestos acreditables" },
            { href: "/restaurante/reportes", label: "Reporte fiscal" },
          ]}
        />
      </section>
    </RestaurantCoreModulePage>
  );
}
