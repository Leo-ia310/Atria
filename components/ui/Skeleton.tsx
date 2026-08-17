export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[color:var(--color-surface-2)] ${className}`}
    />
  );
}

/** Encabezado tipo PageHeader: título + subtítulo + botones de acción. */
export function SkeletonHeader({ actions = 0 }: { actions?: number }) {
  return (
    <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:mb-6 sm:flex-row sm:items-end sm:gap-4">
      <div className="min-w-0 space-y-2">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-3.5 w-64" />
      </div>
      {actions > 0 && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {Array.from({ length: actions }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-28" />
          ))}
        </div>
      )}
    </div>
  );
}

/** Fila de tarjetas KPI (arca-card p-5). */
export function SkeletonKpis({ count = 4 }: { count?: number }) {
  const cols =
    count === 3
      ? "sm:grid-cols-3"
      : count === 2
        ? "sm:grid-cols-2"
        : "sm:grid-cols-2 lg:grid-cols-4";
  return (
    <div className={`grid grid-cols-1 gap-4 ${cols}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="arca-card p-5">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
          </div>
          <Skeleton className="mt-3 h-7 w-28" />
          <Skeleton className="mt-2.5 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

/** Tabla envuelta en tarjeta (DataTable). */
export function SkeletonTable({
  rows = 8,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="arca-card overflow-hidden">
      <div className="flex items-center gap-4 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-3.5">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={`h-3 flex-1 ${i === 0 ? "max-w-[30%]" : ""}`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 border-b border-[color:var(--color-border)] px-4 py-4 last:border-b-0"
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={`h-4 flex-1 ${c === 0 ? "max-w-[30%]" : c === cols - 1 ? "max-w-[70px]" : ""}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Barra de filtros: campos con etiqueta + botón. */
export function SkeletonFilterBar({ fields = 4 }: { fields?: number }) {
  return (
    <div className="arca-card p-4 sm:p-5">
      <div className="flex flex-wrap items-end gap-3">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 w-40" />
          </div>
        ))}
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}

/** Grid de tarjetas de navegación (icono + título + descripción). */
export function SkeletonCardGrid({
  count = 6,
  cols = 3,
}: {
  count?: number;
  cols?: 2 | 3 | 4;
}) {
  const colClass =
    cols === 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : cols === 2
        ? "lg:grid-cols-2"
        : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={`grid grid-cols-1 gap-4 ${colClass}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="arca-card p-4 sm:p-5">
          <Skeleton className="mb-3 h-9 w-9 rounded-md" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-full max-w-[220px]" />
        </div>
      ))}
    </div>
  );
}

/** Gráfica grande (2/3) + lista lateral (1/3). */
export function SkeletonChartRow() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="arca-card lg:col-span-2">
        <div className="border-b border-[color:var(--color-border)] px-4 py-4 sm:px-5">
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="p-4 sm:p-5">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
      <div className="arca-card overflow-hidden">
        <div className="border-b border-[color:var(--color-border)] px-4 py-4 sm:px-5">
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="divide-y divide-[color:var(--color-border)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-2 px-4 py-2.5">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-full max-w-[150px]" />
                <Skeleton className="h-2.5 w-16" />
              </div>
              <Skeleton className="h-3.5 w-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Formulario: campos en dos columnas + botones. */
export function SkeletonForm({ fields = 6 }: { fields?: number }) {
  return (
    <div className="arca-card space-y-6 p-5 sm:p-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 border-t border-[color:var(--color-border)] pt-4">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
}

/** Lista dividida dentro de tarjeta (fila con detalle + valor). */
export function SkeletonList({
  rows = 6,
  title = true,
}: {
  rows?: number;
  title?: boolean;
}) {
  return (
    <div className="arca-card overflow-hidden">
      {title && (
        <div className="border-b border-[color:var(--color-border)] px-4 py-4 sm:px-5">
          <Skeleton className="h-4 w-44" />
        </div>
      )}
      <div className="divide-y divide-[color:var(--color-border)]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-44" />
              <Skeleton className="h-2.5 w-28" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Pila de asientos contables (encabezado + mini-tabla debe/haber). */
export function SkeletonFinanceStack({
  blocks = 4,
  rows = 3,
}: {
  blocks?: number;
  rows?: number;
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: blocks }).map((_, b) => (
        <div key={b} className="arca-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-3">
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-2.5 w-56" />
            </div>
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="divide-y divide-[color:var(--color-border)]">
            {Array.from({ length: rows }).map((_, r) => (
              <div key={r} className="flex items-center gap-4 px-4 py-2.5">
                <Skeleton className="h-3.5 flex-1" />
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3.5 w-20" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Estado financiero de una sola tabla larga (mayor, balance, resultados). */
export function SkeletonFinanceTable({ rows = 12 }: { rows?: number }) {
  return (
    <div className="arca-card overflow-hidden">
      <div className="flex items-center gap-4 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-4 py-3.5">
        <Skeleton className="h-3 flex-1 max-w-[40%]" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-24" />
      </div>
      {Array.from({ length: rows }).map((_, r) => {
        const seccion = r % 5 === 0;
        return (
          <div
            key={r}
            className={`flex items-center gap-4 border-b border-[color:var(--color-border)] px-4 py-3 last:border-b-0 ${seccion ? "bg-[color:var(--color-surface-2)]/50" : ""}`}
          >
            <Skeleton className={`h-4 flex-1 ${seccion ? "max-w-[35%]" : "max-w-[45%]"}`} />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        );
      })}
    </div>
  );
}

/** Detalle: tarjeta principal con filas + tarjeta lateral. */
export function SkeletonDetail() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="arca-card p-5 sm:p-6">
          <Skeleton className="h-5 w-48" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3.5 w-40" />
              </div>
            ))}
          </div>
        </div>
        <SkeletonTable rows={5} cols={4} />
      </div>
      <div className="space-y-4">
        <div className="arca-card p-5 sm:p-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-4 h-9 w-40" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-5 h-9 w-full" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton genérico de página: encabezado + fila de KPIs + tabla. */
export function PageSkeleton() {
  return (
    <div>
      <SkeletonHeader actions={1} />
      <SkeletonKpis count={4} />
      <div className="mt-6">
        <SkeletonTable rows={6} cols={5} />
      </div>
    </div>
  );
}
