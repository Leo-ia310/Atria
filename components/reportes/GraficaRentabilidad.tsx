"use client";

import { useRecharts } from "@/components/charts/useRecharts";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

export function GraficaRentabilidad({
  data,
  pais,
}: {
  data: { mes: string; ingresos: number; costos: number }[];
  pais: PaisCodigo;
}) {
  const recharts = useRecharts();
  if (!recharts) return <div className="h-72 w-full" />;
  const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } =
    recharts;
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2DFF0" />
          <XAxis dataKey="mes" stroke="#8B7FA8" fontSize={11} />
          <YAxis
            stroke="#8B7FA8"
            fontSize={11}
            tickFormatter={(v: number) =>
              formatearMoneda(v, pais).replace(/\.\d+$/, "")
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2DFF0",
              borderRadius: 8,
              fontSize: 13,
            }}
            formatter={(v: number, name: string) => [
              formatearMoneda(v, pais),
              name === "ingresos" ? "Ingresos" : "Costo de ventas",
            ]}
          />
          <Legend
            formatter={(value) =>
              value === "ingresos" ? "Ingresos" : "Costo de ventas"
            }
          />
          <Bar dataKey="ingresos" fill="#A18BCF" radius={[4, 4, 0, 0]} />
          <Bar dataKey="costos" fill="#F4A97A" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
