"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Columna<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
};

export function DataTable<T extends { id?: string }>({
  data,
  columns,
  rowKey = (r) => r.id ?? Math.random().toString(),
  onRowClick,
  empty,
}: {
  data: T[];
  columns: Columna<T>[];
  rowKey?: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
}) {
  if (data.length === 0 && empty) {
    return <div className="atria-card p-8">{empty}</div>;
  }

  return (
    <div className="atria-card overflow-hidden">
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
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-[color:var(--color-border)] last:border-b-0 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-[color:var(--color-surface-2)]",
                )}
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
