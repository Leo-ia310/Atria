import Link from "next/link";
import type { Metadata } from "next";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { ChefHat, Clock, Table2, UserRound } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import {
  restauranteComandaItems,
  restauranteComandas,
  restauranteEstaciones,
  restauranteMesas,
  restauranteOrdenes,
  usuarios,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import { actualizarEstadoComandaRestauranteForm } from "@/lib/actions/restaurante-vertical";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { notaRestauranteVisible } from "@/lib/restaurante/display";
import { cn, formatearFechaHora } from "@/lib/utils";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import type { PaisCodigo } from "@/lib/paises";

export const metadata: Metadata = {
  title: "KDS | ARCA Restaurante",
  description: "Pantalla de cocina con comandas activas, filtros por estacion e historial de preparacion.",
};

type EstadoComanda = (typeof restauranteComandas.estado.enumValues)[number];

type PageProps = {
  searchParams?: Promise<{
    tab?: string;
    estado?: string;
    estacionId?: string;
    mesa?: string;
  }>;
};

export default async function RestauranteKdsPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const tab = params.tab === "historial" ? "historial" : "activas";
  const user = await requireSession();
  await requireModulo(user, "restaurante-kds");
  const [scope, empresa] = await Promise.all([
    getSucursalScope(user),
    getEmpresaMetadata(user.empresaId),
  ]);
  const visibles = selectedSucursalIds(scope);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const estados: EstadoComanda[] =
    tab === "historial"
      ? ["entregada", "cancelada"]
      : ["enviada", "recibida", "preparando", "lista"];
  const estadoFiltro = estados.find((estado) => estado === params.estado);

  const [estaciones, comandas] = await dbConEmpresa(user.empresaId, (tx) =>
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
          recibidaEn: restauranteComandas.recibidaEn,
          preparandoEn: restauranteComandas.preparandoEn,
          listaEn: restauranteComandas.listaEn,
          entregadaEn: restauranteComandas.entregadaEn,
          canceladaEn: restauranteComandas.canceladaEn,
          responsable: usuarios.nombre,
        })
        .from(restauranteComandas)
        .innerJoin(restauranteOrdenes, eq(restauranteOrdenes.id, restauranteComandas.ordenId))
        .leftJoin(restauranteMesas, eq(restauranteMesas.id, restauranteOrdenes.mesaId))
        .leftJoin(usuarios, eq(usuarios.id, restauranteComandas.enviadaPor))
        .where(
          and(
            eq(restauranteComandas.empresaId, user.empresaId),
            inArray(restauranteComandas.estado, estados),
            params.estacionId ? eq(restauranteComandas.estacionId, params.estacionId) : undefined,
            estadoFiltro ? eq(restauranteComandas.estado, estadoFiltro) : undefined,
            params.mesa ? eq(restauranteMesas.nombre, params.mesa) : undefined,
            visibles ? inArray(restauranteComandas.sucursalId, visibles) : undefined,
          ),
        )
        .orderBy(
          tab === "historial" ? desc(restauranteComandas.actualizadoEn) : desc(restauranteComandas.prioridad),
          tab === "historial" ? desc(restauranteComandas.enviadaEn) : asc(restauranteComandas.enviadaEn),
        )
        .limit(tab === "historial" ? 160 : 80),
    ]),
  );
  const comandaIds = comandas.map((comanda) => comanda.id);
  const items =
    comandaIds.length > 0
      ? await dbConEmpresa(user.empresaId, (tx) =>
          tx
            .select()
            .from(restauranteComandaItems)
            .where(
              and(
                eq(restauranteComandaItems.empresaId, user.empresaId),
                inArray(restauranteComandaItems.comandaId, comandaIds),
              ),
            )
            .orderBy(asc(restauranteComandaItems.creadoEn)),
        )
      : [];

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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-1">
          <Link
            href="/restaurante/kds"
            className={cn("rounded px-3 py-1.5 text-small font-medium", tab === "activas" && "bg-[color:var(--color-primary)] text-white")}
          >
            Activas
          </Link>
          <Link
            href="/restaurante/kds?tab=historial"
            className={cn("rounded px-3 py-1.5 text-small font-medium", tab === "historial" && "bg-[color:var(--color-primary)] text-white")}
          >
            Historial
          </Link>
        </div>
        {tab === "historial" && (
          <form className="flex flex-wrap gap-2" action="/restaurante/kds">
            <input type="hidden" name="tab" value="historial" />
            <select name="estacionId" aria-label="Filtrar por estacion" defaultValue={params.estacionId ?? ""} className="arca-input h-9 w-44">
              <option value="">Todas las estaciones</option>
              {estaciones.map((estacion) => (
                <option key={estacion.id} value={estacion.id}>
                  {estacion.nombre}
                </option>
              ))}
            </select>
            <select name="estado" aria-label="Filtrar por estado" defaultValue={params.estado ?? ""} className="arca-input h-9 w-36">
              <option value="">Estado</option>
              <option value="entregada">Entregada</option>
              <option value="cancelada">Cancelada</option>
            </select>
            <input name="mesa" aria-label="Filtrar por mesa" defaultValue={params.mesa ?? ""} placeholder="Mesa" className="arca-input h-9 w-32" />
            <button type="submit" className="arca-btn arca-btn-secondary arca-btn-sm">
              Filtrar
            </button>
          </form>
        )}
      </div>

      {comandas.length === 0 ? (
        <Card>
          <CardBody>
            <div className="py-12 text-center text-small text-[color:var(--color-text-muted)]">
              {tab === "historial" ? "No hay comandas terminadas con esos filtros." : "No hay comandas activas."}
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
                            {(itemsPorComanda.get(comanda.id) ?? []).map((item) => {
                              const notaCocina = notaRestauranteVisible(item.notasCocina);
                              return (
                                <div key={item.id} className="rounded-md bg-[color:var(--color-surface-2)] px-3 py-2">
                                  <div className="flex items-center justify-between gap-3 text-small">
                                    <span className="font-medium">{item.nombreSnapshot}</span>
                                    <span>x{parseFloat(item.cantidad).toFixed(0)}</span>
                                  </div>
                                  {notaCocina && (
                                    <div className="mt-1 text-[12px] text-[color:var(--color-warning)]">
                                      {notaCocina}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {tab === "historial" ? (
                            <div className="grid gap-2 rounded-md bg-[color:var(--color-surface-2)] p-3 text-[12px] sm:grid-cols-2">
                              <Dato label="Enviada" value={formatearFechaHora(comanda.enviadaEn, pais, empresa?.zonaHoraria)} />
                              <Dato label="Iniciada" value={comanda.preparandoEn ? formatearFechaHora(comanda.preparandoEn, pais, empresa?.zonaHoraria) : "Sin iniciar"} />
                              <Dato label="Terminada" value={fechaFinal(comanda) ? formatearFechaHora(fechaFinal(comanda)!, pais, empresa?.zonaHoraria) : "Sin cierre"} />
                              <Dato label="Tiempo" value={`${minutosPreparacion(comanda.enviadaEn, fechaFinal(comanda))} min`} />
                              <Dato label="Responsable" value={comanda.responsable ?? "Sin asignar"} />
                              <Dato label="Estado final" value={labelEstado(comanda.estado)} />
                            </div>
                          ) : (
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
                          )}
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

function fechaFinal(comanda: {
  entregadaEn: Date | null;
  canceladaEn: Date | null;
  listaEn: Date | null;
}) {
  return comanda.entregadaEn ?? comanda.canceladaEn ?? comanda.listaEn;
}

function minutosPreparacion(inicio: Date, fin: Date | null): number {
  const cierre = fin ?? new Date();
  return Math.max(0, Math.round((cierre.getTime() - inicio.getTime()) / 60000));
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-medium text-[color:var(--color-text-primary)]">{value}</div>
      <div className="text-[11px] text-[color:var(--color-text-muted)]">{label}</div>
    </div>
  );
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
