import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ChefHat, Clock, Receipt, Table2, Utensils } from "lucide-react";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  pedidoCocinaItems,
  pedidosCocina,
  menusVirtuales,
  sucursales,
  ventas,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { getAccessContext, requireModulo } from "@/lib/server-access";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { actualizarEstadoPedidoCocina } from "@/lib/actions/restaurante";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatearFechaHora } from "@/lib/utils";

const ESTADOS = [
  { id: "nuevo", titulo: "Nuevos", badge: "warning" },
  { id: "en_preparacion", titulo: "En preparacion", badge: "info" },
  { id: "listo", titulo: "Listos", badge: "success" },
] as const;

export default async function PedidosCocinaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const [sp, user] = await Promise.all([searchParams, requireSession()]);
  const access = await getAccessContext(user);
  if (access.verticalEmpresa === "restaurante" || access.tipoEmpresa === "restaurante") {
    redirect("/restaurante/kds");
  }
  await requireModulo(user, "pedidos-cocina");
  const scope = await getSucursalScope(user);
  const sucursalIds = selectedSucursalIds(scope);

  const pedidos = await db
    .select({
      id: pedidosCocina.id,
      numero: pedidosCocina.numero,
      estado: pedidosCocina.estado,
      clienteNombre: pedidosCocina.clienteNombre,
      notas: pedidosCocina.notas,
      origen: pedidosCocina.origen,
      clienteTelefono: pedidosCocina.clienteTelefono,
      clienteDireccion: pedidosCocina.clienteDireccion,
      mesaNumero: pedidosCocina.mesaNumero,
      creadoEn: pedidosCocina.creadoEn,
      ventaId: pedidosCocina.ventaId,
      ventaNumero: ventas.numero,
      menuNombre: menusVirtuales.nombre,
      sucursalNombre: sucursales.nombre,
    })
    .from(pedidosCocina)
    .leftJoin(ventas, eq(ventas.id, pedidosCocina.ventaId))
    .leftJoin(menusVirtuales, eq(menusVirtuales.id, pedidosCocina.menuId))
    .leftJoin(sucursales, eq(sucursales.id, pedidosCocina.sucursalId))
    .where(
      and(
        eq(pedidosCocina.empresaId, user.empresaId),
        ne(pedidosCocina.estado, "entregado"),
        ne(pedidosCocina.estado, "cancelado"),
        sucursalIds ? inArray(pedidosCocina.sucursalId, sucursalIds) : undefined,
      ),
    )
    .orderBy(desc(pedidosCocina.creadoEn))
    .limit(80);

  const pedidoIds = pedidos.map((pedido) => pedido.id);
  const items = pedidoIds.length
    ? await db
        .select()
        .from(pedidoCocinaItems)
        .where(inArray(pedidoCocinaItems.pedidoId, pedidoIds))
    : [];
  const itemsPorPedido = new Map<string, typeof items>();
  for (const item of items) {
    const lista = itemsPorPedido.get(item.pedidoId) ?? [];
    lista.push(item);
    itemsPorPedido.set(item.pedidoId, lista);
  }

  return (
    <div>
      <PageHeader
        title="Pedidos cocina"
        subtitle={`Tickets generados desde el POS${scope.visible ? ` · ${scope.etiqueta}` : ""}`}
      />

      {(sp.error || sp.guardado) && (
        <div
          className={
            sp.error
              ? "mb-4 rounded-md bg-[color:var(--color-error-bg)] px-3 py-2 text-small text-[color:var(--color-error)]"
              : "mb-4 rounded-md bg-[color:var(--color-success)]/10 px-3 py-2 text-small text-[color:var(--color-success)]"
          }
        >
          {sp.error ?? "Pedido actualizado."}
        </div>
      )}

      {pedidos.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={ChefHat}
              titulo="Sin pedidos abiertos"
              descripcion="Cuando el POS o el menu publico registren un pedido, el ticket aparecera aqui."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          {ESTADOS.map((columna) => {
            const pedidosColumna = pedidos.filter((pedido) => pedido.estado === columna.id);
            return (
              <section key={columna.id} className="min-w-0">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-[color:var(--color-text-primary)]">
                    {columna.titulo}
                  </h2>
                  <Badge variant={columna.badge}>{pedidosColumna.length}</Badge>
                </div>
                <div className="space-y-3">
                  {pedidosColumna.length === 0 ? (
                    <div className="rounded-md border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 text-center text-small text-[color:var(--color-text-muted)]">
                      Sin tickets.
                    </div>
                  ) : (
                    pedidosColumna.map((pedido) => (
                      <Card key={pedido.id}>
                        <CardBody>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                {pedido.origen === "menu_virtual" ? (
                                  <Utensils size={15} className="text-[color:var(--color-text-muted)]" />
                                ) : (
                                  <Receipt size={15} className="text-[color:var(--color-text-muted)]" />
                                )}
                                <span className="font-semibold text-[color:var(--color-text-primary)]">
                                  {pedido.numero}
                                </span>
                                {pedido.mesaNumero && (
                                  <Badge variant="warning">
                                    <Table2 size={12} /> Mesa {pedido.mesaNumero}
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[color:var(--color-text-muted)]">
                                <span>{pedido.clienteNombre ?? "Consumidor final"}</span>
                                {pedido.clienteTelefono && <span>{pedido.clienteTelefono}</span>}
                                {pedido.sucursalNombre && <span>{pedido.sucursalNombre}</span>}
                                {pedido.menuNombre && <span>{pedido.menuNombre}</span>}
                                <span className="inline-flex items-center gap-1">
                                  <Clock size={12} /> {formatearFechaHora(pedido.creadoEn)}
                                </span>
                              </div>
                            </div>
                            <Badge
                              variant={
                                pedido.estado === "nuevo"
                                  ? "warning"
                                  : pedido.estado === "en_preparacion"
                                    ? "info"
                                    : "success"
                              }
                            >
                              {labelEstado(pedido.estado)}
                            </Badge>
                          </div>

                          <div className="mt-4 space-y-2">
                            {(itemsPorPedido.get(pedido.id) ?? []).map((item) => (
                              <div
                                key={item.id}
                                className="flex justify-between gap-3 rounded-md bg-[color:var(--color-surface-2)] px-3 py-2 text-small"
                              >
                                <span className="font-medium text-[color:var(--color-text-primary)]">
                                  {item.nombre}
                                </span>
                                <span className="text-[color:var(--color-text-muted)]">
                                  x{cantidad(item.cantidad)}
                                </span>
                              </div>
                            ))}
                          </div>

                          {pedido.notas && (
                            <p className="mt-3 rounded-md bg-[color:var(--color-warning-bg)] px-3 py-2 text-small text-[color:var(--color-text-primary)]">
                              {pedido.notas}
                            </p>
                          )}
                          {pedido.clienteDireccion && (
                            <p className="mt-3 rounded-md bg-[color:var(--color-info-bg)] px-3 py-2 text-small text-[color:var(--color-text-primary)]">
                              {pedido.clienteDireccion}
                            </p>
                          )}

                          <div className="mt-4 flex flex-wrap justify-between gap-2">
                            {pedido.ventaId ? (
                              <Link
                                href={`/ventas/${pedido.ventaId}`}
                                className="arca-btn arca-btn-ghost arca-btn-sm"
                              >
                                Venta {pedido.ventaNumero}
                              </Link>
                            ) : (
                              <span className="arca-badge arca-badge-info">
                                Menu publico
                              </span>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {pedido.estado === "nuevo" && (
                                <EstadoButton pedidoId={pedido.id} estado="en_preparacion">
                                  Preparar
                                </EstadoButton>
                              )}
                              {pedido.estado === "en_preparacion" && (
                                <EstadoButton pedidoId={pedido.id} estado="listo">
                                  Listo
                                </EstadoButton>
                              )}
                              {pedido.estado === "listo" && (
                                <EstadoButton pedidoId={pedido.id} estado="entregado">
                                  Entregado
                                </EstadoButton>
                              )}
                              <EstadoButton pedidoId={pedido.id} estado="cancelado" variant="ghost">
                                Cancelar
                              </EstadoButton>
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EstadoButton({
  pedidoId,
  estado,
  children,
  variant = "secondary",
}: {
  pedidoId: string;
  estado: string;
  children: ReactNode;
  variant?: "secondary" | "ghost";
}) {
  return (
    <form action={actualizarEstadoPedidoCocina}>
      <input type="hidden" name="pedidoId" value={pedidoId} />
      <input type="hidden" name="estado" value={estado} />
      <Button type="submit" size="sm" variant={variant}>
        {children}
      </Button>
    </form>
  );
}

function labelEstado(estado: string): string {
  const labels: Record<string, string> = {
    nuevo: "Nuevo",
    en_preparacion: "En preparacion",
    listo: "Listo",
    entregado: "Entregado",
    cancelado: "Cancelado",
  };
  return labels[estado] ?? estado;
}

function cantidad(valor: string): string {
  const num = parseFloat(valor);
  if (Number.isNaN(num)) return valor;
  return Number.isInteger(num) ? String(num) : num.toFixed(2);
}
