"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatearMoneda } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

export function GraficaInventario({
  data,
  pais,
}: {
  data: { nombre: string; valor: number }[];
  pais: PaisCodigo;
}) {
  return (
    <div className="h-96 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2DFF0" horizontal={false} />
          <XAxis
            type="number"
            stroke="#8B7FA8"
            fontSize={11}
            tickFormatter={(v: number) =>
              formatearMoneda(v, pais).replace(/\.\d+$/, "")
            }
          />
          <YAxis
            type="category"
            dataKey="nombre"
            stroke="#8B7FA8"
            fontSize={10}
            width={130}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2DFF0",
              borderRadius: 8,
              fontSize: 13,
            }}
            formatter={(v: number) => [formatearMoneda(v, pais), "Valor"]}
          />
          <Bar dataKey="valor" name="Valor" fill="#7EC4CF" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
