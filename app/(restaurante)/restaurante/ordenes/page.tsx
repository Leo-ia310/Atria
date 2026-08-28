import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { ChefHat, CreditCard, Receipt, Table2 } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import {
  formasPago,
  restauranteMesas,
  restauranteOrdenItems,
  restauranteOrdenes,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import {
  cobrarOrdenRestauranteForm,
  enviarComandasOrdenRestauranteForm,
  solicitarCuentaRestauranteForm,
} from "@/lib/actions/restaurante-vertical";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { formatearFechaHora, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FormField } from "@/components/ui/FormField";
import { labelItemCocina } from "@/lib/restaurante/display";

export const metadata: Metadata = {
  title: "Ordenes Restaurante | ARCA",
  description: "Seguimiento, cuenta y cobro de ordenes de restaurante en ARCA.",
};

export default async function RestauranteOrdenesPage() {
  const user = await requireSession();
  await requireModulo(user, "restaurante-ordenes");
  const [scope, empresa] = await Promise.all([
    getSucursalScope(user),
    getEmpresaMetadata(user.empresaId),
  ]);
  const visibles = selectedSucursalIds(scope);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;

  const [ordenes, items, formasPagoList] = await dbConEmpresa(user.empresaId, (tx) =>
    Promise.all([
      tx
        .select({
          id: restauranteOrdenes.id,
          numero: restauranteOrdenes.numero,
          estado: restauranteOrdenes.estado,
          canal: restauranteOrdenes.canal,
          total: restauranteOrdenes.total,
          propina: restauranteOrdenes.propina,
          ventaId: restauranteOrdenes.ventaId,
          personas: restauranteOrdenes.personas,
          abiertoEn: restauranteOrdenes.abiertoEn,
          mesaNombre: restauranteMesas.nombre,
        })
        .from(restauranteOrdenes)
        .leftJoin(restauranteMesas, eq(restauranteMesas.id, restauranteOrdenes.mesaId))
        .where(
          and(
            eq(restauranteOrdenes.empresaId, user.empresaId),
            visibles ? inArray(restauranteOrdenes.sucursalId, visibles) : undefined,
          ),
        )
        .orderBy(desc(restauranteOrdenes.abiertoEn))
        .limit(80),
      tx
        .select()
        .from(restauranteOrdenItems)
        .where(eq(restauranteOrdenItems.empresaId, user.empresaId))
        .orderBy(desc(restauranteOrdenItems.creadoEn)),
      tx
        .select({
          id: formasPago.id,
          nombre: formasPago.nombre,
          requiereReferencia: formasPago.requiereReferencia,
        })
        .from(formasPago)
        .where(and(eq(formasPago.empresaId, user.empresaId), eq(formasPago.activa, true)))
        .orderBy(formasPago.nombre),
    ]),
  );

  const itemsPorOrden = new Map<string, typeof items>();
  for (const item of items) {
    const lista = itemsPorOrden.get(item.ordenId) ?? [];
    lista.push(item);
    itemsPorOrden.set(item.ordenId, lista);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-label">{scope.visible ? scope.etiqueta : "Todas las ordenes"}</p>
          <h1 className="mt-1 text-xl">Ordenes</h1>
          <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
            Supervisa cuentas abiertas y su avance hacia cocina.
          </p>
        </div>
        <Link href="/restaurante/pos" className="arca-btn arca-btn-primary arca-btn-sm">
          Nueva orden
        </Link>
      </header>

      {ordenes.length === 0 ? (
        <Card>
          <CardBody>
            <div className="py-12 text-center text-small text-[color:var(--color-text-muted)]">
              No hay ordenes registradas.
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {ordenes.map((orden) => {
            const ordenItems = itemsPorOrden.get(orden.id) ?? [];
            const nuevos = ordenItems.filter((item) => item.estado === "borrador");
            const cerrada = orden.estado === "pagada" || orden.estado === "cancelada";
            const puedeEnviar = !cerrada && nuevos.length > 0;
            const puedeSolicitarCuenta =
              !cerrada && ordenItems.length > 0 && orden.estado !== "cuenta_solicitada";
            const puedeCobrar = !cerrada && ordenItems.length > 0 && formasPagoList.length > 0;
            return (
              <Card key={orden.id}>
                <CardHeader
                  title={
                    <span className="inline-flex items-center gap-2">
                      <Receipt size={16} /> {orden.numero}
                    </span>
                  }
                  subtitle={formatearFechaHora(orden.abiertoEn, pais, empresa?.zonaHoraria)}
                  actions={<Badge variant={variantEstado(orden.estado)}>{labelEstado(orden.estado)}</Badge>}
                />
                <CardBody className="space-y-4">
                  <div className="flex flex-wrap gap-2 text-small text-[color:var(--color-text-muted)]">
                    {orden.mesaNombre && (
                      <span className="inline-flex items-center gap-1">
                        <Table2 size={13} /> {orden.mesaNombre}
                      </span>
                    )}
                    <span>{orden.personas} personas</span>
                    <span>{labelCanal(orden.canal)}</span>
                  </div>
                  <div className="space-y-2">
                    {ordenItems.length === 0 ? (
                      <div className="rounded-md border border-dashed border-[color:var(--color-border)] px-3 py-4 text-center text-small text-[color:var(--color-text-muted)]">
                        Esta orden aun no tiene productos.
                      </div>
                    ) : (
                      ordenItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-[color:var(--color-surface-2)] px-3 py-2 text-small">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{item.nombreSnapshot}</div>
                            <div className="text-[11px] text-[color:var(--color-text-muted)]">{labelItemCocina(item.estado)}</div>
                          </div>
                          <span>x{parseFloat(item.cantidad).toFixed(0)}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="grid gap-3 border-t border-[color:var(--color-border)] pt-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
                    <div>
                      <div className="text-label">Total abierto</div>
                      <div className="font-semibold">{formatearMoneda(orden.total, pais)}</div>
                    </div>
                    <form action={enviarComandasOrdenRestauranteForm}>
                      <input type="hidden" name="ordenId" value={orden.id} />
                      <button type="submit" disabled={!puedeEnviar} className="arca-btn arca-btn-secondary arca-btn-sm w-full justify-center">
                        <ChefHat size={14} />
                        {puedeEnviar ? "Enviar nuevos" : "Sin nuevos"}
                      </button>
                    </form>
                    <form action={solicitarCuentaRestauranteForm}>
                      <input type="hidden" name="ordenId" value={orden.id} />
                      <button
                        type="submit"
                        disabled={!puedeSolicitarCuenta}
                        className="arca-btn arca-btn-secondary arca-btn-sm w-full justify-center"
                      >
                        <Receipt size={14} />
                        {orden.estado === "cuenta_solicitada" ? "Cuenta solicitada" : "Solicitar cuenta"}
                      </button>
                    </form>
                  </div>
                  {!cerrada && (
                    <form
                      action={cobrarOrdenRestauranteForm}
                      className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-base font-semibold">Cobrar orden</h2>
                          <p className="text-[12px] text-[color:var(--color-text-muted)]">
                            Convierte la orden en venta core y libera la mesa a limpieza.
                          </p>
                        </div>
                        <CreditCard size={17} className="text-[color:var(--color-secondary)]" />
                      </div>
                      <input type="hidden" name="ordenId" value={orden.id} />
                      <input type="hidden" name="idempotencyKey" value={randomUUID()} />
                      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_auto] md:items-end">
                        <FormField label="Forma de pago">
                          <select
                            name="formaPagoId"
                            disabled={formasPagoList.length === 0}
                            className="arca-input"
                          >
                            {formasPagoList.map((formaPago) => (
                              <option key={formaPago.id} value={formaPago.id}>
                                {formaPago.nombre}
                                {formaPago.requiereReferencia ? " - requiere ref." : ""}
                              </option>
                            ))}
                          </select>
                        </FormField>
                        <FormField label="Propina">
                          <input
                            name="propina"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={orden.propina}
                            className="arca-input"
                          />
                        </FormField>
                        <FormField label="Referencia">
                          <input name="referencia" className="arca-input" />
                        </FormField>
                        <button
                          type="submit"
                          disabled={!puedeCobrar}
                          className="arca-btn arca-btn-primary justify-center"
                        >
                          Cobrar orden
                        </button>
                      </div>
                      {formasPagoList.length === 0 && (
                        <p className="mt-2 text-[12px] text-[color:var(--color-warning)]">
                          Configura una forma de pago activa antes de cobrar.
                        </p>
                      )}
                    </form>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function labelEstado(estado: string): string {
  const labels: Record<string, string> = {
    borrador: "Borrador",
    abierta: "Abierta",
    en_cocina: "En cocina",
    cuenta_solicitada: "Cuenta solicitada",
    pagada: "Pagada",
    cancelada: "Cancelada",
  };
  return labels[estado] ?? estado;
}

function labelCanal(canal: string): string {
  const labels: Record<string, string> = {
    salon: "Comer en el lugar",
    qr_mesa: "QR mesa",
    para_llevar: "Para llevar",
    delivery_propio: "Delivery propio",
    delivery_externo: "Delivery externo",
    pedido_web: "Pedido web",
  };
  return labels[canal] ?? canal;
}

function variantEstado(estado: string): "success" | "warning" | "error" | "info" | "neutral" {
  if (estado === "pagada") return "success";
  if (estado === "en_cocina") return "info";
  if (estado === "cancelada") return "error";
  if (estado === "cuenta_solicitada") return "warning";
  return "neutral";
}
