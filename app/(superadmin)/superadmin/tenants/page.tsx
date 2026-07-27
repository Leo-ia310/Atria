import Link from "next/link";
import { count, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  empresas,
  usuarios,
  suscripciones,
  planes,
  ventas,
} from "@/lib/db/schema";
import { formatearFecha } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const filas = await db
    .select({
      id: empresas.id,
      razonSocial: empresas.razonSocial,
      pais: empresas.pais,
      creadoEn: empresas.creadoEn,
      activa: empresas.activa,
      plan: planes.nombre,
      estadoSus: suscripciones.estado,
    })
    .from(empresas)
    .leftJoin(suscripciones, eq(suscripciones.empresaId, empresas.id))
    .leftJoin(planes, eq(planes.id, suscripciones.planId));

  const conteoUsuarios = await db
    .select({
      empresaId: usuarios.empresaId,
      n: count(),
    })
    .from(usuarios)
    .groupBy(usuarios.empresaId);
  const mapaUsuarios = new Map(conteoUsuarios.map((c) => [c.empresaId, c.n]));

  const ventasPorEmpresa = await db
    .select({
      empresaId: ventas.empresaId,
      total: sql<string>`COALESCE(SUM(${ventas.total}), 0)`,
    })
    .from(ventas)
    .where(eq(ventas.estado, "completada"))
    .groupBy(ventas.empresaId);
  const mapaVentas = new Map(
    ventasPorEmpresa.map((v) => [v.empresaId, parseFloat(v.total)]),
  );

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl">Tenants</h1>
          <p className="mt-1 text-small text-white/60">
            {filas.length} empresas registradas en ATRIA
          </p>
        </div>
        <Link
          href="/superadmin"
          className="text-small text-white/60 hover:text-white"
        >
          ← Dashboard
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
        <table className="w-full text-small">
          <thead className="border-b border-white/10 bg-white/[0.03]">
            <tr className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
              <th className="px-4 py-3 text-left">Empresa</th>
              <th className="px-4 py-3 text-left">País</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-right">Usuarios</th>
              <th className="px-4 py-3 text-right">Ventas totales</th>
              <th className="px-4 py-3 text-left">Registrado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr
                key={f.id}
                className="border-b border-white/10 last:border-b-0 hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3 font-medium text-white">{f.razonSocial}</td>
                <td className="px-4 py-3 text-white/70">{f.pais}</td>
                <td className="px-4 py-3">
                  <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                    {f.plan ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                      f.estadoSus === "activa"
                        ? "bg-green-500/20 text-green-400"
                        : f.estadoSus === "trial"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {f.estadoSus ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-white/70">
                  {mapaUsuarios.get(f.id) ?? 0}
                </td>
                <td className="px-4 py-3 text-right text-white">
                  ${(mapaVentas.get(f.id) ?? 0).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-white/60">
                  {formatearFecha(f.creadoEn)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
