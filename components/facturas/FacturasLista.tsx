import Link from "next/link";
import { and, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";
import { CheckCircle2, Clock, FileText } from "lucide-react";
import { db } from "@/lib/db";
import {
  cuentasPorCobrar,
  facturas,
  sucursales,
  usuarios,
  ventas,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatearFecha, formatearFechaHora, formatearMoneda } from "@/lib/utils";
import { getPaisConfig, type PaisCodigo } from "@/lib/paises";
import { FacturaVer } from "@/components/facturas/FacturaVer";
import { ImprimirFacturasLote } from "@/components/facturas/ImprimirFacturasLote";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { reciboDesdeSnapshot } from "@/lib/facturas";
import { fechaEstaVencida, getPoliticasNegocio } from "@/lib/politicas-negocio";

export type ModoFacturas = "cobradas" | "credito";

export type FacturasSearchParams = {
  numero?: string;
  desde?: string;
  hasta?: string;
  vendedor?: string;
  forma?: string;
};

const CONFIG = {
  cobradas: {
    titulo: "Facturas cobradas",
    ruta: "/facturas/cobradas",
    tipo: "contado",
    badge: "Cobrada",
    printLabel: "Imprimir cobradas",
    descripcionVacia: "Las ventas de contado apareceran aqui al generar su factura.",
  },
  credito: {
    titulo: "Facturas al credito",
    ruta: "/facturas/credito",
    tipo: "credito",
    badge: "Credito",
    printLabel: "Imprimir al credito",
    descripcionVacia: "Las ventas al credito apareceran aqui con su cuenta por cobrar.",
  },
} satisfies Record<
  ModoFacturas,
  {
    titulo: string;
    ruta: string;
    tipo: "contado" | "credito";
    badge: string;
    printLabel: string;
    descripcionVacia: string;
  }
>;

export async function FacturasLista({
  modo,
  searchParams,
}: {
  modo: ModoFacturas;
  searchParams: FacturasSearchParams;
}) {
  const user = await requireSession();
  const configVista = CONFIG[modo];
  const esCredito = modo === "credito";
  const [scope, empresa, vendedores, politicas] = await Promise.all([
    getSucursalScope(user),
    getEmpresaMetadata(user.empresaId),
    db
      .select({ id: usuarios.id, nombre: usuarios.nombre })
      .from(usuarios)
      .where(eq(usuarios.empresaId, user.empresaId)),
    getPoliticasNegocio(user.empresaId),
  ]);
  const sucursalIds = selectedSucursalIds(scope);

  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const configPais = getPaisConfig(pais);
  const empresaRecibo = {
    nombre: empresa?.nombreComercial || empresa?.razonSocial || "Mi Empresa",
    idFiscalNombre: configPais.idFiscalNombre,
    identificacionFiscal: empresa?.identificacionFiscal ?? "",
    direccion: empresa?.direccion ?? null,
    telefono: empresa?.telefono ?? null,
  };

  const cond: SQL[] = [
    eq(facturas.empresaId, user.empresaId),
    eq(facturas.esCredito, esCredito),
  ];
  if (searchParams.numero) cond.push(ilike(facturas.numero, `%${searchParams.numero}%`));
  if (searchParams.desde && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.desde)) {
    cond.push(sql`${facturas.fecha}::date >= ${searchParams.desde}`);
  }
  if (searchParams.hasta && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.hasta)) {
    cond.push(sql`${facturas.fecha}::date <= ${searchParams.hasta}`);
  }
  if (searchParams.vendedor) cond.push(eq(facturas.vendedorId, searchParams.vendedor));
  if (searchParams.forma) cond.push(ilike(facturas.formasPago, `%${searchParams.forma}%`));
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
      cxcId: cuentasPorCobrar.id,
      cxcSaldo: cuentasPorCobrar.saldo,
      cxcEstado: cuentasPorCobrar.estado,
      cxcVencimiento: cuentasPorCobrar.fechaVencimiento,
    })
    .from(facturas)
    .leftJoin(ventas, eq(ventas.id, facturas.ventaId))
    .leftJoin(
      cuentasPorCobrar,
      and(
        eq(cuentasPorCobrar.ventaId, facturas.ventaId),
        eq(cuentasPorCobrar.empresaId, user.empresaId),
      ),
    )
    .leftJoin(sucursales, eq(sucursales.id, ventas.sucursalId))
    .where(and(...cond))
    .orderBy(desc(facturas.fecha))
    .limit(500);

  const totalFiltrado = filas.reduce((a, f) => a + parseFloat(f.total), 0);
  const totalPendiente = filas.reduce((a, f) => a + parseFloat(f.cxcSaldo ?? "0"), 0);
  const hoy = new Date().toISOString().slice(0, 10);
  const diasGraciaCobro = politicas.diasGraciaCobroCliente;
  const hayFiltro = Boolean(
    searchParams.numero ||
      searchParams.desde ||
      searchParams.hasta ||
      searchParams.vendedor ||
      searchParams.forma,
  );
  const parametrosImpresion = new URLSearchParams({ tipo: configVista.tipo });
  for (const [clave, valor] of Object.entries(searchParams)) {
    if (valor) parametrosImpresion.set(clave, valor);
  }
  const imprimirHref = `/facturas/imprimir?${parametrosImpresion}`;

  return (
    <div>
      <PageHeader
        title={configVista.titulo}
        subtitle={`${filas.length} facturas - ${formatearMoneda(totalFiltrado, pais)}${esCredito ? ` - saldo CxC ${formatearMoneda(totalPendiente, pais)}` : ""}${scope.visible ? ` - ${scope.etiqueta}` : ""}`}
        actions={
          <ImprimirFacturasLote
            href={imprimirHref}
            total={filas.length}
            label={hayFiltro ? "Imprimir filtradas" : configVista.printLabel}
          />
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/facturas/cobradas"
          className={`arca-btn arca-btn-sm ${
            modo === "cobradas" ? "arca-btn-primary" : "arca-btn-secondary"
          }`}
        >
          <CheckCircle2 size={14} /> Cobradas
        </Link>
        <Link
          href="/facturas/credito"
          className={`arca-btn arca-btn-sm ${
            modo === "credito" ? "arca-btn-primary" : "arca-btn-secondary"
          }`}
        >
          <Clock size={14} /> Al credito
        </Link>
      </div>

      <Card className="mb-4">
        <CardBody>
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div>
              <label className="text-label mb-1.5 block">Factura</label>
              <input
                type="text"
                name="numero"
                defaultValue={searchParams.numero ?? ""}
                placeholder="Numero"
                className="arca-input w-36"
              />
            </div>
            <div>
              <label className="text-label mb-1.5 block">Desde</label>
              <input
                type="date"
                name="desde"
                defaultValue={searchParams.desde ?? ""}
                className="arca-input w-44"
              />
            </div>
            <div>
              <label className="text-label mb-1.5 block">Hasta</label>
              <input
                type="date"
                name="hasta"
                defaultValue={searchParams.hasta ?? ""}
                className="arca-input w-44"
              />
            </div>
            <div>
              <label className="text-label mb-1.5 block">Vendedor</label>
              <select
                name="vendedor"
                defaultValue={searchParams.vendedor ?? ""}
                className="arca-input w-48"
              >
                <option value="">Todos</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </select>
            </div>
            {!esCredito && (
              <div>
                <label className="text-label mb-1.5 block">Forma de pago</label>
                <input
                  type="text"
                  name="forma"
                  defaultValue={searchParams.forma ?? ""}
                  placeholder="Efectivo, tarjeta"
                  className="arca-input w-44"
                />
              </div>
            )}
            <button type="submit" className="arca-btn arca-btn-primary">
              Filtrar
            </button>
            <Link href={configVista.ruta} className="arca-btn arca-btn-ghost arca-btn-sm">
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
              descripcion={configVista.descripcionVacia}
            />
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-small">
              <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                <tr>
                  <th className="text-label px-4 py-3 text-left">Factura</th>
                  <th className="text-label px-4 py-3 text-left">Fecha</th>
                  <th className="text-label px-4 py-3 text-left">Cliente</th>
                  {scope.visible && (
                    <th className="text-label px-4 py-3 text-left">Sucursal</th>
                  )}
                  <th className="text-label px-4 py-3 text-left">Vendedor</th>
                  {esCredito ? (
                    <>
                      <th className="text-label px-4 py-3 text-left">Vencimiento</th>
                      <th className="text-label px-4 py-3 text-right">Saldo CxC</th>
                      <th className="text-label px-4 py-3 text-left">Estado</th>
                    </>
                  ) : (
                    <th className="text-label px-4 py-3 text-left">Pago</th>
                  )}
                  <th className="text-label px-4 py-3 text-right">Total</th>
                  <th className="text-label px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const recibo = reciboDesdeSnapshot({
                    snapshot: f.snapshot as Record<string, unknown>,
                    pais,
                    empresa: empresaRecibo,
                    impuestoNombre: configPais.impuestoNombre,
                  });
                  return (
                    <tr
                      key={f.id}
                      className="border-b border-[color:var(--color-border)] last:border-b-0"
                    >
                      <td className="px-4 py-2 font-medium">
                        <Link href={`/facturas/${f.id}`} className="hover:underline">
                          {f.numero}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-[color:var(--color-text-muted)]">
                        {formatearFechaHora(f.fecha)}
                      </td>
                      <td className="px-4 py-2">{f.cliente ?? "Consumidor final"}</td>
                      {scope.visible && (
                        <td className="px-4 py-2">{f.sucursal ?? "Sin sucursal"}</td>
                      )}
                      <td className="px-4 py-2">{f.vendedor ?? "-"}</td>
                      {esCredito ? (
                        <>
                          <td className="px-4 py-2">
                            {f.cxcVencimiento ? formatearFecha(f.cxcVencimiento, pais) : "-"}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-[color:var(--color-warning)]">
                            {formatearMoneda(parseFloat(f.cxcSaldo ?? f.total), pais)}
                          </td>
                          <td className="px-4 py-2">
                            {estadoCreditoBadge(
                              f.cxcEstado,
                              f.cxcVencimiento,
                              diasGraciaCobro,
                              hoy,
                            )}
                          </td>
                        </>
                      ) : (
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <span>{f.formasPago ?? "-"}</span>
                            <Badge variant="success">{configVista.badge}</Badge>
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-2 text-right font-semibold">
                        {formatearMoneda(parseFloat(f.total), pais)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <FacturaVer data={recibo} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function estadoCreditoBadge(
  estado: string | null,
  fechaVencimiento: string | null,
  diasGracia: number,
  hoy: string,
) {
  if (!estado) return <Badge variant="warning">Sin CxC</Badge>;
  if (estado !== "pagada" && fechaEstaVencida(fechaVencimiento, diasGracia, hoy)) {
    return <Badge variant="error">Vencida</Badge>;
  }
  if (estado === "pagada") return <Badge variant="success">Pagada</Badge>;
  if (estado === "parcial") return <Badge variant="warning">Parcial</Badge>;
  if (estado === "incobrable") return <Badge variant="error">Incobrable</Badge>;
  return <Badge variant="neutral">Pendiente</Badge>;
}
