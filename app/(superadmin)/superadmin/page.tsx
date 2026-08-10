import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Building2,
  CreditCard,
  Database,
  DollarSign,
  PauseCircle,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { obtenerClientesSuperAdmin, obtenerResumenSuperAdmin } from "@/lib/superadmin/metrics";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const [resumen, clientes] = await Promise.all([
    obtenerResumenSuperAdmin(),
    obtenerClientesSuperAdmin(),
  ]);
  const topStorage = [...clientes].sort((a, b) => b.storageBytes - a.storageBytes).slice(0, 5);
  const recientes = clientes.slice(0, 5);

  return (
    <div>
      <div>
        <h1 className="text-2xl">Panel de control SaaS</h1>
        <p className="mt-1 text-small text-white/60">
          Clientes, membresias, pagos, gastos y almacenamiento estimado de la plataforma.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Clientes registrados" value={String(resumen.totalClientes)} icon={Building2} />
        <Kpi label="Clientes activos" value={String(resumen.clientesActivos)} icon={CreditCard} />
        <Kpi label="Trials activos" value={String(resumen.trials)} icon={Receipt} />
        <Kpi label="Suspendidos / bloqueados" value={`${resumen.clientesSuspendidos}/${resumen.clientesBloqueados}`} icon={PauseCircle} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Kpi label="MRR estimado" value={money(resumen.mrrEstimado)} icon={TrendingUp} />
        <Kpi label="Pagos recibidos este mes" value={money(resumen.pagosMes)} icon={DollarSign} />
        <Kpi label="Gastos este mes" value={money(resumen.gastosMes)} icon={Receipt} />
        <Kpi label="Storage estimado" value={resumen.storageTotalLabel} icon={Database} />
      </div>

      <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Utilidad operativa del mes
            </div>
            <div className="mt-1 text-3xl font-bold text-white">{money(resumen.utilidadMes)}</div>
          </div>
          <Link
            href="/superadmin/gastos"
            className="arca-btn arca-btn-sm border-white/10 bg-white text-[#1A1225] hover:bg-white/90"
          >
            Controlar gastos
          </Link>
        </div>
        <p className="mt-2 text-small text-white/50">
          Pagos completados menos gastos internos registrados desde el primer dia del mes.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <QuickLink
          href="/superadmin/tenants"
          title="Clientes"
          text="Planes, estados, almacenamiento y acciones delicadas"
        />
        <QuickLink
          href="/superadmin/planes"
          title="Planes"
          text="Configuracion global de Demo, Pro y Enterprise"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Clientes recientes">
          <div className="divide-y divide-white/10">
            {recientes.map((cliente) => (
              <div key={cliente.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-white">
                    {cliente.nombreComercial || cliente.razonSocial}
                  </div>
                  <div className="text-[12px] text-white/45">
                    {cliente.planNombre} - {cliente.operativo}
                  </div>
                </div>
                <span className="text-[12px] text-white/60">{money(cliente.pagosMes)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Mayor almacenamiento estimado">
          <div className="divide-y divide-white/10">
            {topStorage.map((cliente) => (
              <div key={cliente.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-white">
                    {cliente.nombreComercial || cliente.razonSocial}
                  </div>
                  <div className="text-[12px] text-white/45">
                    {cliente.productos} productos - {cliente.ventas} ventas - {cliente.facturas} facturas
                  </div>
                </div>
                <span className="text-[12px] text-white/60">{cliente.storageLabel}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-white/40">{label}</span>
        <Icon size={14} className="text-white/30" />
      </div>
      <div className="mt-2 text-2xl text-white">{value}</div>
    </div>
  );
}

function QuickLink({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-semibold text-white">{title}</div>
          <p className="mt-1 text-small text-white/60">{text}</p>
        </div>
        <ArrowRight
          size={18}
          className="text-white/40 transition group-hover:translate-x-1 group-hover:text-white"
        />
      </div>
    </Link>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{title}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function money(value: number): string {
  return `$${value.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
