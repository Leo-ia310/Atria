import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { CalendarDays, Clock, UserPlus, UsersRound } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import {
  restauranteListaEspera,
  restauranteMesas,
  restauranteReservaciones,
  sucursales,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { getSucursalScope, selectedSucursalIds } from "@/lib/sucursal-scope";
import {
  crearListaEsperaRestauranteForm,
  crearReservacionRestauranteForm,
} from "@/lib/actions/restaurante-vertical";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FormField } from "@/components/ui/FormField";
import { notaRestauranteVisible } from "@/lib/restaurante/display";

export default async function RestauranteReservacionesPage() {
  const user = await requireSession();
  await requireModulo(user, "restaurante-reservaciones");
  const scope = await getSucursalScope(user);
  const visibles = selectedSucursalIds(scope);

  const [sucursalesList, mesas, reservaciones, espera] = await dbConEmpresa(
    user.empresaId,
    (tx) =>
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
          .select({ id: restauranteMesas.id, nombre: restauranteMesas.nombre })
          .from(restauranteMesas)
          .where(
            and(
              eq(restauranteMesas.empresaId, user.empresaId),
              visibles ? inArray(restauranteMesas.sucursalId, visibles) : undefined,
            ),
          )
          .orderBy(asc(restauranteMesas.nombre)),
        tx
          .select()
          .from(restauranteReservaciones)
          .where(
            and(
              eq(restauranteReservaciones.empresaId, user.empresaId),
              visibles ? inArray(restauranteReservaciones.sucursalId, visibles) : undefined,
            ),
          )
          .orderBy(desc(restauranteReservaciones.fecha), asc(restauranteReservaciones.hora))
          .limit(80),
        tx
          .select()
          .from(restauranteListaEspera)
          .where(
            and(
              eq(restauranteListaEspera.empresaId, user.empresaId),
              inArray(restauranteListaEspera.estado, ["esperando", "notificado"]),
              visibles ? inArray(restauranteListaEspera.sucursalId, visibles) : undefined,
            ),
          )
          .orderBy(asc(restauranteListaEspera.llegadaEn))
          .limit(60),
      ]),
  );
  const sucursalDefault = sucursalesList[0];
  const tieneSucursales = sucursalesList.length > 0;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-label">{scope.visible ? scope.etiqueta : "Recepcion"}</p>
        <h1 className="mt-1 text-xl">Reservaciones y lista de espera</h1>
        <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
          Asigna mesas, registra llegadas y prepara recordatorios futuros.
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <CalendarDays size={16} /> Nueva reservacion
                </span>
              }
            />
            <CardBody>
              <form action={crearReservacionRestauranteForm} className="space-y-3">
                <FormField label="Sucursal">
                  <select
                    name="sucursalId"
                    defaultValue={sucursalDefault?.id}
                    disabled={!tieneSucursales}
                    className="arca-input"
                  >
                    {sucursalesList.map((sucursal) => (
                      <option key={sucursal.id} value={sucursal.id}>
                        {sucursal.nombre}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Mesa">
                  <select name="mesaId" defaultValue="" className="arca-input">
                    <option value="">Mesa sugerida despues</option>
                    {mesas.map((mesa) => (
                      <option key={mesa.id} value={mesa.id}>
                        {mesa.nombre}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Nombre del cliente">
                  <input name="nombre" className="arca-input" />
                </FormField>
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Telefono">
                    <input name="telefono" className="arca-input" />
                  </FormField>
                  <FormField label="Email">
                    <input name="email" className="arca-input" />
                  </FormField>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <FormField label="Fecha">
                    <input name="fecha" type="date" className="arca-input" />
                  </FormField>
                  <FormField label="Hora">
                    <input name="hora" type="time" className="arca-input" />
                  </FormField>
                  <FormField label="Personas">
                    <input name="personas" className="arca-input" />
                  </FormField>
                </div>
                <FormField label="Ocasion especial">
                  <input name="ocasionEspecial" className="arca-input" />
                </FormField>
                <FormField label="Notas">
                  <textarea name="notas" className="arca-input min-h-20" />
                </FormField>
                {!tieneSucursales && (
                  <p className="text-[12px] text-[color:var(--color-warning)]">
                    Crea una sucursal antes de registrar reservaciones.
                  </p>
                )}
                <button type="submit" disabled={!tieneSucursales} className="arca-btn arca-btn-primary w-full">
                  Crear reservacion
                </button>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <UserPlus size={16} /> Lista de espera
                </span>
              }
            />
            <CardBody>
              <form action={crearListaEsperaRestauranteForm} className="space-y-3">
                <FormField label="Sucursal">
                  <select
                    name="sucursalId"
                    defaultValue={sucursalDefault?.id}
                    disabled={!tieneSucursales}
                    className="arca-input"
                  >
                    {sucursalesList.map((sucursal) => (
                      <option key={sucursal.id} value={sucursal.id}>
                        {sucursal.nombre}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Nombre del cliente">
                  <input name="nombreEspera" className="arca-input" />
                </FormField>
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Telefono">
                    <input name="telefonoEspera" className="arca-input" />
                  </FormField>
                  <FormField label="Personas">
                    <input name="personasEspera" className="arca-input" />
                  </FormField>
                </div>
                <FormField label="Espera estimada">
                  <input name="esperaEstimadaMin" className="arca-input" />
                </FormField>
                <FormField label="Preferencia">
                  <input name="preferencia" className="arca-input" />
                </FormField>
                <FormField label="Notas">
                  <textarea name="notasEspera" className="arca-input min-h-20" />
                </FormField>
                <button type="submit" disabled={!tieneSucursales} className="arca-btn arca-btn-secondary w-full">
                  Agregar a espera
                </button>
              </form>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Proximas reservaciones" />
            <CardBody className="space-y-2">
              {reservaciones.length === 0 ? (
                <p className="py-8 text-center text-small text-[color:var(--color-text-muted)]">
                  Sin reservaciones.
                </p>
              ) : (
                reservaciones.map((reserva) => {
                  const nota = notaRestauranteVisible(reserva.notas);
                  return (
                    <div key={reserva.id} className="rounded-md bg-[color:var(--color-surface-2)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{reserva.nombre}</div>
                          <div className="mt-1 flex flex-wrap gap-2 text-[12px] text-[color:var(--color-text-muted)]">
                            <span className="inline-flex items-center gap-1">
                              <Clock size={12} /> {reserva.fecha} {reserva.hora}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <UsersRound size={12} /> {reserva.personas} pax
                            </span>
                          </div>
                        </div>
                        <Badge variant={reserva.estado === "confirmada" ? "success" : "warning"}>
                          {labelReservaEstado(reserva.estado)}
                        </Badge>
                      </div>
                      {nota && <p className="mt-2 text-small text-[color:var(--color-text-muted)]">{nota}</p>}
                    </div>
                  );
                })
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Esperando mesa" />
            <CardBody className="space-y-2">
              {espera.length === 0 ? (
                <p className="py-8 text-center text-small text-[color:var(--color-text-muted)]">
                  Lista vacia.
                </p>
              ) : (
                espera.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 rounded-md bg-[color:var(--color-surface-2)] p-3 text-small">
                    <div>
                      <div className="font-medium">{row.nombre}</div>
                      <div className="text-[12px] text-[color:var(--color-text-muted)]">
                        {row.personas} pax · {row.esperaEstimadaMin ?? 0} min estimados
                      </div>
                    </div>
                    <Badge variant={row.estado === "notificado" ? "info" : "warning"}>
                      {labelEsperaEstado(row.estado)}
                    </Badge>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}

function labelReservaEstado(estado: string): string {
  const labels: Record<string, string> = {
    pendiente: "Pendiente",
    confirmada: "Confirmada",
    sentada: "Sentada",
    cancelada: "Cancelada",
    no_show: "No asistio",
  };
  return labels[estado] ?? estado;
}

function labelEsperaEstado(estado: string): string {
  const labels: Record<string, string> = {
    esperando: "Esperando",
    notificado: "Notificado",
    sentado: "Sentado",
    cancelado: "Cancelado",
  };
  return labels[estado] ?? estado;
}
