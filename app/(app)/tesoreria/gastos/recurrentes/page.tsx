import Link from "next/link";
import { Plus } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categoriasGasto, cuentasFinancieras, gastosRecurrentes } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  GastosRecurrentesManager,
  type GastoRecurrenteFila,
} from "@/components/tesoreria/GastosRecurrentesManager";
import type { PaisCodigo } from "@/lib/paises";
import { BotonExportarExcel } from "@/components/ui/BotonExportarExcel";

export default async function GastosRecurrentesPage() {
  const user = await requireSession();
  const [empresa, recurrentes, categorias, cuentas] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    db
      .select({
        id: gastosRecurrentes.id,
        descripcion: gastosRecurrentes.descripcion,
        referencia: gastosRecurrentes.referencia,
        categoriaId: gastosRecurrentes.categoriaId,
        categoria: categoriasGasto.nombre,
        cuentaFinancieraId: gastosRecurrentes.cuentaFinancieraId,
        cuenta: cuentasFinancieras.nombre,
        subtotal: gastosRecurrentes.subtotal,
        impuesto: gastosRecurrentes.impuesto,
        diaMes: gastosRecurrentes.diaMes,
        proximaFecha: gastosRecurrentes.proximaFecha,
        activa: gastosRecurrentes.activa,
        ultimoGeneradoEn: gastosRecurrentes.ultimoGeneradoEn,
      })
      .from(gastosRecurrentes)
      .innerJoin(categoriasGasto, eq(categoriasGasto.id, gastosRecurrentes.categoriaId))
      .innerJoin(cuentasFinancieras, eq(cuentasFinancieras.id, gastosRecurrentes.cuentaFinancieraId))
      .where(eq(gastosRecurrentes.empresaId, user.empresaId))
      .orderBy(gastosRecurrentes.proximaFecha),
    db
      .select({ id: categoriasGasto.id, nombre: categoriasGasto.nombre })
      .from(categoriasGasto)
      .where(eq(categoriasGasto.empresaId, user.empresaId))
      .orderBy(categoriasGasto.nombre),
    db
      .select({ id: cuentasFinancieras.id, nombre: cuentasFinancieras.nombre })
      .from(cuentasFinancieras)
      .where(eq(cuentasFinancieras.empresaId, user.empresaId))
      .orderBy(cuentasFinancieras.nombre),
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const filas: GastoRecurrenteFila[] = recurrentes.map((fila) => ({
    ...fila,
    subtotal: Number(fila.subtotal),
    impuesto: Number(fila.impuesto),
    ultimoGeneradoEn: fila.ultimoGeneradoEn?.toISOString() ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="Gastos recurrentes"
        subtitle={`${filas.length} cobros mensuales configurados`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BotonExportarExcel recurso="gastos-recurrentes" />
            <Link href="/tesoreria/gastos/nuevo" className="arca-btn arca-btn-primary arca-btn-sm">
              <Plus size={14} /> Nuevo gasto
            </Link>
          </div>
        }
      />
      <GastosRecurrentesManager
        pais={pais}
        filas={filas}
        categorias={categorias.map((item) => ({ value: item.id, label: item.nombre }))}
        cuentas={cuentas.map((item) => ({ value: item.id, label: item.nombre }))}
      />
    </div>
  );
}
