import { desc, eq } from "drizzle-orm";
import { Cake, Mail, Phone, Plus, ShieldAlert, UsersRound } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import { restauranteComensales } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { guardarComensalRestauranteForm } from "@/lib/actions/restaurante-vertical";
import { getEmpresaMetadata } from "@/lib/tenant-data";
import { formatearFechaHora, formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FormField } from "@/components/ui/FormField";

export default async function RestauranteComensalesPage() {
  const user = await requireSession();
  await requireModulo(user, "restaurante-comensales");
  const empresa = await getEmpresaMetadata(user.empresaId);
  const pais = (empresa?.pais ?? "NI") as PaisCodigo;
  const rows = await dbConEmpresa(user.empresaId, (tx) =>
    tx
      .select()
      .from(restauranteComensales)
      .where(eq(restauranteComensales.empresaId, user.empresaId))
      .orderBy(desc(restauranteComensales.ultimaVisitaEn))
      .limit(120),
  );

  return (
    <div className="space-y-5">
      <header>
        <p className="text-label">CRM restaurante</p>
        <h1 className="mt-1 text-xl">Comensales</h1>
        <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
          Perfiles creados por captura voluntaria, reservaciones o consumo.
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader title="Nuevo comensal" subtitle="Captura manual desde recepcion o salon" />
          <CardBody>
            <form action={guardarComensalRestauranteForm} className="space-y-3">
              <FormField label="Nombre">
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
              <FormField label="Cumpleanos">
                <input name="cumpleanos" type="date" className="arca-input" />
              </FormField>
              <FormField label="Preferencias">
                <input name="preferencias" className="arca-input" />
              </FormField>
              <FormField label="Alergias">
                <input name="alergias" className="arca-input" />
              </FormField>
              <FormField label="Ocasiones especiales">
                <input name="ocasionesEspeciales" className="arca-input" />
              </FormField>
              <FormField label="Notas internas">
                <textarea name="notas" className="arca-input min-h-20" />
              </FormField>
              <button type="submit" className="arca-btn arca-btn-primary w-full">
                <Plus size={14} /> Guardar comensal
              </button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Perfiles" subtitle={`${rows.length} comensales recientes`} />
          <CardBody>
            {rows.length === 0 ? (
              <div className="py-12 text-center">
                <UsersRound className="mx-auto text-[color:var(--color-text-muted)]" size={30} />
                <p className="mt-3 text-small text-[color:var(--color-text-muted)]">
                  Los comensales apareceran cuando uses el QR, hagas reservaciones o los captures aqui.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {rows.map((row) => (
                  <article key={row.id} className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold">{row.nombre}</h2>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[color:var(--color-text-muted)]">
                          {row.telefono && (
                            <span className="inline-flex items-center gap-1">
                              <Phone size={12} /> {row.telefono}
                            </span>
                          )}
                          {row.email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail size={12} /> {row.email}
                            </span>
                          )}
                          {row.cumpleanos && (
                            <span className="inline-flex items-center gap-1">
                              <Cake size={12} /> {row.cumpleanos}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge variant="info">{row.visitas} visitas</Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-small">
                      <Dato label="Gasto historico" value={formatearMoneda(row.gastoHistorico, pais)} />
                      <Dato label="Ticket promedio" value={formatearMoneda(row.ticketPromedio, pais)} />
                    </div>

                    {(row.preferencias || row.ocasionesEspeciales) && (
                      <div className="mt-3 space-y-1 text-small text-[color:var(--color-text-muted)]">
                        {row.preferencias && <p>Preferencias: {row.preferencias}</p>}
                        {row.ocasionesEspeciales && <p>Ocasiones: {row.ocasionesEspeciales}</p>}
                      </div>
                    )}

                    {row.alergias && (
                      <div className="mt-3 rounded-md bg-[color:var(--color-error-bg)] px-3 py-2 text-small text-[color:var(--color-error)]">
                        <span className="inline-flex items-center gap-2 font-semibold">
                          <ShieldAlert size={14} /> Alergias declaradas
                        </span>
                        <p className="mt-1">{row.alergias}</p>
                      </div>
                    )}

                    <div className="mt-3 text-[12px] text-[color:var(--color-text-muted)]">
                      Ultima visita:{" "}
                      {row.ultimaVisitaEn
                        ? formatearFechaHora(row.ultimaVisitaEn, pais, empresa?.zonaHoraria)
                        : "-"}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[color:var(--color-surface-2)] p-3">
      <div className="text-label">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
