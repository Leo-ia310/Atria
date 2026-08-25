import { and, asc, eq, inArray } from "drizzle-orm";
import { Armchair, Circle, Plus, Square, Table2 } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import {
  restauranteAreas,
  restauranteMesas,
  sucursales,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import {
  actualizarEstadoMesaRestauranteForm,
  crearAreaRestauranteForm,
  crearMesaRestauranteForm,
} from "@/lib/actions/restaurante-vertical";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const ESTADOS = [
  "disponible",
  "ocupada",
  "reservada",
  "por_limpiar",
  "cuenta_solicitada",
  "deshabilitada",
] as const;

export default async function RestauranteMesasPage() {
  const user = await requireSession();
  await requireModulo(user, "restaurante-mesas");
  const scope = await getSucursalScope(user);
  const visibles = selectedSucursalIds(scope);

  const [sucursalesList, areas, mesas] = await dbConEmpresa(user.empresaId, (tx) =>
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
    ]),
  );
  const sucursalDefault = sucursalesList[0];
  const areasPorId = new Map(areas.map((area) => [area.id, area]));

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

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader title="Plano de mesas" subtitle={`${mesas.length} mesas configuradas`} />
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
              <div className="relative min-h-[520px] overflow-hidden rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:48px_48px] opacity-40" />
                {mesas.map((mesa) => {
                  const area = mesa.areaId ? areasPorId.get(mesa.areaId) : null;
                  const Icon = mesa.forma === "redonda" ? Circle : mesa.forma === "barra" ? Armchair : Square;
                  return (
                    <div
                      key={mesa.id}
                      className="absolute min-h-20 min-w-28 rounded-md border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] p-3 shadow-sm"
                      style={{
                        left: `${parseFloat(mesa.posX) * 100}%`,
                        top: `${parseFloat(mesa.posY) * 100}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-small font-semibold">{mesa.nombre}</div>
                          <div className="text-[11px] text-[color:var(--color-text-muted)]">
                            {area?.nombre ?? "Sin area"} · {mesa.capacidad} pax
                          </div>
                        </div>
                        <Icon size={16} className="shrink-0 text-[color:var(--color-secondary)]" />
                      </div>
                      <div className="mt-2">
                        <Badge variant={variantEstado(mesa.estado)}>{labelEstado(mesa.estado)}</Badge>
                      </div>
                      <form action={actualizarEstadoMesaRestauranteForm} className="mt-2">
                        <input type="hidden" name="mesaId" value={mesa.id} />
                        <select name="estado" defaultValue={mesa.estado} className="arca-input py-1 text-[12px]">
                          {ESTADOS.map((estado) => (
                            <option key={estado} value={estado}>
                              {labelEstado(estado)}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="arca-btn arca-btn-secondary arca-btn-sm mt-2 w-full">
                          Cambiar
                        </button>
                      </form>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Nueva area" />
            <CardBody>
              <form action={crearAreaRestauranteForm} className="space-y-3">
                <select name="sucursalId" defaultValue={sucursalDefault?.id} className="arca-input">
                  {sucursalesList.map((sucursal) => (
                    <option key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </option>
                  ))}
                </select>
                <input name="nombre" placeholder="Terraza" className="arca-input" />
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
                <select name="sucursalId" defaultValue={sucursalDefault?.id} className="arca-input">
                  {sucursalesList.map((sucursal) => (
                    <option key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </option>
                  ))}
                </select>
                <select name="areaId" defaultValue="" className="arca-input">
                  <option value="">Sin area</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.nombre}
                    </option>
                  ))}
                </select>
                <input name="nombre" placeholder="Mesa 7" className="arca-input" />
                <div className="grid grid-cols-2 gap-2">
                  <input name="capacidad" placeholder="4" defaultValue="4" className="arca-input" />
                  <select name="forma" defaultValue="rectangular" className="arca-input">
                    <option value="rectangular">Rectangular</option>
                    <option value="redonda">Redonda</option>
                    <option value="cuadrada">Cuadrada</option>
                    <option value="barra">Barra</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input name="posX" placeholder="0.5" defaultValue="0.5" className="arca-input" />
                  <input name="posY" placeholder="0.5" defaultValue="0.5" className="arca-input" />
                </div>
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

function labelEstado(estado: string): string {
  const labels: Record<string, string> = {
    disponible: "Disponible",
    ocupada: "Ocupada",
    reservada: "Reservada",
    por_limpiar: "Por limpiar",
    cuenta_solicitada: "Cuenta solicitada",
    deshabilitada: "Deshabilitada",
  };
  return labels[estado] ?? estado;
}

function variantEstado(estado: string): "success" | "warning" | "error" | "info" | "neutral" {
  if (estado === "disponible") return "success";
  if (estado === "ocupada" || estado === "reservada") return "warning";
  if (estado === "por_limpiar") return "error";
  if (estado === "cuenta_solicitada") return "info";
  return "neutral";
}
