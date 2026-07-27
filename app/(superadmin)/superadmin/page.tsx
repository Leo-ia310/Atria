import Link from "next/link";
import { count, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { empresas, suscripciones, usuarios, ventas } from "@/lib/db/schema";
import { Building2, Users, CreditCard, Receipt, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const [tenantsCount] = await db.select({ n: count() }).from(empresas);
  const [usuariosCount] = await db.select({ n: count() }).from(usuarios);
  const [activasCount] = await db
    .select({ n: count() })
    .from(suscripciones)
    .where(eq(suscripciones.estado, "activa"));
  const [trialCount] = await db
    .select({ n: count() })
    .from(suscripciones)
    .where(eq(suscripciones.estado, "trial"));
  const [resumenVentas] = await db
    .select({ total: sql<string>`COALESCE(SUM(${ventas.total}), 0)` })
    .from(ventas)
    .where(eq(ventas.estado, "completada"));

  return (
    <div>
      <div>
        <h1 className="text-2xl">Panel de control SaaS</h1>
        <p className="mt-1 text-small text-white/60">
          Métricas globales de la plataforma.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Tenants registrados" value={String(tenantsCount?.n ?? 0)} icon={Building2} />
        <Kpi label="Suscripciones activas" value={String(activasCount?.n ?? 0)} icon={CreditCard} />
        <Kpi label="En período de prueba" value={String(trialCount?.n ?? 0)} icon={Receipt} />
        <Kpi label="Usuarios totales" value={String(usuariosCount?.n ?? 0)} icon={Users} />
      </div>

      <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
          Volumen total de la plataforma
        </div>
        <div className="mt-1 text-3xl font-bold text-white">
          ${parseFloat(resumenVentas?.total ?? "0").toLocaleString("es", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
        <p className="mt-2 text-small text-white/50">
          Suma de todas las ventas completadas en todos los tenants
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/superadmin/tenants"
          className="group rounded-lg border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold text-white">Tenants</div>
              <p className="mt-1 text-small text-white/60">
                Lista de empresas con métricas y estado de suscripción
              </p>
            </div>
            <ArrowRight
              size={18}
              className="text-white/40 transition group-hover:translate-x-1 group-hover:text-white"
            />
          </div>
        </Link>
        <Link
          href="/superadmin/planes"
          className="group rounded-lg border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold text-white">Planes</div>
              <p className="mt-1 text-small text-white/60">
                Configuración de planes Demo, Pro y Enterprise
              </p>
            </div>
            <ArrowRight
              size={18}
              className="text-white/40 transition group-hover:translate-x-1 group-hover:text-white"
            />
          </div>
        </Link>
      </div>

      <div className="mt-6 rounded-md border border-yellow-500/20 bg-yellow-500/10 p-4 text-small">
        <strong className="text-yellow-400">Impersonación pendiente</strong>
        <p className="mt-1 text-white/60">
          La impersonación de tenants se implementa con cookies httpOnly + RLS policies
          en Postgres. Se construye junto con `lib/db/policies.sql` en la siguiente sesión.
        </p>
      </div>
    </div>
  );
}

import type { LucideIcon } from "lucide-react";

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
