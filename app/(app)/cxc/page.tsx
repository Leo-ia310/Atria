import Link from "next/link";
import { HandCoins } from "lucide-react";
import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientes, cuentasPorCobrar, sucursales, ventas } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { formatearMoneda, formatearFecha } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { fechaEstaVencida, getPoliticasNegocio } from "@/lib/politicas-negocio";
import { fechaISOEnZona } from "@/lib/dates";

type Fila = {
  id: string;
  cliente: string;
  ventaNumero: string | null;
  sucursal: string | null;
  fechaEmision: string;
  fechaVencimiento: string;
  monto: string;
  saldo: string;
  estado: string;
};

function estadoBadge(
  estado: string,
  fechaVencimiento: string,
  diasGracia: number,
  hoy: string,
) {
  const vencida = estado !== "pagada" && fechaEstaVencida(fechaVencimiento, diasGracia, hoy);
  if (vencida) return <Badge variant="error">Vencida</Badge>;
  if (estado === "pagada") return <Badge variant="success">Pagada</Badge>;
  if (estado === "parcial") return <Badge variant="warning">Parcial</Badge>;
  return <Badge variant="neutral">Pendiente</Badge>;
}

export default async function CxCPage({
  searchParams,
}: {
  searchParams: Promise<{ clienteId?: string }>;
}) {
  const [user, { clienteId }] = await Promise.all([
    requireSession(),
    searchParams,
  ]);
  const [empresa, scope, politicas] = await Promise.all([
    getEmpresaMetadata(user.empresaId),
    getSucursalScope(user),
    getPoliticasNegocio(user.empresaId),
  ]);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const zonaHoraria = empresa?.zonaHoraria ?? "America/Managua";
  const sucursalIds = selectedSucursalIds(scope);

  const filas: Fila[] = await db
    .select({
      id: cuentasPorCobrar.id,
      cliente: clientes.nombre,
      ventaNumero: ventas.numero,
      sucursal: sucursales.nombre,
      fechaEmision: cuentasPorCobrar.fechaEmision,
      fechaVencimiento: cuentasPorCobrar.fechaVencimiento,
      monto: cuentasPorCobrar.monto,
      saldo: cuentasPorCobrar.saldo,
      estado: cuentasPorCobrar.estado,
    })
    .from(cuentasPorCobrar)
    .innerJoin(clientes, eq(clientes.id, cuentasPorCobrar.clienteId))
    .leftJoin(ventas, eq(ventas.id, cuentasPorCobrar.ventaId))
    .leftJoin(sucursales, eq(sucursales.id, ventas.sucursalId))
    .where(
      and(
        eq(cuentasPorCobrar.empresaId, user.empresaId),
        notInArray(cuentasPorCobrar.estado, ["pagada", "incobrable"]),
        clienteId ? eq(cuentasPorCobrar.clienteId, clienteId) : undefined,
        sucursalIds ? inArray(ventas.sucursalId, sucursalIds) : undefined,
      ),
    )
    .orderBy(desc(cuentasPorCobrar.fechaVencimiento))
    .limit(500);

  const hoy = fechaISOEnZona(new Date(), zonaHoraria);
  const diasGracia = politicas.diasGraciaCobroCliente;
  const vencidas = filas.filter((f) =>
    fechaEstaVencida(f.fechaVencimiento, diasGracia, hoy),
  );
  const totalPendiente = filas.reduce((a, f) => a + parseFloat(f.saldo), 0);
  const totalVencido = vencidas.reduce((a, f) => a + parseFloat(f.saldo), 0);

  const columnas: Columna<Fila>[] = [
    {
      key: "cliente",
      header: "Cliente",
      cell: (r) => <span className="font-medium">{r.cliente}</span>,
    },
    {
      key: "venta",
      header: "Venta",
      cell: (r) =>
        r.ventaNumero ? (
          <span className="font-mono text-[12px]">{r.ventaNumero}</span>
        ) : (
          <span className="text-[color:var(--color-text-muted)]">—</span>
        ),
      width: "130px",
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
      key: "emision",
      header: "Emisión",
      cell: (r) => formatearFecha(r.fechaEmision, pais),
      width: "110px",
    },
    {
      key: "vencimiento",
      header: "Vencimiento",
      cell: (r) => (
        <span
          className={
            fechaEstaVencida(r.fechaVencimiento, diasGracia, hoy)
              ? "text-[color:var(--color-error)] font-medium"
              : ""
          }
        >
          {formatearFecha(r.fechaVencimiento, pais)}
        </span>
      ),
      width: "120px",
    },
    {
      key: "monto",
      header: "Total factura",
      align: "right",
      cell: (r) => formatearMoneda(parseFloat(r.monto), pais),
      width: "120px",
    },
    {
      key: "saldo",
      header: "Saldo pendiente",
      align: "right",
      cell: (r) => (
        <span className="font-semibold text-[color:var(--color-warning)]">
          {formatearMoneda(parseFloat(r.saldo), pais)}
        </span>
      ),
      width: "130px",
    },
    {
      key: "estado",
      header: "Estado",
      cell: (r) => estadoBadge(r.estado, r.fechaVencimiento, diasGracia, hoy),
      width: "110px",
    },
    {
      key: "accion",
      header: "",
      align: "right",
      cell: (r) => (
        <Link
          href={`/cxc/${r.id}`}
          className="text-[color:var(--color-secondary)] hover:underline"
        >
          Cobrar →
        </Link>
      ),
      width: "80px",
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={clienteId ? "Cobros del cliente" : "Cuentas por cobrar"}
        subtitle={`${filas.length} deudas activas${scope.visible ? ` · ${scope.etiqueta}` : ""}`}
      />

      {filas.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            label="Total por cobrar"
            value={formatearMoneda(totalPendiente, pais)}
            hint={`${filas.length} cuentas activas`}
          />
          <KpiCard
            label="Vencido"
            value={formatearMoneda(totalVencido, pais)}
            hint={`${vencidas.length} cuentas vencidas`}
            delta={vencidas.length > 0 ? `${vencidas.length} vencidas` : undefined}
            deltaPositive={false}
          />
          <KpiCard
            label="Al día"
            value={formatearMoneda(totalPendiente - totalVencido, pais)}
            hint={`${filas.length - vencidas.length} cuentas vigentes`}
          />
        </div>
      )}

      <DataTable
        data={filas}
        columns={columnas}
        rowKey={(r) => r.id}
        empty={
          <EmptyState
            icon={HandCoins}
            titulo="Sin deudas pendientes"
            descripcion="Cuando realices ventas al crédito, las cuentas por cobrar aparecerán aquí."
          />
        }
      />
    </div>
  );
}
