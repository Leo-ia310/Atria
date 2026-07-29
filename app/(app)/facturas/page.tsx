import Link from "next/link";
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { facturas, sucursales, usuarios, ventas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileText } from "lucide-react";
import { formatearMoneda, formatearFechaHora } from "@/lib/utils";
import { getPaisConfig, type PaisCodigo } from "@/lib/paises";
import { FacturaVer } from "@/components/facturas/FacturaVer";
import type { ReciboData } from "@/components/pos/Recibo";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { getEmpresaMetadata } from "@/lib/tenant-data";

export default async function FacturasPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    vendedor?: string;
    forma?: string;
    tipo?: string;
  }>;
}) {
  const [sp, user] = await Promise.all([searchParams, requireSession()]);
  const [scope, empresa, vendedores] = await Promise.all([
    getSucursalScope(user),
    getEmpresaMetadata(user.empresaId),
    db
      .select({ id: usuarios.id, nombre: usuarios.nombre })
      .from(usuarios)
      .where(eq(usuarios.empresaId, user.empresaId)),
  ]);
  const sucursalIds = selectedSucursalIds(scope);

  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const config = getPaisConfig(pais);
  const empresaRecibo = {
    nombre: empresa?.nombreComercial || empresa?.razonSocial || "Mi Empresa",
    idFiscalNombre: config.idFiscalNombre,
    identificacionFiscal: empresa?.identificacionFiscal ?? "",
    direccion: empresa?.direccion ?? null,
    telefono: empresa?.telefono ?? null,
  };

  const cond = [eq(facturas.empresaId, user.empresaId)];
  if (sp.desde && /^\d{4}-\d{2}-\d{2}$/.test(sp.desde)) {
    cond.push(sql`${facturas.fecha}::date >= ${sp.desde}`);
  }
  if (sp.hasta && /^\d{4}-\d{2}-\d{2}$/.test(sp.hasta)) {
    cond.push(sql`${facturas.fecha}::date <= ${sp.hasta}`);
  }
  if (sp.vendedor) cond.push(eq(facturas.vendedorId, sp.vendedor));
  if (sp.forma) cond.push(ilike(facturas.formasPago, `%${sp.forma}%`));
  if (sp.tipo === "contado") cond.push(eq(facturas.esCredito, false));
  if (sp.tipo === "credito") cond.push(eq(facturas.esCredito, true));
  if (sucursalIds) cond.push(inArray(ventas.sucursalId, sucursalIds));

  const filas = await db
    .select({
      id: facturas.id,
      ventaId: facturas.ventaId,
      numero: facturas.numero,
      fecha: facturas.fecha,
      cliente: facturas.clienteNombre,
      vendedor: facturas.vendedorNombre,
      formasPago: facturas.formasPago,
      esCredito: facturas.esCredito,
      total: facturas.total,
      snapshot: facturas.snapshot,
      sucursal: sucursales.nombre,
    })
    .from(facturas)
    .leftJoin(ventas, eq(ventas.id, facturas.ventaId))
    .leftJoin(sucursales, eq(sucursales.id, ventas.sucursalId))
    .where(and(...cond))
    .orderBy(desc(facturas.fecha))
    .limit(500);

  const totalFiltrado = filas.reduce((a, f) => a + parseFloat(f.total), 0);

  function reciboDe(snap: Record<string, unknown>): ReciboData {
    const items = Array.isArray(snap.items) ? (snap.items as Record<string, number>[]) : [];
    const pagos = Array.isArray(snap.pagos) ? (snap.pagos as Record<string, unknown>[]) : [];
    return {
      pais,
      empresa: empresaRecibo,
      numero: String(snap.numero ?? ""),
      fecha: String(snap.fecha ?? new Date().toISOString()),
      cajero: (snap.cajero as string) ?? null,
      cliente: String(snap.cliente ?? "Consumidor final"),
      esCredito: Boolean(snap.esCredito),
      impuestoNombre: config.impuestoNombre,
      items: items.map((it) => ({
        nombre: String(it.nombre ?? "Producto"),
        sku: it.sku != null ? String(it.sku) : "",
        cantidad: Number(it.cantidad ?? 0),
        precioUnitario: Number(it.precioUnitario ?? 0),
        subtotal: Number(it.subtotal ?? 0),
      })),
      pagos: pagos.map((p) => ({
        formaPago: String(p.formaPago ?? "Otro"),
        monto: Number(p.monto ?? 0),
        referencia: (p.referencia as string) ?? null,
      })),
      subtotal: Number(snap.subtotal ?? 0),
      descuento: Number(snap.descuento ?? 0),
      impuesto: Number(snap.impuesto ?? 0),
      total: Number(snap.total ?? 0),
    };
  }

  return (
    <div>
      <PageHeader
        title="Facturas"
        subtitle={`${filas.length} facturas · ${formatearMoneda(totalFiltrado, pais)}${scope.visible ? ` · ${scope.etiqueta}` : ""}`}
      />

      <Card className="mb-4">
        <CardBody>
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div>
              <label className="text-label mb-1.5 block">Desde</label>
              <input type="date" name="desde" defaultValue={sp.desde ?? ""} className="atria-input w-44" />
            </div>
            <div>
              <label className="text-label mb-1.5 block">Hasta</label>
              <input type="date" name="hasta" defaultValue={sp.hasta ?? ""} className="atria-input w-44" />
            </div>
            <div>
              <label className="text-label mb-1.5 block">Vendedor</label>
              <select name="vendedor" defaultValue={sp.vendedor ?? ""} className="atria-input w-48">
                <option value="">Todos</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-label mb-1.5 block">Forma de pago</label>
              <input
                type="text"
                name="forma"
                defaultValue={sp.forma ?? ""}
                placeholder="Efectivo, Tarjeta…"
                className="atria-input w-44"
              />
            </div>
            <div>
              <label className="text-label mb-1.5 block">Tipo</label>
              <select name="tipo" defaultValue={sp.tipo ?? ""} className="atria-input w-36">
                <option value="">Todos</option>
                <option value="contado">Contado</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
            <button type="submit" className="atria-btn atria-btn-primary">
              Filtrar
            </button>
            <Link href="/facturas" className="atria-btn atria-btn-ghost atria-btn-sm">
              Limpiar
            </Link>
          </form>
        </CardBody>
      </Card>

      <Card>
        {filas.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={FileText}
              titulo="Sin facturas"
              descripcion="Las facturas se guardan automáticamente al registrar ventas en el POS."
            />
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                <tr>
                  <th className="text-label px-4 py-3 text-left">Factura</th>
                  <th className="text-label px-4 py-3 text-left">Fecha</th>
                  <th className="text-label px-4 py-3 text-left">Cliente</th>
                  {scope.visible && (
                    <th className="text-label px-4 py-3 text-left">Sucursal</th>
                  )}
                  <th className="text-label px-4 py-3 text-left">Vendedor</th>
                  <th className="text-label px-4 py-3 text-left">Pago</th>
                  <th className="text-label px-4 py-3 text-right">Total</th>
                  <th className="text-label px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id} className="border-b border-[color:var(--color-border)] last:border-b-0">
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/ventas/${f.ventaId}`} className="hover:underline">
                        {f.numero}
                      </Link>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-[color:var(--color-text-muted)]">
                      {formatearFechaHora(f.fecha)}
                    </td>
                    <td className="px-4 py-2">{f.cliente ?? "Consumidor final"}</td>
                    {scope.visible && (
                      <td className="px-4 py-2">{f.sucursal ?? "Sin sucursal"}</td>
                    )}
                    <td className="px-4 py-2">{f.vendedor ?? "—"}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <span>{f.formasPago ?? "—"}</span>
                        {f.esCredito && <Badge variant="warning">Crédito</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {formatearMoneda(parseFloat(f.total), pais)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <FacturaVer data={reciboDe(f.snapshot as Record<string, unknown>)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
