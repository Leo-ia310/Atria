import { asc, desc, eq } from "drizzle-orm";
import { Gift, Plus } from "lucide-react";
import { dbConEmpresa } from "@/lib/db";
import { categorias, productos, restaurantePromociones } from "@/lib/db/schema";
import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { crearPromocionRestauranteForm } from "@/lib/actions/restaurante-vertical";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const DIAS = [
  ["0", "Dom"],
  ["1", "Lun"],
  ["2", "Mar"],
  ["3", "Mie"],
  ["4", "Jue"],
  ["5", "Vie"],
  ["6", "Sab"],
] as const;

export default async function RestaurantePromocionesPage() {
  const user = await requireSession();
  await requireModulo(user, "restaurante-promociones");
  const [promos, productosList, categoriasList] = await dbConEmpresa(user.empresaId, (tx) =>
    Promise.all([
      tx
        .select()
        .from(restaurantePromociones)
        .where(eq(restaurantePromociones.empresaId, user.empresaId))
        .orderBy(desc(restaurantePromociones.creadoEn))
        .limit(80),
      tx
        .select({ id: productos.id, nombre: productos.nombre })
        .from(productos)
        .where(eq(productos.empresaId, user.empresaId))
        .orderBy(asc(productos.nombre))
        .limit(500),
      tx
        .select({ id: categorias.id, nombre: categorias.nombre })
        .from(categorias)
        .where(eq(categorias.empresaId, user.empresaId))
        .orderBy(asc(categorias.nombre)),
    ]),
  );

  return (
    <div className="space-y-5">
      <header>
        <p className="text-label">Descuentos server-side</p>
        <h1 className="mt-1 text-xl">Promociones</h1>
        <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
          Reglas por horario, dia, producto o categoria.
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Gift size={16} /> Nueva promocion
              </span>
            }
          />
          <CardBody>
            <form action={crearPromocionRestauranteForm} className="space-y-3">
              <input name="nombre" placeholder="Happy Hour bebidas" className="arca-input" />
              <textarea name="descripcion" placeholder="Descripcion" className="arca-input min-h-20" />
              <div className="grid grid-cols-2 gap-2">
                <select name="tipo" defaultValue="porcentaje" className="arca-input">
                  <option value="porcentaje">Porcentaje</option>
                  <option value="monto">Monto</option>
                  <option value="precio_fijo">Precio fijo</option>
                  <option value="dos_por_uno">2x1</option>
                </select>
                <input name="valor" placeholder="20" className="arca-input" />
              </div>
              <select name="productoId" defaultValue="" className="arca-input">
                <option value="">Todos los productos</option>
                {productosList.map((producto) => (
                  <option key={producto.id} value={producto.id}>
                    {producto.nombre}
                  </option>
                ))}
              </select>
              <select name="categoriaId" defaultValue="" className="arca-input">
                <option value="">Todas las categorias</option>
                {categoriasList.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nombre}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-4 gap-2">
                {DIAS.map(([valor, label]) => (
                  <label key={valor} className="flex items-center gap-1 rounded-md bg-[color:var(--color-surface-2)] px-2 py-2 text-[12px]">
                    <input type="checkbox" name="diasSemana" value={valor} />
                    {label}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input name="horaInicio" type="time" className="arca-input" />
                <input name="horaFin" type="time" className="arca-input" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input name="fechaInicio" type="date" className="arca-input" />
                <input name="fechaFin" type="date" className="arca-input" />
              </div>
              <label className="flex items-center gap-2 text-small">
                <input type="checkbox" name="activa" defaultChecked />
                Activa
              </label>
              <button type="submit" className="arca-btn arca-btn-primary w-full">
                <Plus size={14} /> Crear promocion
              </button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Reglas configuradas" subtitle={`${promos.length} promociones`} />
          <CardBody className="space-y-3">
            {promos.length === 0 ? (
              <div className="py-10 text-center text-small text-[color:var(--color-text-muted)]">
                No hay promociones configuradas.
              </div>
            ) : (
              promos.map((promo) => (
                <div key={promo.id} className="rounded-md bg-[color:var(--color-surface-2)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{promo.nombre}</div>
                      <div className="text-[12px] text-[color:var(--color-text-muted)]">
                        {promo.tipo} · valor {promo.valor}
                      </div>
                    </div>
                    <Badge variant={promo.activa ? "success" : "neutral"}>
                      {promo.activa ? "Activa" : "Inactiva"}
                    </Badge>
                  </div>
                  {promo.descripcion && (
                    <p className="mt-2 text-small text-[color:var(--color-text-muted)]">
                      {promo.descripcion}
                    </p>
                  )}
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
