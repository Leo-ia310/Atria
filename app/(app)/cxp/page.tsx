import Link from "next/link";
import { Banknote } from "lucide-react";
import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { compras, cuentasPorPagar, proveedores, sucursales } from "@/lib/db/schema";
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
  proveedor: string;
  compraNumero: string | null;
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

export default async function CxPPage({
  searchParams,
}: {
  searchParams: Promise<{ proveedorId?: string }>;
}) {
  const [user, { proveedorId }] = await Promise.all([
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
      id: cuentasPorPagar.id,
      proveedor: proveedores.razonSocial,
      compraNumero: compras.numeroFactura,
      sucursal: sucursales.nombre,
      fechaEmision: cuentasPorPagar.fechaEmision,
      fechaVencimiento: cuentasPorPagar.fechaVencimiento,
      monto: cuentasPorPagar.monto,
      saldo: cuentasPorPagar.saldo,
      estado: cuentasPorPagar.estado,
    })
    .from(cuentasPorPagar)
    .innerJoin(proveedores, eq(proveedores.id, cuentasPorPagar.proveedorId))
    .leftJoin(compras, eq(compras.id, cuentasPorPagar.compraId))
    .leftJoin(sucursales, eq(sucursales.id, compras.sucursalId))
    .where(
      and(
        eq(cuentasPorPagar.empresaId, user.empresaId),
        notInArray(cuentasPorPagar.estado, ["pagada"]),
        proveedorId ? eq(cuentasPorPagar.proveedorId, proveedorId) : undefined,
        sucursalIds ? inArray(compras.sucursalId, sucursalIds) : undefined,
      ),
    )
    .orderBy(desc(cuentasPorPagar.fechaVencimiento))
    .limit(500);

  const hoy = fechaISOEnZona(new Date(), zonaHoraria);
  const diasGracia = politicas.diasGraciaPagoProveedor;
  const vencidas = filas.filter((f) =>
    fechaEstaVencida(f.fechaVencimiento, diasGracia, hoy),
  );
  const totalPendiente = filas.reduce((a, f) => a + parseFloat(f.saldo), 0);
  const totalVencido = vencidas.reduce((a, f) => a + parseFloat(f.saldo), 0);

  const columnas: Columna<Fila>[] = [
    {
      key: "proveedor",
      header: "Proveedor",
      cell: (r) => <span className="font-medium">{r.proveedor}</span>,
    },
    {
      key: "factura",
      header: "Factura",
      cell: (r) =>
        r.compraNumero ? (
          <span className="font-mono text-[12px]">{r.compraNumero}</span>
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
          href={`/cxp/${r.id}`}
          className="text-[color:var(--color-secondary)] hover:underline"
        >
          Pagar →
        </Link>
      ),
      width: "80px",
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={proveedorId ? "Pagos del proveedor" : "Cuentas por pagar"}
        subtitle={`${filas.length} deudas activas${scope.visible ? ` · ${scope.etiqueta}` : ""}`}
      />

      {filas.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            label="Total por pagar"
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
            icon={Banknote}
            titulo="Sin deudas pendientes"
            descripcion="Cuando registres compras al crédito, las cuentas por pagar aparecerán aquí."
          />
        }
      />
    </div>
  );
}
