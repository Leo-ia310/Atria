import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Package, Pencil, TrendingDown, TrendingUp } from "lucide-react";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  productos,
  ventas,
  ventaDetalle,
  usuarios,
  movimientosInventario,
  existencias,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { Badge } from "@/components/ui/Badge";
import { formatearMoneda, formatearFecha, desdeDecimal } from "@/lib/utils";
import {
  GraficaEgresos,
  GraficaIngresos,
  GraficaVendedores,
} from "@/components/productos/ProductoGraficas";
import type { PaisCodigo } from "@/lib/paises";

const TIPOS_ENTRADA = [
  "entrada_compra",
  "ajuste_entrada",
  "transferencia_entrada",
  "devolucion_cliente",
] as const;

function etiquetaDia(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
  });
}

export default async function ProductoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, user] = await Promise.all([params, requireSession()]);
  const empresa = await getEmpresaMetadata(user.empresaId);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;

  const [producto] = await db
    .select({
      id: productos.id,
      sku: productos.sku,
      nombre: productos.nombre,
      descripcion: productos.descripcion,
      imagenUrl: productos.imagenUrl,
      precioBase: productos.precioBase,
      costoPromedio: productos.costoPromedio,
      activo: productos.activo,
    })
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

  const hace90 = new Date();
  hace90.setDate(hace90.getDate() - 90);

  const [egresosRows, ingresosRows, vendedoresRows, recientesRows, existenciaRow] =
    await Promise.all([
      db
        .select({
          fecha: sql<string>`DATE(${ventas.fecha})`,
          unidades: sql<string>`SUM(${ventaDetalle.cantidad})`,
          monto: sql<string>`SUM(${ventaDetalle.subtotal})`,
        })
        .from(ventaDetalle)
        .innerJoin(ventas, eq(ventas.id, ventaDetalle.ventaId))
        .where(
          and(
            eq(ventaDetalle.productoId, id),
            eq(ventas.empresaId, user.empresaId),
            eq(ventas.estado, "completada"),
            isNull(ventas.anuladoEn),
            gte(ventas.fecha, hace90),
          ),
        )
        .groupBy(sql`DATE(${ventas.fecha})`)
        .orderBy(sql`DATE(${ventas.fecha})`),
      db
        .select({
          fecha: sql<string>`DATE(${movimientosInventario.creadoEn})`,
          unidades: sql<string>`SUM(${movimientosInventario.cantidad})`,
        })
        .from(movimientosInventario)
        .where(
          and(
            eq(movimientosInventario.productoId, id),
            eq(movimientosInventario.empresaId, user.empresaId),
            inArray(movimientosInventario.tipo, [...TIPOS_ENTRADA]),
            gte(movimientosInventario.creadoEn, hace90),
          ),
        )
        .groupBy(sql`DATE(${movimientosInventario.creadoEn})`)
        .orderBy(sql`DATE(${movimientosInventario.creadoEn})`),
      db
        .select({
          nombre: usuarios.nombre,
          unidades: sql<string>`SUM(${ventaDetalle.cantidad})`,
          monto: sql<string>`SUM(${ventaDetalle.subtotal})`,
        })
        .from(ventaDetalle)
        .innerJoin(ventas, eq(ventas.id, ventaDetalle.ventaId))
        .innerJoin(usuarios, eq(usuarios.id, ventas.usuarioId))
        .where(
          and(
            eq(ventaDetalle.productoId, id),
            eq(ventas.empresaId, user.empresaId),
            eq(ventas.estado, "completada"),
            isNull(ventas.anuladoEn),
            gte(ventas.fecha, hace90),
          ),
        )
        .groupBy(usuarios.id, usuarios.nombre)
        .orderBy(sql`SUM(${ventaDetalle.subtotal}) DESC`)
        .limit(8),
      db
        .select({
          numero: ventas.numero,
          fecha: ventas.fecha,
          vendedor: usuarios.nombre,
          cantidad: ventaDetalle.cantidad,
          subtotal: ventaDetalle.subtotal,
        })
        .from(ventaDetalle)
        .innerJoin(ventas, eq(ventas.id, ventaDetalle.ventaId))
        .leftJoin(usuarios, eq(usuarios.id, ventas.usuarioId))
        .where(
          and(
            eq(ventaDetalle.productoId, id),
            eq(ventas.empresaId, user.empresaId),
            eq(ventas.estado, "completada"),
            isNull(ventas.anuladoEn),
          ),
        )
        .orderBy(desc(ventas.fecha))
        .limit(12),
      db
        .select({ total: sql<string>`COALESCE(SUM(${existencias.cantidad}), 0)` })
        .from(existencias)
        .where(
          and(
            eq(existencias.empresaId, user.empresaId),
            eq(existencias.productoId, id),
          ),
        ),
    ]);

  const egresos = egresosRows.map((r) => ({
    fecha: r.fecha,
    label: etiquetaDia(r.fecha),
    unidades: parseFloat(r.unidades),
    monto: parseFloat(r.monto),
  }));
  const ingresos = ingresosRows.map((r) => ({
    fecha: r.fecha,
    label: etiquetaDia(r.fecha),
    unidades: parseFloat(r.unidades),
    monto: 0,
  }));
  const vendedores = vendedoresRows.map((r) => ({
    nombre: r.nombre,
    unidades: parseFloat(r.unidades),
    monto: parseFloat(r.monto),
  }));

  const unidadesVendidas = egresos.reduce((a, d) => a + d.unidades, 0);
  const ingresoVentas = egresos.reduce((a, d) => a + d.monto, 0);
  const unidadesIngresadas = ingresos.reduce((a, d) => a + d.unidades, 0);
  const existenciaActual = parseFloat(existenciaRow[0]?.total ?? "0");
  const mejorDia = egresos.reduce<{ label: string; unidades: number } | null>(
    (best, d) => (!best || d.unidades > best.unidades ? { label: d.label, unidades: d.unidades } : best),
    null,
  );

  return (
    <div>
      <Link
        href="/inventario"
        className="mb-3 inline-flex items-center gap-1 text-small text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
      >
        <ArrowLeft size={14} /> Volver a inventario
      </Link>
      <PageHeader
        title={producto.nombre}
        subtitle={`SKU ${producto.sku} · últimos 90 días`}
        actions={
          <Link
            href={`/inventario/${producto.id}`}
            className="arca-btn arca-btn-secondary arca-btn-sm"
          >
            <Pencil size={14} /> Editar producto
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <CardBody className="space-y-4">
            <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-[color:var(--color-surface-2)]">
              {producto.imagenUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={producto.imagenUrl}
                  alt={producto.nombre}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-[color:var(--color-text-muted)]">
                  <Package size={40} />
                  <span className="text-[11px]">Sin foto</span>
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-lg font-semibold text-[color:var(--color-text-primary)]">
                  {producto.nombre}
                </span>
                {producto.activo ? (
                  <Badge variant="success">Activo</Badge>
                ) : (
                  <Badge variant="neutral">Inactivo</Badge>
                )}
              </div>
              {producto.descripcion && (
                <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
                  {producto.descripcion}
                </p>
              )}
            </div>
            <dl className="space-y-2 text-small">
              <Dato label="Precio de venta" valor={formatearMoneda(desdeDecimal(producto.precioBase), pais)} />
              <Dato label="Costo promedio" valor={formatearMoneda(desdeDecimal(producto.costoPromedio), pais)} />
              <Dato label="Existencia actual" valor={`${existenciaActual.toFixed(2)} u`} />
            </dl>
          </CardBody>
        </Card>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <KpiCard label="Unidades vendidas" value={unidadesVendidas.toFixed(0)} icon={TrendingDown} />
            <KpiCard label="Ingreso por ventas" value={formatearMoneda(ingresoVentas, pais)} icon={TrendingUp} />
            <KpiCard label="Unidades ingresadas" value={unidadesIngresadas.toFixed(0)} icon={Package} />
            <KpiCard
              label="Mejor día"
              value={mejorDia ? `${mejorDia.label}` : "—"}
              icon={TrendingUp}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    <TrendingDown size={16} className="text-[color:var(--color-primary)]" /> Egresos (ventas)
                  </span>
                }
                subtitle="Unidades vendidas por día. El día pico se resalta."
              />
              <CardBody>
                <GraficaEgresos data={egresos} pais={pais} mejorLabel={mejorDia?.label ?? null} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    <Package size={16} className="text-[color:var(--color-success)]" /> Ingresos (entradas)
                  </span>
                }
                subtitle="Unidades que entraron al inventario por día."
              />
              <CardBody>
                <GraficaIngresos data={ingresos} />
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title="Quién lo vendió" subtitle="Unidades vendidas por cada cajero (90 días)" />
            <CardBody>
              <GraficaVendedores data={vendedores} pais={pais} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Últimas ventas" subtitle="Movimientos de salida más recientes" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-small">
                <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                  <tr>
                    <th className="text-label px-4 py-2.5 text-left font-semibold">Venta</th>
                    <th className="text-label px-4 py-2.5 text-left font-semibold">Fecha</th>
                    <th className="text-label px-4 py-2.5 text-left font-semibold">Vendedor</th>
                    <th className="text-label px-4 py-2.5 text-right font-semibold">Cant.</th>
                    <th className="text-label px-4 py-2.5 text-right font-semibold">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {recientesRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[color:var(--color-text-muted)]">
                        Este producto aún no tiene ventas registradas.
                      </td>
                    </tr>
                  ) : (
                    recientesRows.map((r, i) => (
                      <tr key={i} className="border-b border-[color:var(--color-border)] last:border-b-0">
                        <td className="px-4 py-2.5 font-medium">{r.numero}</td>
                        <td className="px-4 py-2.5 text-[color:var(--color-text-muted)]">
                          {formatearFecha(r.fecha)}
                        </td>
                        <td className="px-4 py-2.5">{r.vendedor ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right">{parseFloat(r.cantidad).toFixed(0)}</td>
                        <td className="px-4 py-2.5 text-right">
                          {formatearMoneda(parseFloat(r.subtotal), pais)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[color:var(--color-text-muted)]">{label}</dt>
      <dd className="font-medium text-[color:var(--color-text-primary)]">{valor}</dd>
    </div>
  );
}
