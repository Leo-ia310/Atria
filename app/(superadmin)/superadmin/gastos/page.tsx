import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, ReceiptText, TrendingDown } from "lucide-react";
import { PlatformExpenseForm } from "@/components/superadmin/PlatformExpenseForm";
import { obtenerGastosPlataforma } from "@/lib/superadmin/metrics";
import { formatearFecha } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SuperAdminGastosPage() {
  const { gastos, totalMes, totalAnio } = await obtenerGastosPlataforma();

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl">Gastos de plataforma</h1>
          <p className="mt-1 text-small text-white/60">
            Control interno de costos del SaaS separado de los gastos de cada cliente.
          </p>
        </div>
        <Link href="/superadmin" className="text-small text-white/60 hover:text-white">
          Dashboard
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Kpi icon={ReceiptText} label="Gastos registrados" value={String(gastos.length)} />
        <Kpi icon={CalendarDays} label="Total este mes" value={money(totalMes)} />
        <Kpi icon={TrendingDown} label="Total este ano" value={money(totalAnio)} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        <PlatformExpenseForm />

        <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-base font-semibold text-white">Ultimos gastos</h2>
            <p className="text-[12px] text-white/45">Los 100 registros mas recientes.</p>
          </div>
          {gastos.length === 0 ? (
            <div className="p-8 text-center text-small text-white/50">
              Aun no hay gastos de plataforma registrados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-small">
                <thead className="border-b border-white/10 bg-white/[0.03]">
                  <tr className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Categoria</th>
                    <th className="px-4 py-3 text-left">Descripcion</th>
                    <th className="px-4 py-3 text-left">Proveedor</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3 text-left">Metodo</th>
                  </tr>
                </thead>
                <tbody>
                  {gastos.map((g) => (
                    <tr key={g.id} className="border-b border-white/10 last:border-b-0 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-white/60">{formatearFecha(g.fecha)}</td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-white/10 px-2 py-1 text-[10px] uppercase tracking-wider text-white/70">
                          {g.categoria}
                        </span>
                        {g.recurrente && (
                          <div className="mt-1 text-[11px] text-yellow-300">recurrente</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white">
                        <div>{g.descripcion}</div>
                        {g.notas && <div className="mt-1 text-[11px] text-white/40">{g.notas}</div>}
                      </td>
                      <td className="px-4 py-3 text-white/60">{g.proveedor || "-"}</td>
                      <td className="px-4 py-3 text-right font-medium text-white">
                        {money(g.monto)} {g.moneda}
                      </td>
                      <td className="px-4 py-3 text-white/60">{g.metodoPago || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-white/40">{label}</span>
        <Icon size={14} className="text-white/30" />
      </div>
      <div className="mt-2 text-xl text-white">{value}</div>
    </div>
  );
}

function money(value: number): string {
  return `$${value.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
