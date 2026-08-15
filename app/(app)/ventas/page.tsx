import Link from "next/link";
import { Receipt, ShoppingCart } from "lucide-react";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientes, facturas, sucursales, ventas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { formatearMoneda, formatearFechaHora } from "@/lib/utils";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import type { PaisCodigo } from "@/lib/paises";
import { ImprimirFacturasLote } from "@/components/facturas/ImprimirFacturasLote";
import { BotonExportarExcel } from "@/components/ui/BotonExportarExcel";

type Fila = {
  id: string;
  numero: string;
  fecha: Date;
  cliente: string | null;
  sucursal: string | null;
  total: string;
  esCredito: boolean;
  estado: string;
  facturaId: string | null;
};

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    desde?: string;
    hasta?: string;
    tipo?: string;
    estado?: string;
  }>;
}) {
  const [sp, user] = await Promise.all([searchParams, requireSession()]);
  const [empresa, scope] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
  ]);
  const sucursalIds = selectedSucursalIds(scope);
  const zonaHoraria = empresa?.zonaHoraria ?? "America/Managua";

  const cond = [eq(ventas.empresaId, user.empresaId)];
  if (sucursalIds) cond.push(inArray(ventas.sucursalId, sucursalIds));
  if (sp.desde && /^\d{4}-\d{2}-\d{2}$/.test(sp.desde)) {
    cond.push(sql`(${ventas.fecha} AT TIME ZONE ${zonaHoraria})::date >= ${sp.desde}`);
  }
  if (sp.hasta && /^\d{4}-\d{2}-\d{2}$/.test(sp.hasta)) {
    cond.push(sql`(${ventas.fecha} AT TIME ZONE ${zonaHoraria})::date <= ${sp.hasta}`);
  }
  if (sp.tipo === "contado") cond.push(eq(ventas.esCredito, false));
  if (sp.tipo === "credito") cond.push(eq(ventas.esCredito, true));
  if (sp.estado === "completada" || sp.estado === "anulada" || sp.estado === "pendiente") {
    cond.push(eq(ventas.estado, sp.estado));
  }
  if (sp.q) {
    const busqueda = or(
      ilike(ventas.numero, `%${sp.q}%`),
      ilike(clientes.nombre, `%${sp.q}%`),
    );
    if (busqueda) cond.push(busqueda);
  }

  const filas: Fila[] = await db
    .select({
      id: ventas.id,
      numero: ventas.numero,
      fecha: ventas.fecha,
      cliente: clientes.nombre,
      sucursal: sucursales.nombre,
      total: ventas.total,
      esCredito: ventas.esCredito,
      estado: ventas.estado,
      facturaId: facturas.id,
    })
    .from(ventas)
    .leftJoin(clientes, eq(clientes.id, ventas.clienteId))
    .leftJoin(sucursales, eq(sucursales.id, ventas.sucursalId))
    .leftJoin(facturas, eq(facturas.ventaId, ventas.id))
    .where(and(...cond))
    .orderBy(desc(ventas.fecha))
    .limit(300);

  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const totalFiltrado = filas.reduce((a, f) => a + parseFloat(f.total), 0);
  const totalFacturas = filas.filter((fila) => fila.facturaId).length;
  const hayFiltro = Boolean(sp.q || sp.desde || sp.hasta || sp.tipo || sp.estado);
  const parametrosImpresion = new URLSearchParams({ origen: "ventas" });
  for (const [clave, valor] of Object.entries(sp)) {
    if (valor) parametrosImpresion.set(clave, valor);
  }

  const columnas: Columna<Fila>[] = [
    {
      key: "numero",
      header: "N. Venta",
      cell: (r) => <span className="font-mono text-[12px]">{r.numero}</span>,
      width: "140px",
    },
    {
      key: "fecha",
      header: "Fecha y hora",
      cell: (r) => formatearFechaHora(r.fecha, pais, zonaHoraria),
      width: "180px",
    },
    {
      key: "cliente",
      header: "Cliente",
      cell: (r) =>
        r.cliente ?? (
          <span className="italic text-[color:var(--color-text-muted)]">Consumidor final</span>
        ),
    },
    ...(scope.visible
      ? [
          {
            key: "sucursal",
            header: "Sucursal",
            cell: (r: Fila) => r.sucursal ?? "Sin sucursal",
            width: "150px",
          } satisfies Columna<Fila>,
        ]
      : []),
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (r) => (
        <span className="font-semibold">
          {formatearMoneda(parseFloat(r.total), pais)}
        </span>
      ),
    },
    {
      key: "tipo",
      header: "Tipo",
      cell: (r) =>
        r.esCredito ? (
          <Badge variant="warning">Credito</Badge>
        ) : (
          <Badge variant="neutral">Contado</Badge>
        ),
    },
    {
      key: "estado",
      header: "Estado",
      cell: (r) =>
        r.estado === "anulada" ? (
          <Badge variant="error">Anulada</Badge>
        ) : (
          <Badge variant="success">Completada</Badge>
        ),
    },
    {
      key: "accion",
      header: "",
      align: "right",
      cell: (r) => (
        <Link
          href={`/ventas/${r.id}`}
          className="text-[color:var(--color-secondary)] hover:underline"
        >
          Ver
        </Link>
      ),
      width: "80px",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Ventas"
        subtitle={`${filas.length} ventas - ${formatearMoneda(totalFiltrado, pais)}${scope.visible ? ` - ${scope.etiqueta}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BotonExportarExcel
              recurso="ventas"
              params={{ q: sp.q, desde: sp.desde, hasta: sp.hasta, tipo: sp.tipo, estado: sp.estado }}
            />
            <ImprimirFacturasLote
              href={`/facturas/imprimir?${parametrosImpresion}`}
              total={totalFacturas}
              label={hayFiltro ? "Imprimir filtradas" : "Imprimir todo"}
            />
            <Link href="/pos" className="arca-btn arca-btn-primary arca-btn-sm">
              <ShoppingCart size={14} /> Abrir POS
            </Link>
          </div>
        }
      />

      <Card className="mb-4">
        <CardBody>
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div>
              <label className="text-label mb-1.5 block">Buscar</label>
              <input
                type="search"
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="Venta o cliente"
                className="arca-input w-52"
              />
            </div>
            <div>
              <label className="text-label mb-1.5 block">Desde</label>
              <input
                type="date"
                name="desde"
                defaultValue={sp.desde ?? ""}
                className="arca-input w-44"
              />
            </div>
            <div>
              <label className="text-label mb-1.5 block">Hasta</label>
              <input
                type="date"
                name="hasta"
                defaultValue={sp.hasta ?? ""}
                className="arca-input w-44"
              />
            </div>
            <div>
              <label className="text-label mb-1.5 block">Tipo</label>
              <select name="tipo" defaultValue={sp.tipo ?? ""} className="arca-input w-36">
                <option value="">Todos</option>
                <option value="contado">Contado</option>
                <option value="credito">Credito</option>
              </select>
            </div>
            <div>
              <label className="text-label mb-1.5 block">Estado</label>
              <select name="estado" defaultValue={sp.estado ?? ""} className="arca-input w-40">
                <option value="">Todos</option>
                <option value="completada">Completada</option>
                <option value="pendiente">Pendiente</option>
                <option value="anulada">Anulada</option>
              </select>
            </div>
            <button type="submit" className="arca-btn arca-btn-primary">
              Filtrar
            </button>
            <Link href="/ventas" className="arca-btn arca-btn-ghost arca-btn-sm">
              Limpiar
            </Link>
          </form>
        </CardBody>
      </Card>

      <DataTable
        data={filas}
        columns={columnas}
        rowKey={(r) => r.id}
        empty={
          <EmptyState
            icon={Receipt}
            titulo="Aun no hay ventas"
            descripcion="Abre el POS y haz tu primera venta para empezar a registrar."
            accion={
              <Link href="/pos">
                <Button size="sm">
                  <ShoppingCart size={14} /> Ir al POS
                </Button>
              </Link>
            }
          />
        }
      />
    </div>
  );
}
