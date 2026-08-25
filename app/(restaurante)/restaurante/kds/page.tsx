import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { ChefHat, Clock, Table2, UserRound } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import {
  restauranteComandaItems,
  restauranteComandas,
  restauranteEstaciones,
  restauranteMesas,
  restauranteOrdenes,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { actualizarEstadoComandaRestauranteForm } from "@/lib/actions/restaurante-vertical";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function RestauranteKdsPage() {
  const user = await requireSession();
  await requireModulo(user, "restaurante-kds");
  const scope = await getSucursalScope(user);
  const visibles = selectedSucursalIds(scope);

  const [estaciones, comandas, items] = await dbConEmpresa(user.empresaId, (tx) =>
    Promise.all([
      tx
        .select()
        .from(restauranteEstaciones)
        .where(
          and(
            eq(restauranteEstaciones.empresaId, user.empresaId),
            eq(restauranteEstaciones.activa, true),
            visibles ? inArray(restauranteEstaciones.sucursalId, visibles) : undefined,
          ),
        )
        .orderBy(asc(restauranteEstaciones.orden), asc(restauranteEstaciones.nombre)),
      tx
        .select({
          id: restauranteComandas.id,
          numero: restauranteComandas.numero,
          estado: restauranteComandas.estado,
          estacionId: restauranteComandas.estacionId,
          prioridad: restauranteComandas.prioridad,
          enviadaEn: restauranteComandas.enviadaEn,
          ordenNumero: restauranteOrdenes.numero,
          mesaNombre: restauranteMesas.nombre,
          personas: restauranteOrdenes.personas,
        })
        .from(restauranteComandas)
        .innerJoin(restauranteOrdenes, eq(restauranteOrdenes.id, restauranteComandas.ordenId))
        .leftJoin(restauranteMesas, eq(restauranteMesas.id, restauranteOrdenes.mesaId))
        .where(
          and(
            eq(restauranteComandas.empresaId, user.empresaId),
            inArray(restauranteComandas.estado, ["enviada", "recibida", "preparando", "lista"]),
            visibles ? inArray(restauranteComandas.sucursalId, visibles) : undefined,
          ),
        )
        .orderBy(desc(restauranteComandas.prioridad), asc(restauranteComandas.enviadaEn)),
      tx
        .select()
        .from(restauranteComandaItems)
        .where(eq(restauranteComandaItems.empresaId, user.empresaId))
        .orderBy(asc(restauranteComandaItems.creadoEn)),
    ]),
  );

  const itemsPorComanda = new Map<string, typeof items>();
  for (const item of items) {
    const lista = itemsPorComanda.get(item.comandaId) ?? [];
    lista.push(item);
    itemsPorComanda.set(item.comandaId, lista);
  }
  const estacionesConDefault =
    estaciones.length > 0
      ? estaciones
      : [{ id: "sin-estacion", nombre: "Cocina", tipo: "cocina" as const }];

  return (
    <div className="space-y-5">
      <header>
        <p className="text-label">{scope.visible ? scope.etiqueta : "Todas las estaciones"}</p>
        <h1 className="mt-1 text-xl">KDS</h1>
        <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
          Cocina, barra y estaciones ven solo comandas activas.
        </p>
      </header>

      {comandas.length === 0 ? (
        <Card>
          <CardBody>
            <div className="py-12 text-center text-small text-[color:var(--color-text-muted)]">
              No hay comandas activas.
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          {estacionesConDefault.map((estacion) => {
            const comandasEstacion = comandas.filter(
              (comanda) => (comanda.estacionId ?? "sin-estacion") === estacion.id,
            );
            return (
              <section key={estacion.id} className="min-w-0">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold">{estacion.nombre}</h2>
                  <Badge variant="info">{comandasEstacion.length}</Badge>
                </div>
                <div className="space-y-3">
                  {comandasEstacion.length === 0 ? (
                    <div className="rounded-md border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 text-center text-small text-[color:var(--color-text-muted)]">
                      Sin tickets.
                    </div>
                  ) : (
                    comandasEstacion.map((comanda) => (
                      <Card key={comanda.id} className="border-[color:var(--color-border-strong)]">
                        <CardHeader
                          title={
                            <span className="inline-flex items-center gap-2">
                              <ChefHat size={16} /> {comanda.numero}
                            </span>
                          }
                          subtitle={`Orden ${comanda.ordenNumero}`}
                          actions={<Badge variant={variantEstado(comanda.estado)}>{labelEstado(comanda.estado)}</Badge>}
                        />
                        <CardBody className="space-y-4">
                          <div className="flex flex-wrap gap-2 text-[12px] text-[color:var(--color-text-muted)]">
                            {comanda.mesaNombre && (
                              <span className="inline-flex items-center gap-1">
                                <Table2 size={12} /> {comanda.mesaNombre}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                              <UserRound size={12} /> {comanda.personas} pax
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock size={12} /> {minutosDesde(comanda.enviadaEn)} min
                            </span>
                          </div>

                          <div className="space-y-2">
                            {(itemsPorComanda.get(comanda.id) ?? []).map((item) => (
                              <div key={item.id} className="rounded-md bg-[color:var(--color-surface-2)] px-3 py-2">
                                <div className="flex items-center justify-between gap-3 text-small">
                                  <span className="font-medium">{item.nombreSnapshot}</span>
                                  <span>x{parseFloat(item.cantidad).toFixed(0)}</span>
                                </div>
                                {item.notasCocina && (
                                  <div className="mt-1 text-[12px] text-[color:var(--color-warning)]">
                                    {item.notasCocina}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            {comanda.estado === "enviada" && (
                              <EstadoButton comandaId={comanda.id} estado="recibida">
                                Recibir
                              </EstadoButton>
                            )}
                            {(comanda.estado === "enviada" || comanda.estado === "recibida") && (
                              <EstadoButton comandaId={comanda.id} estado="preparando">
                                Preparar
                              </EstadoButton>
                            )}
                            {comanda.estado === "preparando" && (
                              <EstadoButton comandaId={comanda.id} estado="lista">
                                Listo
                              </EstadoButton>
                            )}
                            {comanda.estado === "lista" && (
                              <EstadoButton comandaId={comanda.id} estado="entregada">
                                Entregado
                              </EstadoButton>
                            )}
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
  comandaId,
  estado,
  children,
}: {
  comandaId: string;
  estado: string;
  children: React.ReactNode;
}) {
  return (
    <form action={actualizarEstadoComandaRestauranteForm}>
      <input type="hidden" name="comandaId" value={comandaId} />
      <input type="hidden" name="estado" value={estado} />
      <button type="submit" className="arca-btn arca-btn-primary arca-btn-sm w-full">
        {children}
      </button>
    </form>
  );
}

function minutosDesde(fecha: Date): number {
  return Math.max(0, Math.round((Date.now() - fecha.getTime()) / 60000));
}

function labelEstado(estado: string): string {
  const labels: Record<string, string> = {
    enviada: "Pendiente",
    recibida: "Recibida",
    preparando: "Preparando",
    lista: "Lista",
    entregada: "Entregada",
    cancelada: "Cancelada",
  };
  return labels[estado] ?? estado;
}

function variantEstado(estado: string): "success" | "warning" | "error" | "info" | "neutral" {
  if (estado === "lista" || estado === "entregada") return "success";
  if (estado === "preparando") return "info";
  if (estado === "cancelada") return "error";
  if (estado === "enviada" || estado === "recibida") return "warning";
  return "neutral";
}
