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
import { formatearMoneda, desdeDecimal } from "@/lib/utils";
import { GraficaVendedores } from "@/components/productos/ProductoGraficas";
import { RegistroMovimientos } from "@/components/productos/RegistroMovimientos";
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
  const zonaHoraria = empresa?.zonaHoraria ?? "America/Managua";
  // La zona va como literal (no parametro) para que la misma expresion en SELECT,
  // GROUP BY y ORDER BY sea textualmente identica; con un placeholder ($1, $2, ...)
  // Postgres no reconoce que coinciden y exige la columna cruda en el GROUP BY.
  const tzLiteral = sql.raw(`'${zonaHoraria.replace(/[^A-Za-z0-9_+\-/]/g, "")}'`);
  const fechaVentaLocal = sql<string>`(${ventas.fecha} AT TIME ZONE ${tzLiteral})::date`;
  const fechaMovimientoLocal = sql<string>`(${movimientosInventario.creadoEn} AT TIME ZONE ${tzLiteral})::date`;

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

  const [egresosRows, ingresosRows, vendedoresRows, movimientosRows, existenciaRow] =
    await Promise.all([
      db
        .select({
          fecha: fechaVentaLocal,
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
        .groupBy(fechaVentaLocal)
        .orderBy(fechaVentaLocal),
      db
        .select({
          fecha: fechaMovimientoLocal,
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
        .groupBy(fechaMovimientoLocal)
        .orderBy(fechaMovimientoLocal),
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
          fecha: movimientosInventario.creadoEn,
          tipo: movimientosInventario.tipo,
          cantidad: movimientosInventario.cantidad,
          usuario: usuarios.nombre,
          nota: movimientosInventario.notas,
        })
        .from(movimientosInventario)
        .leftJoin(usuarios, eq(usuarios.id, movimientosInventario.usuarioId))
        .where(
          and(
            eq(movimientosInventario.productoId, id),
            eq(movimientosInventario.empresaId, user.empresaId),
          ),
        )
        .orderBy(desc(movimientosInventario.creadoEn))
        .limit(1000),
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
  const movimientos = movimientosRows.map((m) => ({
    fecha: m.fecha.toISOString(),
    tipo: m.tipo,
    cantidad: parseFloat(m.cantidad),
    usuario: m.usuario,
    nota: m.nota,
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

          <RegistroMovimientos movimientos={movimientos} />

          <Card>
            <CardHeader title="Quién lo vendió" subtitle="Unidades vendidas por cada cajero (90 días)" />
            <CardBody>
              <GraficaVendedores data={vendedores} pais={pais} />
            </CardBody>
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
