import type { Metadata } from "next";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { BookOpen, BookText, FileBarChart, Scale } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import {
  asientoPartidas,
  asientosContables,
  periodosContables,
  sucursales,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { formatearFecha, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import {
  RestaurantCoreModulePage,
  RestaurantModuleGrid,
  RestaurantModuleList,
} from "@/components/restaurante/RestaurantCoreModulePage";
import { estadoTone, labelEstado, numero } from "@/lib/restaurante/core-pages";

export const metadata: Metadata = {
  title: "Contabilidad Restaurante | ARCA",
  description: "Libro contable simplificado para restaurante usando ARCA Core.",
};

export default async function RestauranteContabilidadPage() {
  const user = await requireSession();
  await requireModulo(user, "contabilidad");
  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const sucursalIds = selectedSucursalIds(scope);
  const hoy = new Date();

  const [asientos, resumenRows, periodos] = await dbConEmpresa(user.empresaId, (tx) =>
    Promise.all([
      tx
        .select({
          id: asientosContables.id,
          numero: asientosContables.numero,
          fecha: asientosContables.fecha,
          concepto: asientosContables.concepto,
          origen: asientosContables.origen,
          estado: asientosContables.estado,
          totalDebe: asientosContables.totalDebe,
          totalHaber: asientosContables.totalHaber,
          sucursal: sucursales.nombre,
        })
        .from(asientosContables)
        .leftJoin(sucursales, eq(sucursales.id, asientosContables.sucursalId))
        .where(
          and(
            eq(asientosContables.empresaId, user.empresaId),
            sucursalIds ? inArray(asientosContables.sucursalId, sucursalIds) : undefined,
          ),
        )
        .orderBy(desc(asientosContables.fecha), desc(asientosContables.creadoEn))
        .limit(80),
      tx
        .select({
          debe: sql<string>`COALESCE(SUM(${asientoPartidas.debe}), 0)`,
          haber: sql<string>`COALESCE(SUM(${asientoPartidas.haber}), 0)`,
        })
        .from(asientoPartidas)
        .innerJoin(asientosContables, eq(asientosContables.id, asientoPartidas.asientoId))
        .where(
          and(
            eq(asientosContables.empresaId, user.empresaId),
            eq(asientosContables.estado, "registrado"),
            sucursalIds ? inArray(asientosContables.sucursalId, sucursalIds) : undefined,
          ),
        ),
      tx
        .select({
          id: periodosContables.id,
          anio: periodosContables.anio,
          mes: periodosContables.mes,
          estado: periodosContables.estado,
        })
        .from(periodosContables)
        .where(
          and(
            eq(periodosContables.empresaId, user.empresaId),
            eq(periodosContables.anio, hoy.getFullYear()),
            eq(periodosContables.mes, hoy.getMonth() + 1),
          ),
        )
        .limit(1),
    ]),
  );

  const resumen = resumenRows[0];
  const debe = numero(resumen?.debe);
  const haber = numero(resumen?.haber);
  const balanceado = Math.abs(debe - haber) < 0.01;
  const periodo = periodos[0];
  const registrados = asientos.filter((row) => row.estado === "registrado").length;

  return (
    <RestaurantCoreModulePage
      eyebrow={scope.visible ? scope.etiqueta : "Contabilidad restaurante"}
      title="Contabilidad restaurante"
      subtitle="Vista gerencial simple sobre partida doble, periodos y asientos append-only de ARCA Core."
      actions={[
        { href: "/restaurante/reportes", label: "Reportes", icon: FileBarChart },
        { href: "/restaurante/impuestos", label: "Auxiliar impuestos", icon: Scale },
      ]}
      kpis={[
        { label: "Asientos", value: String(asientos.length), hint: `${registrados} registrados`, icon: BookOpen },
        { label: "Debe", value: formatearMoneda(debe, pais) },
        { label: "Haber", value: formatearMoneda(haber, pais) },
        { label: "Estado libros", value: balanceado ? "Balanceados" : "Revisar", hint: periodo ? `${periodo.mes}/${periodo.anio} ${periodo.estado}` : "Sin periodo actual", icon: BookText },
      ]}
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <RestaurantModuleList
          title="Libro diario reciente"
          subtitle="Ventas, compras, pagos, gastos, mermas, nomina y cierres llegan desde sus modulos origen."
          empty="Aun no hay asientos contables."
          items={asientos.map((row) => ({
            id: row.id,
            title: `${row.numero} / ${labelEstado(row.origen)}`,
            subtitle: `${row.concepto} / ${row.sucursal ?? "Consolidado"}`,
            meta: formatearFecha(row.fecha, pais),
            value: formatearMoneda(row.totalDebe, pais),
            badge: labelEstado(row.estado),
            tone: estadoTone(row.estado),
          }))}
        />
        <RestaurantModuleGrid
          title="Libros y estados"
          subtitle="Accesos contables dentro del entorno Restaurante."
          actions={[
            { href: "/restaurante/contabilidad/libro-diario", label: "Libro diario" },
            { href: "/restaurante/contabilidad/libro-mayor", label: "Libro mayor" },
            { href: "/restaurante/contabilidad/balance-comprobacion", label: "Balance de comprobacion" },
            { href: "/restaurante/contabilidad/estado-resultados", label: "Estado de resultados" },
            { href: "/restaurante/contabilidad/balance-general", label: "Balance general" },
            { href: "/restaurante/contabilidad/catalogo-cuentas", label: "Catalogo de cuentas" },
            { href: "/restaurante/contabilidad/periodos", label: "Periodos" },
          ]}
        />
      </section>
    </RestaurantCoreModulePage>
  );
}
