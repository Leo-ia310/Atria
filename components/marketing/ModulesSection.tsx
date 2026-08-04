"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  Banknote,
  BookOpen,
  Building2,
  CalendarCheck,
  ChefHat,
  ClipboardCheck,
  CreditCard,
  FileText,
  HandCoins,
  Landmark,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
  Users,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  ARCA_MODULES,
  ARCA_MODULE_CATEGORIES,
  type ArcaModuleIcon,
} from "@/lib/marketing/arcaModules";
import { cn } from "@/lib/utils";

const ICONS: Record<ArcaModuleIcon, LucideIcon> = {
  BarChart3,
  Banknote,
  BookOpen,
  Building2,
  CalendarCheck,
  ChefHat,
  ClipboardCheck,
  CreditCard,
  FileText,
  HandCoins,
  Landmark,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
  Users,
  UserRound,
  Wallet,
};

export function ModulesSection() {
  const [activeCategoryId, setActiveCategoryId] = useState("operaciones");
  const activeCategory = ARCA_MODULE_CATEGORIES.find(
    (category) => category.id === activeCategoryId,
  );

  const modules = useMemo(() => {
    if (!activeCategory) return ARCA_MODULES;
    return activeCategory.modules;
  }, [activeCategory]);

  return (
    <section id="modulos" className="relative overflow-hidden py-24 text-white">
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-end">
          <div data-reveal>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]">
              Modulos verificados
            </span>
            <h2 className="mt-3 text-[36px] font-semibold leading-tight">
              Todo lo que necesitas para administrar tu empresa, conectado en ARCA.
            </h2>
            <p className="mt-4 text-[16px] leading-7 text-white/65">
              Todo en un solo lugar.
            </p>
          </div>

          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            aria-label="Resumen de modulos ARCA"
            data-reveal
          >
            {[
              ["Areas", ARCA_MODULE_CATEGORIES.length],
              ["Modulos", ARCA_MODULES.length],
              ["Finanzas", ARCA_MODULE_CATEGORIES[1]?.modules.length ?? 0],
              ["Equipo", ARCA_MODULE_CATEGORIES[3]?.modules.length ?? 0],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-[10px] border border-white/12 bg-[#1b0d31]/85 p-4 text-center"
              >
                <p className="text-[22px] font-semibold text-white">{value}</p>
                <p className="mt-1 text-[12px] text-white/50">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex gap-2 overflow-x-auto pb-2" role="tablist" data-reveal>
          {ARCA_MODULE_CATEGORIES.map((category) => {
            const active = activeCategoryId === category.id;
            return (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="arca-modules-panel"
                onClick={() => setActiveCategoryId(category.id)}
                className={cn(
                  "flex-shrink-0 rounded-full border px-4 py-2 text-[13px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd]",
                  active
                    ? "border-[#a78bfa]/70 bg-white text-[#160827] shadow-[0_12px_30px_rgba(167,139,250,0.24)]"
                    : "border-white/12 bg-white/[0.05] text-white/62 hover:border-white/25 hover:bg-white/[0.08] hover:text-white",
                )}
              >
                {category.name}
                <span className="ml-2 text-[11px] opacity-65">{category.modules.length}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-8" id="arca-modules-panel" role="tabpanel">
          {activeCategory && (
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between" data-reveal>
              <div>
                <h3 className="text-[24px] font-semibold text-white">{activeCategory.name}</h3>
                <p className="mt-1 max-w-2xl text-[14px] leading-6 text-white/58">
                  {activeCategory.summary}
                </p>
              </div>
              <span className="w-fit rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-[12px] text-white/55">
                {activeCategory.modules.length} modulos
              </span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((module, index) => {
              const Icon = ICONS[module.icon];
              return (
                <article
                  key={module.id}
                  className="arca-tilt group flex h-full flex-col rounded-[14px] border border-white/10 bg-[linear-gradient(160deg,rgba(51,24,88,0.92),rgba(18,20,63,0.88))] p-5 hover:border-[#a78bfa]/55 hover:bg-[#24123f] hover:shadow-[0_24px_60px_rgba(124,58,237,0.24)]"
                  data-reveal
                  style={{ transitionDelay: `${Math.min(index * 35, 180)}ms` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,#7c3aed,#2563eb)] text-white shadow-[0_10px_24px_rgba(124,58,237,0.35)] transition group-hover:scale-105">
                      <Icon size={21} />
                    </div>
                    <span className="rounded-full border border-[#34d399]/20 bg-[#052e1b]/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#86efac]">
                      Disponible
                    </span>
                  </div>

                  <h4 className="mt-5 text-[17px] font-semibold text-white">{module.name}</h4>
                  <p className="mt-2 text-[13px] leading-6 text-white/60">
                    {module.description}
                  </p>

                  <div className="mt-5 rounded-[10px] border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">
                      Beneficio
                    </p>
                    <p className="mt-1 text-[13px] leading-5 text-white/72">{module.benefit}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
