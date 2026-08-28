"use client";

import { useRecharts } from "@/components/charts/useRecharts";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

export function GraficaVentas({
  data,
  pais,
}: {
  data: { label: string; total: number }[];
  pais: PaisCodigo;
}) {
  const recharts = useRecharts();
  if (!recharts) return <div className="h-64 w-full" />;
  const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = recharts;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2DFF0" />
          <XAxis dataKey="label" stroke="#8B7FA8" fontSize={11} />
          <YAxis
            stroke="#8B7FA8"
            fontSize={11}
            tickFormatter={(v) => formatearMoneda(v, pais).replace(/\.\d+$/, "")}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2DFF0",
              borderRadius: 8,
              fontSize: 13,
            }}
            formatter={(v: number) => formatearMoneda(v, pais)}
          />
          <Bar dataKey="total" fill="#A18BCF" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
