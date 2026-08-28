import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";
import { Armchair, Circle, Plus, Receipt, Square, Table2 } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import {
  restauranteAreas,
  restauranteMesas,
  restauranteOrdenes,
  sucursales,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import {
  actualizarEstadoMesaRestauranteForm,
  crearAreaRestauranteForm,
  crearMesaRestauranteForm,
  crearOrdenRestauranteForm,
  marcarMesaLimpiaRestauranteForm,
  solicitarCuentaRestauranteForm,
} from "@/lib/actions/restaurante-vertical";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FormField } from "@/components/ui/FormField";
import { formatearMoneda } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Mesas Restaurante | ARCA",
  description: "Mapa operativo de salon, mesas y cuentas de restaurante en ARCA.",
};

const ESTADOS = [
  "disponible",
  "ocupada",
  "reservada",
  "por_limpiar",
  "cuenta_solicitada",
  "deshabilitada",
] as const;

type OrdenActivaMesa = {
  id: string;
  numero: string;
  mesaId: string | null;
  estado: string;
  personas: number;
  total: string;
};

export default async function RestauranteMesasPage() {
  const user = await requireSession();
  await requireModulo(user, "restaurante-mesas");
  const scope = await getSucursalScope(user);
  const visibles = selectedSucursalIds(scope);

  const [sucursalesList, areas, mesas, ordenesActivas] = await dbConEmpresa(user.empresaId, (tx) =>
    Promise.all([
      tx
        .select({ id: sucursales.id, nombre: sucursales.nombre })
        .from(sucursales)
        .where(
          and(
            eq(sucursales.empresaId, user.empresaId),
            visibles ? inArray(sucursales.id, visibles) : undefined,
          ),
        )
        .orderBy(asc(sucursales.nombre)),
      tx
        .select()
        .from(restauranteAreas)
        .where(
          and(
            eq(restauranteAreas.empresaId, user.empresaId),
            visibles ? inArray(restauranteAreas.sucursalId, visibles) : undefined,
          ),
        )
        .orderBy(asc(restauranteAreas.orden), asc(restauranteAreas.nombre)),
      tx
        .select()
        .from(restauranteMesas)
        .where(
          and(
            eq(restauranteMesas.empresaId, user.empresaId),
            visibles ? inArray(restauranteMesas.sucursalId, visibles) : undefined,
          ),
        )
        .orderBy(asc(restauranteMesas.nombre)),
      tx
        .select({
          id: restauranteOrdenes.id,
          numero: restauranteOrdenes.numero,
          mesaId: restauranteOrdenes.mesaId,
          estado: restauranteOrdenes.estado,
          personas: restauranteOrdenes.personas,
          total: restauranteOrdenes.total,
        })
        .from(restauranteOrdenes)
        .where(
          and(
            eq(restauranteOrdenes.empresaId, user.empresaId),
            inArray(restauranteOrdenes.estado, [
              "abierta",
              "borrador",
              "en_cocina",
              "cuenta_solicitada",
            ]),
            visibles ? inArray(restauranteOrdenes.sucursalId, visibles) : undefined,
          ),
        )
        .orderBy(asc(restauranteOrdenes.abiertoEn)),
    ]),
  );
  const sucursalDefault = sucursalesList[0];
  const areasPorId = new Map(areas.map((area) => [area.id, area]));
  const ordenActivaPorMesa = new Map<string, OrdenActivaMesa>();
  for (const orden of ordenesActivas) {
    if (orden.mesaId) ordenActivaPorMesa.set(orden.mesaId, orden);
  }
  const mesasSinArea = mesas.filter((mesa) => !mesa.areaId || !areasPorId.has(mesa.areaId));
  const gruposArea = [
    ...areas.map((area) => ({
      id: area.id,
      nombre: area.nombre,
      mesas: mesas.filter((mesa) => mesa.areaId === area.id),
    })),
    ...(mesasSinArea.length > 0
      ? [{ id: "sin-area", nombre: "Sin area", mesas: mesasSinArea }]
      : []),
  ].filter((grupo) => grupo.mesas.length > 0);
  const disponibles = mesas.filter(
    (mesa) => mesa.estado === "disponible" && !ordenActivaPorMesa.has(mesa.id),
  ).length;
  const ocupadas = mesas.filter(
    (mesa) => mesa.estado === "ocupada" || ordenActivaPorMesa.has(mesa.id),
  ).length;
  const reservadas = mesas.filter((mesa) => mesa.estado === "reservada").length;
  const requierenAtencion = mesas.filter((mesa) =>
    ["por_limpiar", "cuenta_solicitada"].includes(mesa.estado),
  ).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-label">{scope.visible ? scope.etiqueta : "Salon completo"}</p>
          <h1 className="mt-1 text-xl">Areas y mesas</h1>
          <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
            Plano operativo con estados de servicio y QR revocables por mesa.
          </p>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <MesaResumen label="Mesas" value={mesas.length} hint="Configuradas" tone="neutral" />
        <MesaResumen label="Disponibles" value={disponibles} hint="Listas para abrir orden" tone="success" />
        <MesaResumen label="Ocupadas" value={ocupadas + reservadas} hint={`${reservadas} reservadas`} tone="warning" />
        <MesaResumen label="Atencion" value={requierenAtencion} hint="Limpieza o cuenta" tone="info" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader title="Mapa por areas" subtitle={`${mesas.length} mesas configuradas`} />
          <CardBody>
            {mesas.length === 0 ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-md border border-dashed border-[color:var(--color-border)] text-center">
                <div>
                  <Table2 className="mx-auto text-[color:var(--color-text-muted)]" size={30} />
                  <p className="mt-3 text-small text-[color:var(--color-text-muted)]">
                    Crea areas y mesas para comenzar el plano.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-4">
                  {gruposArea.map((grupo) => {
                    const capacidad = grupo.mesas.reduce(
                      (total, mesa) => total + mesa.capacidad,
                      0,
                    );
                    return (
                      <section
                        key={grupo.id}
                        className="overflow-hidden rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
                      >
                        <div className="flex flex-col gap-1 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h2 className="text-base font-semibold">{grupo.nombre}</h2>
                            <p className="text-[12px] text-[color:var(--color-text-muted)]">
                              {grupo.mesas.length} mesas · {capacidad} pax
                            </p>
                          </div>
                          <Badge variant="neutral">
                            {grupo.mesas.filter((mesa) => mesa.estado === "disponible").length} disponibles
                          </Badge>
                        </div>
                        <div className="grid gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
                          {grupo.mesas.map((mesa) => (
                            <MesaCard
                              key={mesa.id}
                              mesa={mesa}
                              ordenActiva={ordenActivaPorMesa.get(mesa.id)}
                            />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Nueva area" />
            <CardBody>
              <form action={crearAreaRestauranteForm} className="space-y-3">
                <FormField label="Sucursal">
                  <select name="sucursalId" defaultValue={sucursalDefault?.id} className="arca-input">
                    {sucursalesList.map((sucursal) => (
                      <option key={sucursal.id} value={sucursal.id}>
                        {sucursal.nombre}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Nombre del area">
                  <input name="nombre" className="arca-input" />
                </FormField>
                <button type="submit" className="arca-btn arca-btn-primary w-full">
                  <Plus size={14} /> Crear area
                </button>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Nueva mesa" />
            <CardBody>
              <form action={crearMesaRestauranteForm} className="space-y-3">
                <FormField label="Sucursal">
                  <select name="sucursalId" defaultValue={sucursalDefault?.id} className="arca-input">
                    {sucursalesList.map((sucursal) => (
                      <option key={sucursal.id} value={sucursal.id}>
                        {sucursal.nombre}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Area">
                  <select name="areaId" defaultValue="" className="arca-input">
                    <option value="">Sin area</option>
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.nombre}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Nombre de mesa">
                  <input name="nombre" className="arca-input" />
                </FormField>
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Capacidad">
                    <input name="capacidad" defaultValue="4" className="arca-input" />
                  </FormField>
                  <FormField label="Forma">
                    <select name="forma" defaultValue="rectangular" className="arca-input">
                      <option value="rectangular">Rectangular</option>
                      <option value="redonda">Redonda</option>
                      <option value="cuadrada">Cuadrada</option>
                      <option value="barra">Barra</option>
                    </select>
                  </FormField>
                </div>
                <input type="hidden" name="posX" value="0.5" />
                <input type="hidden" name="posY" value="0.5" />
                <button type="submit" className="arca-btn arca-btn-primary w-full">
                  <Plus size={14} /> Crear mesa
                </button>
              </form>
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}

function MesaResumen({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "success" | "warning" | "info" | "neutral";
}) {
  return (
    <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      <Badge variant={tone}>{label}</Badge>
      <div className="mt-3 text-2xl font-semibold text-[color:var(--color-text-primary)]">
        {value}
      </div>
      <p className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">{hint}</p>
    </div>
  );
}

function MesaCard({
  mesa,
  ordenActiva,
}: {
  mesa: typeof restauranteMesas.$inferSelect;
  ordenActiva?: OrdenActivaMesa;
}) {
  const Icon = mesa.forma === "redonda" ? Circle : mesa.forma === "barra" ? Armchair : Square;
  const estadoOperativo = ordenActiva?.estado ?? mesa.estado;
  const puedeAbrir = mesa.estado === "disponible" && !ordenActiva;
  const puedeSolicitarCuenta =
    ordenActiva &&
    ordenActiva.estado !== "cuenta_solicitada" &&
    parseFloat(ordenActiva.total) > 0;
  const puedeMarcarLimpia = mesa.estado === "por_limpiar" && !ordenActiva;
  return (
    <article
      className={`min-h-[168px] rounded-md border bg-[color:var(--color-surface)] p-3 shadow-sm ${estadoBorde(
        estadoOperativo,
      )}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{mesa.nombre}</h3>
          <p className="text-[12px] text-[color:var(--color-text-muted)]">
            {mesa.capacidad} pax · {labelForma(mesa.forma)}
          </p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[color:var(--color-surface-2)] text-[color:var(--color-secondary)]">
          <Icon size={17} />
        </span>
      </div>
      <div className="mt-3">
        <Badge variant={variantEstado(estadoOperativo)}>{labelEstado(estadoOperativo)}</Badge>
      </div>
      {ordenActiva && (
        <div className="mt-3 rounded-md bg-[color:var(--color-surface-2)] px-3 py-2 text-[12px]">
          <div className="flex items-center justify-between gap-2 font-medium">
            <span>{ordenActiva.numero}</span>
            <span>{formatearMoneda(ordenActiva.total)}</span>
          </div>
          <div className="mt-1 text-[color:var(--color-text-muted)]">
            {ordenActiva.personas} personas
          </div>
        </div>
      )}

      <div className="mt-3 grid gap-2">
        {puedeAbrir && (
          <form action={crearOrdenRestauranteForm}>
            <input type="hidden" name="sucursalId" value={mesa.sucursalId} />
            <input type="hidden" name="mesaId" value={mesa.id} />
            <input type="hidden" name="canal" value="salon" />
            <input type="hidden" name="personas" value={mesa.capacidad} />
            <input type="hidden" name="idempotencyKey" value={randomUUID()} />
            <button type="submit" className="arca-btn arca-btn-primary arca-btn-sm w-full justify-center">
              <Plus size={14} /> Abrir orden
            </button>
          </form>
        )}
        {ordenActiva && (
          <div className="grid grid-cols-2 gap-2">
            <Link href="/restaurante/pos" className="arca-btn arca-btn-secondary arca-btn-sm justify-center">
              Ir al POS
            </Link>
            <form action={solicitarCuentaRestauranteForm}>
              <input type="hidden" name="ordenId" value={ordenActiva.id} />
              <button
                type="submit"
                disabled={!puedeSolicitarCuenta}
                className="arca-btn arca-btn-secondary arca-btn-sm w-full justify-center"
              >
                <Receipt size={14} />
                {ordenActiva.estado === "cuenta_solicitada" ? "Pedida" : "Cuenta"}
              </button>
            </form>
          </div>
        )}
        {puedeMarcarLimpia && (
          <form action={marcarMesaLimpiaRestauranteForm}>
            <input type="hidden" name="mesaId" value={mesa.id} />
            <button type="submit" className="arca-btn arca-btn-primary arca-btn-sm w-full justify-center">
              Marcar limpia
            </button>
          </form>
        )}
      </div>

      <details className="mt-3 rounded-md border border-[color:var(--color-border)] px-3 py-2">
        <summary className="cursor-pointer text-[12px] font-medium text-[color:var(--color-text-muted)]">
          Ajuste manual
        </summary>
        <form
          action={actualizarEstadoMesaRestauranteForm}
          className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
        >
          <input type="hidden" name="mesaId" value={mesa.id} />
          <FormField label="Estado">
            <select name="estado" defaultValue={mesa.estado} className="arca-input h-10 py-1 text-[12px]">
              {ESTADOS.map((estado) => (
                <option key={estado} value={estado}>
                  {labelEstado(estado)}
                </option>
              ))}
            </select>
          </FormField>
          <button type="submit" className="arca-btn arca-btn-secondary arca-btn-sm justify-center">
            Guardar
          </button>
        </form>
      </details>
    </article>
  );
}

function labelEstado(estado: string): string {
  const labels: Record<string, string> = {
    disponible: "Disponible",
    ocupada: "Ocupada",
    reservada: "Reservada",
    por_limpiar: "Por limpiar",
    cuenta_solicitada: "Cuenta solicitada",
    deshabilitada: "Deshabilitada",
    borrador: "Borrador",
    abierta: "Abierta",
    en_cocina: "En cocina",
  };
  return labels[estado] ?? estado;
}

function labelForma(forma: string): string {
  const labels: Record<string, string> = {
    rectangular: "Rectangular",
    redonda: "Redonda",
    cuadrada: "Cuadrada",
    barra: "Barra",
  };
  return labels[forma] ?? forma;
}

function variantEstado(estado: string): "success" | "warning" | "error" | "info" | "neutral" {
  if (estado === "disponible") return "success";
  if (estado === "ocupada" || estado === "reservada") return "warning";
  if (estado === "por_limpiar") return "error";
  if (estado === "cuenta_solicitada" || estado === "en_cocina") return "info";
  return "neutral";
}

function estadoBorde(estado: string): string {
  if (estado === "disponible") return "border-[color:var(--color-success)]/35";
  if (estado === "ocupada" || estado === "abierta" || estado === "borrador") {
    return "border-[color:var(--color-warning)]/45";
  }
  if (estado === "reservada") return "border-[color:var(--color-warning)]/35";
  if (estado === "por_limpiar") return "border-[color:var(--color-error)]/35";
  if (estado === "cuenta_solicitada" || estado === "en_cocina") {
    return "border-[color:var(--color-info)]/35";
  }
  return "border-[color:var(--color-border)]";
}
