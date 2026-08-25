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
                <select name="sucursalId" defaultValue={sucursalDefault?.id} className="arca-input">
                  {sucursalesList.map((sucursal) => (
                    <option key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </option>
                  ))}
                </select>
                <select name="mesaId" defaultValue="" className="arca-input">
                  <option value="">Mesa sugerida despues</option>
                  {mesas.map((mesa) => (
                    <option key={mesa.id} value={mesa.id}>
                      {mesa.nombre}
                    </option>
                  ))}
                </select>
                <input name="nombre" placeholder="Nombre" className="arca-input" />
                <div className="grid grid-cols-2 gap-2">
                  <input name="telefono" placeholder="Telefono" className="arca-input" />
                  <input name="email" placeholder="Email" className="arca-input" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input name="fecha" type="date" className="arca-input" />
                  <input name="hora" type="time" className="arca-input" />
                  <input name="personas" placeholder="Pax" className="arca-input" />
                </div>
                <input name="ocasionEspecial" placeholder="Ocasion especial" className="arca-input" />
                <textarea name="notas" placeholder="Notas" className="arca-input min-h-20" />
                <button type="submit" className="arca-btn arca-btn-primary w-full">
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
                <select name="sucursalId" defaultValue={sucursalDefault?.id} className="arca-input">
                  {sucursalesList.map((sucursal) => (
                    <option key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </option>
                  ))}
                </select>
                <input name="nombreEspera" placeholder="Nombre" className="arca-input" />
                <div className="grid grid-cols-2 gap-2">
                  <input name="telefonoEspera" placeholder="Telefono" className="arca-input" />
                  <input name="personasEspera" placeholder="Pax" className="arca-input" />
                </div>
                <input name="esperaEstimadaMin" placeholder="Espera min" className="arca-input" />
                <input name="preferencia" placeholder="Preferencia" className="arca-input" />
                <textarea name="notasEspera" placeholder="Notas" className="arca-input min-h-20" />
                <button type="submit" className="arca-btn arca-btn-secondary w-full">
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
                reservaciones.map((reserva) => (
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
                        {reserva.estado}
                      </Badge>
                    </div>
                    {reserva.notas && (
                      <p className="mt-2 text-small text-[color:var(--color-text-muted)]">{reserva.notas}</p>
                    )}
                  </div>
                ))
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
                      {row.estado}
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
