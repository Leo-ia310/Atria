"use client";

import { useRecharts } from "@/components/charts/useRecharts";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

type PuntoDiario = { label: string; unidades: number; monto: number };
type Vendedor = { nombre: string; unidades: number; monto: number };

const TOOLTIP_STYLE = {
  backgroundColor: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 13,
  color: "var(--color-text-primary)",
};

function GraficaEgresos({
  data,
  pais,
  mejorLabel,
}: {
  data: PuntoDiario[];
  pais: PaisCodigo;
  mejorLabel: string | null;
}) {
  const recharts = useRecharts();
  if (data.length === 0) return <SinDatos texto="Sin salidas registradas." />;
  if (!recharts) return <SinDatos texto="Cargando grafica..." />;
  const { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } =
    recharts;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="label" stroke="var(--color-text-muted)" fontSize={11} />
          <YAxis stroke="var(--color-text-muted)" fontSize={11} allowDecimals={false} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number, name) =>
              name === "monto"
                ? [formatearMoneda(value, pais), "Ingreso"]
                : [`${value} u`, "Unidades"]
            }
          />
          <Bar dataKey="unidades" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell
                key={d.label}
                fill={
                  d.label === mejorLabel
                    ? "var(--color-primary)"
                    : "var(--color-tertiary, #A18BCF)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GraficaIngresos({ data }: { data: PuntoDiario[] }) {
  const recharts = useRecharts();
  if (data.length === 0) return <SinDatos texto="Sin entradas registradas." />;
  if (!recharts) return <SinDatos texto="Cargando grafica..." />;
  const { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } = recharts;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="label" stroke="var(--color-text-muted)" fontSize={11} />
          <YAxis stroke="var(--color-text-muted)" fontSize={11} allowDecimals={false} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number) => [`${value} u`, "Unidades"]}
          />
          <Bar dataKey="unidades" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GraficaVendedores({
  data,
  pais,
}: {
  data: Vendedor[];
  pais: PaisCodigo;
}) {
  const recharts = useRecharts();
  if (data.length === 0) return <SinDatos texto="Nadie ha vendido este producto todavía." />;
  if (!recharts) return <SinDatos texto="Cargando grafica..." />;
  const { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } = recharts;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
          <XAxis type="number" stroke="var(--color-text-muted)" fontSize={11} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="nombre"
            stroke="var(--color-text-muted)"
            fontSize={11}
            width={110}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number, name) =>
              name === "monto"
                ? [formatearMoneda(value, pais), "Ingreso"]
                : [`${value} u`, "Unidades"]
            }
          />
          <Bar dataKey="unidades" fill="var(--color-secondary)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SinDatos({ texto }: { texto: string }) {
  return (
    <div className="flex h-64 items-center justify-center text-small text-[color:var(--color-text-muted)]">
      {texto}
    </div>
  );
}
