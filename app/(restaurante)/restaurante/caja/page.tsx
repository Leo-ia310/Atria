import type { Metadata } from "next";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { Banknote, Receipt, Store, WalletCards } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import {
  cajas,
  formasPago,
  pagosVenta,
  sesionesCaja,
  sucursales,
  usuarios,
  ventas,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { formatearFechaHora, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import {
  RestaurantCoreModulePage,
  RestaurantModuleGrid,
  RestaurantModuleList,
} from "@/components/restaurante/RestaurantCoreModulePage";
import { estadoTone, labelEstado, numero } from "@/lib/restaurante/core-pages";

export const metadata: Metadata = {
  title: "Caja Restaurante | ARCA",
  description: "Turnos, arqueos y medios de pago del restaurante usando caja core.",
};

export default async function RestauranteCajaPage() {
  const user = await requireSession();
  await requireModulo(user, "caja");
  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const sucursalIds = selectedSucursalIds(scope);

  const [cajasRows, sesiones, pagosPorForma] = await dbConEmpresa(user.empresaId, (tx) =>
    Promise.all([
      tx
        .select({
          id: cajas.id,
          codigo: cajas.codigo,
          nombre: cajas.nombre,
          activa: cajas.activa,
          sucursal: sucursales.nombre,
        })
        .from(cajas)
        .leftJoin(sucursales, eq(sucursales.id, cajas.sucursalId))
        .where(
          and(
            eq(cajas.empresaId, user.empresaId),
            sucursalIds ? inArray(cajas.sucursalId, sucursalIds) : undefined,
          ),
        )
        .orderBy(cajas.codigo),
      tx
        .select({
          id: sesionesCaja.id,
          estado: sesionesCaja.estado,
          montoInicial: sesionesCaja.montoInicial,
          montoFinalEsperado: sesionesCaja.montoFinalEsperado,
          montoFinalReal: sesionesCaja.montoFinalReal,
          diferencia: sesionesCaja.diferencia,
          abiertaEn: sesionesCaja.abiertaEn,
          cerradaEn: sesionesCaja.cerradaEn,
          notas: sesionesCaja.notas,
          caja: cajas.nombre,
          usuario: usuarios.nombre,
          sucursal: sucursales.nombre,
        })
        .from(sesionesCaja)
        .innerJoin(cajas, eq(cajas.id, sesionesCaja.cajaId))
        .innerJoin(usuarios, eq(usuarios.id, sesionesCaja.usuarioId))
        .leftJoin(sucursales, eq(sucursales.id, cajas.sucursalId))
        .where(
          and(
            eq(sesionesCaja.empresaId, user.empresaId),
            eq(cajas.empresaId, user.empresaId),
            sucursalIds ? inArray(cajas.sucursalId, sucursalIds) : undefined,
          ),
        )
        .orderBy(desc(sesionesCaja.abiertaEn))
        .limit(80),
      tx
        .select({
          forma: formasPago.nombre,
          requiereReferencia: formasPago.requiereReferencia,
          operaciones: count(pagosVenta.id),
          total: sql<string>`COALESCE(SUM(${pagosVenta.monto}), 0)`,
        })
        .from(pagosVenta)
        .innerJoin(ventas, eq(ventas.id, pagosVenta.ventaId))
        .innerJoin(formasPago, eq(formasPago.id, pagosVenta.formaPagoId))
        .where(
          and(
            eq(ventas.empresaId, user.empresaId),
            eq(formasPago.empresaId, user.empresaId),
            sucursalIds ? inArray(ventas.sucursalId, sucursalIds) : undefined,
          ),
        )
        .groupBy(formasPago.nombre, formasPago.requiereReferencia)
        .orderBy(desc(sql`SUM(${pagosVenta.monto})`)),
    ]),
  );

  const abiertas = sesiones.filter((row) => row.estado === "abierta").length;
  const diferencia = sesiones.reduce((total, row) => total + numero(row.diferencia), 0);
  const ventasCobradas = pagosPorForma.reduce((total, row) => total + numero(row.total), 0);

  return (
    <RestaurantCoreModulePage
      eyebrow={scope.visible ? scope.etiqueta : "Caja restaurante"}
      title="Turnos y arqueos"
      subtitle="Apertura, cobros, medios de pago, diferencias y cierres usando el modulo de caja core."
      actions={[
        { href: "/restaurante/pos", label: "Abrir POS", icon: Receipt },
        { href: "/restaurante/facturacion", label: "Facturacion", icon: WalletCards },
      ]}
      kpis={[
        { label: "Cajas", value: String(cajasRows.length), hint: `${cajasRows.filter((row) => row.activa).length} activas`, icon: Store },
        { label: "Turnos abiertos", value: String(abiertas), icon: Banknote },
        { label: "Cobrado por medios", value: formatearMoneda(ventasCobradas, pais) },
        { label: "Diferencia auditada", value: formatearMoneda(diferencia, pais), hint: "Ultimos turnos" },
      ]}
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <RestaurantModuleList
          title="Historial de sesiones"
          subtitle="Las diferencias quedan como registro de caja; no se modifican ventas para cuadrar."
          empty="No hay sesiones de caja registradas."
          items={sesiones.map((row) => ({
            id: row.id,
            title: `${row.caja} / ${row.usuario}`,
            subtitle: `${row.sucursal ?? "Sin sucursal"} / inicio ${formatearMoneda(row.montoInicial, pais)}`,
            meta: `${formatearFechaHora(row.abiertaEn, pais, empresa?.zonaHoraria)}${row.cerradaEn ? ` / cierre ${formatearFechaHora(row.cerradaEn, pais, empresa?.zonaHoraria)}` : ""}${row.notas ? ` / ${row.notas}` : ""}`,
            value: row.montoFinalReal ? formatearMoneda(row.montoFinalReal, pais) : "Abierta",
            badge: labelEstado(row.estado),
            tone: estadoTone(row.estado),
          }))}
        />
        <div className="space-y-4">
          <RestaurantModuleList
            title="Medios de pago"
            subtitle="Resumen de cobros relacionados a ventas del restaurante."
            empty="Aun no hay pagos registrados."
            items={pagosPorForma.map((row) => ({
              id: row.forma,
              title: row.forma,
              subtitle: `${row.operaciones} operaciones${row.requiereReferencia ? " / requiere referencia" : ""}`,
              value: formatearMoneda(row.total, pais),
              badge: "Activo",
              tone: "success",
            }))}
          />
          <RestaurantModuleGrid
            title="Operacion conectada"
            subtitle="Caja no duplica ventas ni tesoreria."
            actions={[
              { href: "/restaurante/pos", label: "Cobrar ordenes" },
              { href: "/restaurante/tesoreria", label: "Movimientos financieros" },
              { href: "/restaurante/auditoria", label: "Auditoria de cierres" },
            ]}
          />
        </div>
      </section>
    </RestaurantCoreModulePage>
  );
}
