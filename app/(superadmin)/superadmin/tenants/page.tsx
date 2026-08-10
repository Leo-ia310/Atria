import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Database, DollarSign, Users } from "lucide-react";
import { TenantAdminActions } from "@/components/superadmin/TenantAdminActions";
import { obtenerClientesSuperAdmin } from "@/lib/superadmin/metrics";
import { formatearFecha } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const filas = await obtenerClientesSuperAdmin();
  const activos = filas.filter((f) => f.operativo === "activo").length;
  const bloqueados = filas.filter((f) => f.operativo === "bloqueado").length;
  const storage = filas.reduce((total, f) => total + f.storageBytes, 0);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl">Clientes</h1>
          <p className="mt-1 text-small text-white/60">
            {filas.length} negocios registrados con plan, estado y uso operativo.
          </p>
        </div>
        <Link href="/superadmin" className="text-small text-white/60 hover:text-white">
          Dashboard
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <MiniKpi icon={Users} label="Activos" value={String(activos)} />
        <MiniKpi icon={DollarSign} label="Bloqueados" value={String(bloqueados)} />
        <MiniKpi icon={Database} label="Storage estimado" value={formatBytes(storage)} />
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] text-small">
            <thead className="border-b border-white/10 bg-white/[0.03]">
              <tr className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                <th className="px-4 py-3 text-left">Negocio</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right">Uso</th>
                <th className="px-4 py-3 text-right">Storage</th>
                <th className="px-4 py-3 text-right">Pagos mes</th>
                <th className="px-4 py-3 text-right">Pagos total</th>
                <th className="px-4 py-3 text-left">Periodo</th>
                <th className="px-4 py-3 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className="border-b border-white/10 align-top last:border-b-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-4">
                    <div className="font-medium text-white">{f.nombreComercial || f.razonSocial}</div>
                    <div className="mt-0.5 text-[12px] text-white/45">{f.razonSocial}</div>
                    <div className="mt-1 text-[11px] text-white/35">
                      {f.pais} - {f.email || "sin email"} - {f.telefono || "sin telefono"}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded bg-white/10 px-2 py-1 text-[10px] uppercase tracking-wider text-white">
                      {f.planNombre}
                    </span>
                    <div className="mt-1 text-[11px] text-white/45">{f.ciclo ?? "sin ciclo"}</div>
                  </td>
                  <td className="px-4 py-4">
                    <EstadoBadge estado={f.operativo} />
                    <div className="mt-1 text-[11px] text-white/45">{f.suscripcionEstado ?? "sin suscripcion"}</div>
                  </td>
                  <td className="px-4 py-4 text-right text-white/70">
                    <div>{f.usuarios} usuarios</div>
                    <div>{f.productos} productos</div>
                    <div>{f.clientes} clientes</div>
                    <div>{f.facturas} facturas</div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="font-medium text-white">{f.storageLabel}</div>
                    <div className="text-[11px] text-white/40">estimado BD</div>
                  </td>
                  <td className="px-4 py-4 text-right text-white">{money(f.pagosMes)}</td>
                  <td className="px-4 py-4 text-right text-white">{money(f.pagosTotales)}</td>
                  <td className="px-4 py-4 text-white/60">
                    {f.finPeriodo ? (
                      <>
                        <div>vence {formatearFecha(f.finPeriodo)}</div>
                        <div className="text-[11px] text-white/35">
                          creado {formatearFecha(f.creadoEn)}
                        </div>
                      </>
                    ) : (
                      "sin periodo"
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <TenantAdminActions tenant={{ id: f.id, razonSocial: f.razonSocial }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const clases: Record<string, string> = {
    activo: "bg-green-500/20 text-green-300",
    trial: "bg-yellow-500/20 text-yellow-300",
    bloqueado: "bg-red-500/20 text-red-300",
    suspendido: "bg-orange-500/20 text-orange-300",
    cancelado: "bg-white/10 text-white/50",
    sin_plan: "bg-white/10 text-white/50",
  };
  return (
    <span className={`rounded px-2 py-1 text-[10px] uppercase tracking-wider ${clases[estado] ?? clases.sin_plan}`}>
      {estado.replace("_", " ")}
    </span>
  );
}

function MiniKpi({
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let i = 1; i < units.length && value >= 1024; i += 1) {
    value /= 1024;
    unit = units[i];
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
}
