import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { ChefHat, Receipt, Table2 } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import {
  restauranteMesas,
  restauranteOrdenItems,
  restauranteOrdenes,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { enviarComandasOrdenRestauranteForm } from "@/lib/actions/restaurante-vertical";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { formatearFechaHora, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function RestauranteOrdenesPage() {
  const user = await requireSession();
  await requireModulo(user, "restaurante-ordenes");
  const [scope, empresa] = await Promise.all([
    getSucursalScope(user),
    getEmpresaMetadata(user.empresaId),
  ]);
  const visibles = selectedSucursalIds(scope);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;

  const [ordenes, items] = await dbConEmpresa(user.empresaId, (tx) =>
    Promise.all([
      tx
        .select({
          id: restauranteOrdenes.id,
          numero: restauranteOrdenes.numero,
          estado: restauranteOrdenes.estado,
          canal: restauranteOrdenes.canal,
          total: restauranteOrdenes.total,
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
          {ordenes.map((orden) => (
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
                  <span>{orden.canal}</span>
                </div>
                <div className="space-y-2">
                  {(itemsPorOrden.get(orden.id) ?? []).map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-[color:var(--color-surface-2)] px-3 py-2 text-small">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{item.nombreSnapshot}</div>
                        <div className="text-[11px] text-[color:var(--color-text-muted)]">{item.estado}</div>
                      </div>
                      <span>x{parseFloat(item.cantidad).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-[color:var(--color-border)] pt-3">
                  <div className="font-semibold">{formatearMoneda(orden.total, pais)}</div>
                  <form action={enviarComandasOrdenRestauranteForm}>
                    <input type="hidden" name="ordenId" value={orden.id} />
                    <button type="submit" className="arca-btn arca-btn-secondary arca-btn-sm">
                      <ChefHat size={14} /> Enviar nuevos
                    </button>
                  </form>
                </div>
              </CardBody>
            </Card>
          ))}
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

function variantEstado(estado: string): "success" | "warning" | "error" | "info" | "neutral" {
  if (estado === "pagada") return "success";
  if (estado === "en_cocina") return "info";
  if (estado === "cancelada") return "error";
  if (estado === "cuenta_solicitada") return "warning";
  return "neutral";
}
