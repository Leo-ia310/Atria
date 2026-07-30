import type { ReactNode } from "react";

export type Columna<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
};

/**
 * Server Component: recibe funciones `cell`/`rowKey` que se ejecutan en el
 * servidor. No marcar como `"use client"` — al pasarle funciones desde un
 * Server Component se romperían al cruzar la frontera de serialización.
 * Para filas navegables, usa un <Link> dentro de una celda.
 */
export function DataTable<T extends { id?: string }>({
  data,
  columns,
  rowKey = (r) => r.id ?? Math.random().toString(),
  empty,
}: {
  data: T[];
  columns: Columna<T>[];
  rowKey?: (row: T) => string;
  empty?: ReactNode;
}) {
  if (data.length === 0 && empty) {
    return <div className="arca-card p-8">{empty}</div>;
  }

  return (
    <div className="arca-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-small">
          <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ width: c.width, textAlign: c.align ?? "left" }}
                  className="text-label px-4 py-3 font-semibold"
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-b border-[color:var(--color-border)] last:border-b-0 transition-colors"
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    style={{ textAlign: c.align ?? "left" }}
                    className="px-4 py-3 text-[color:var(--color-text-primary)]"
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
