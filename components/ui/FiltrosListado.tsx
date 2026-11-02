import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import {
  hasListFilters,
  LIST_PAGE_SIZE,
  listPageHref,
  type ListFilters,
  type ListKind,
} from "@/lib/list-filters";

export function FiltrosListado({
  kind,
  path,
  value,
}: {
  kind: ListKind;
  path: string;
  value: ListFilters;
}) {
  const active = hasListFilters({ ...value, q: "" });
  return (
    <form method="get" action={path} className="arca-card mb-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-label" htmlFor={`${kind}-q`}>
          Buscar
          <div className="relative mt-1.5">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)]"
            />
            <input
              id={`${kind}-q`}
              name="q"
              type="search"
              defaultValue={value.q}
              maxLength={160}
              placeholder={
                kind === "compras"
                  ? "Factura o proveedor"
                  : "Nombre, identificación, teléfono o correo"
              }
              className="arca-input"
              style={{ paddingLeft: "2.5rem" }}
            />
          </div>
        </label>
        <button type="submit" className="arca-btn arca-btn-primary">
          Buscar
        </button>
        {hasListFilters(value) && (
          <Link href={path} className="arca-btn arca-btn-secondary">
            Limpiar
          </Link>
        )}
      </div>
      <details className="mt-3" open={active || undefined}>
        <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-md border border-[color:var(--color-border)] px-3 py-2 text-small">
          <SlidersHorizontal size={15} />
          Filtros{active ? " · activos" : ""}
        </summary>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          {kind === "clientes" && (
            <label className="text-label">
              Tipo de cliente
              <select
                name="tipo"
                defaultValue={value.tipo}
                className="arca-input mt-1.5"
              >
                <option value="">Todos</option>
                <option value="registrado">Registrado</option>
                <option value="consumidor">Consumidor final</option>
              </select>
            </label>
          )}
          <label className="text-label">
            Crédito
            <select
              name="credito"
              defaultValue={value.credito}
              className="arca-input mt-1.5"
            >
              <option value="">Todos</option>
              <option value="contado">Contado</option>
              <option value="credito">Con crédito</option>
            </select>
          </label>
          <label className="text-label">
            Estado
            <select
              name="estado"
              defaultValue={value.estado}
              className="arca-input mt-1.5"
            >
              <option value="">Todos</option>
              {kind === "compras" ? (
                <>
                  <option value="borrador">Borrador</option>
                  <option value="recibida">Recibida</option>
                  <option value="parcial">Parcial</option>
                  <option value="anulada">Anulada</option>
                </>
              ) : (
                <>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </>
              )}
            </select>
          </label>
          {kind === "compras" && (
            <>
              <label className="text-label">
                Desde
                <input
                  type="date"
                  name="desde"
                  defaultValue={value.desde}
                  className="arca-input mt-1.5"
                />
              </label>
              <label className="text-label">
                Hasta
                <input
                  type="date"
                  name="hasta"
                  defaultValue={value.hasta}
                  className="arca-input mt-1.5"
                />
              </label>
              <label className="text-label">
                Total mínimo
                <input
                  type="number"
                  name="minimo"
                  min="0"
                  step="0.0001"
                  defaultValue={value.minimo}
                  className="arca-input mt-1.5 w-36"
                />
              </label>
              <label className="text-label">
                Total máximo
                <input
                  type="number"
                  name="maximo"
                  min="0"
                  step="0.0001"
                  defaultValue={value.maximo}
                  className="arca-input mt-1.5 w-36"
                />
              </label>
            </>
          )}
          <button type="submit" className="arca-btn arca-btn-primary">
            Aplicar filtros
          </button>
        </div>
      </details>
    </form>
  );
}

export function PaginacionListado({
  path,
  value,
  total,
}: {
  path: string;
  value: ListFilters;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  return (
    <nav
      aria-label="Paginación"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-small text-[color:var(--color-text-muted)]"
    >
      <span>
        {total === 0
          ? "0 resultados"
          : `${(value.pagina - 1) * LIST_PAGE_SIZE + 1}–${Math.min(value.pagina * LIST_PAGE_SIZE, total)} de ${total}`}{" "}
        · Página {value.pagina} de {pages}
      </span>
      <div className="flex gap-2">
        {value.pagina > 1 && (
          <Link
            className="arca-btn arca-btn-secondary arca-btn-sm"
            href={listPageHref(path, value, value.pagina - 1)}
          >
            Anterior
          </Link>
        )}
        {value.pagina < pages && (
          <Link
            className="arca-btn arca-btn-secondary arca-btn-sm"
            href={listPageHref(path, value, value.pagina + 1)}
          >
            Siguiente
          </Link>
        )}
      </div>
    </nav>
  );
}
