"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Calculator,
  Check,
  ClipboardList,
  CreditCard,
  FileText,
  Minus,
  Package,
  Plus,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Split,
  Trash2,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { ARCA_PRICING, USER_QUANTITY_MARKS } from "@/lib/marketing/arcaPricing";
import {
  EXTERNAL_SOFTWARE_PRICING,
  SOFTWARE_CATEGORIES,
} from "@/lib/marketing/softwarePricing";
import {
  calculateSavings,
  calculateSoftwareCost,
  clampUserCount,
  getAllExternalSoftwareIds,
  getDefaultSelectedSoftwareIds,
} from "@/lib/marketing/pricingCalculations";
import type { ExternalSoftware, SavingsResult } from "@/lib/marketing/pricingTypes";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Ventas y clientes": Users,
  "Procesos y tareas": ClipboardList,
  Contabilidad: Wallet,
  Inventario: Package,
  "Recursos humanos": ShieldCheck,
  "Punto de venta": ShoppingCart,
  Facturacion: FileText,
};

const SOFTWARE_BRANDS: Record<string, { label: string; mark: string; tone: string }> = {
  "hubspot-sales-starter": {
    label: "HubSpot",
    mark: "H",
    tone: "from-[#ff7a59] to-[#f97316]",
  },
  "pipedrive-lite": {
    label: "Pipedrive",
    mark: "P",
    tone: "from-[#16a34a] to-[#0f766e]",
  },
  "zoho-crm-standard": {
    label: "Zoho CRM",
    mark: "Z",
    tone: "from-[#2563eb] via-[#e11d48] to-[#f59e0b]",
  },
  "asana-starter": {
    label: "Asana",
    mark: "A",
    tone: "from-[#f43f5e] to-[#a855f7]",
  },
  "clickup-unlimited": {
    label: "ClickUp",
    mark: "C",
    tone: "from-[#7c3aed] to-[#22d3ee]",
  },
  "trello-premium": {
    label: "Trello",
    mark: "T",
    tone: "from-[#0ea5e9] to-[#2563eb]",
  },
  "quickbooks-simple-start": {
    label: "QuickBooks",
    mark: "Q",
    tone: "from-[#16a34a] to-[#22c55e]",
  },
  "xero-growing": {
    label: "Xero",
    mark: "X",
    tone: "from-[#38bdf8] to-[#0284c7]",
  },
  "zoho-books-standard": {
    label: "Zoho Books",
    mark: "Z",
    tone: "from-[#2563eb] via-[#e11d48] to-[#f59e0b]",
  },
  "zoho-inventory-standard": {
    label: "Zoho Inventory",
    mark: "Z",
    tone: "from-[#2563eb] via-[#e11d48] to-[#f59e0b]",
  },
  "bamboohr-core": {
    label: "BambooHR",
    mark: "B",
    tone: "from-[#65a30d] to-[#16a34a]",
  },
  "shopify-pos-pro": {
    label: "Shopify POS",
    mark: "S",
    tone: "from-[#95bf47] to-[#16a34a]",
  },
  "freshbooks-plus": {
    label: "FreshBooks",
    mark: "F",
    tone: "from-[#0ea5e9] to-[#1d4ed8]",
  },
};

const WITHOUT_ARCA_ITEMS = [
  ["Ventas", "otro inicio de sesion"],
  ["CRM", "clientes aislados"],
  ["Contabilidad", "libros separados"],
  ["POS", "caja desconectada"],
  ["Inventario", "stock duplicado"],
  ["RR. HH.", "datos del equipo"],
  ["Facturacion", "secuencias aparte"],
  ["Hojas de calculo", "reportes manuales"],
  ["Reportes", "copias diferentes"],
] as const;

const WITH_ARCA_ITEMS = [
  "Ventas",
  "Inventario",
  "Contabilidad",
  "Clientes",
  "RR. HH.",
  "Reportes",
] as const;

function formatCurrency(value: number, options?: { compact?: boolean }) {
  const hasDecimals = Math.abs(value % 1) > 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: options?.compact || !hasDecimals ? 0 : 2,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(value);
}

function formatPercent(value: number) {
  return `${Math.max(value, 0).toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export function SavingsCalculator() {
  const [selectedSoftwareIds, setSelectedSoftwareIds] = useState<string[]>(() =>
    getDefaultSelectedSoftwareIds(EXTERNAL_SOFTWARE_PRICING),
  );
  const [users, setUsers] = useState(6);
  const [userInput, setUserInput] = useState("6");
  const [comparisonMode, setComparisonMode] = useState<"without" | "with">("without");

  const result = useMemo(
    () => calculateSavings(EXTERNAL_SOFTWARE_PRICING, selectedSoftwareIds, users),
    [selectedSoftwareIds, users],
  );

  const softwareByCategory = useMemo(() => {
    return SOFTWARE_CATEGORIES.map((category) => ({
      category,
      software: EXTERNAL_SOFTWARE_PRICING.filter((item) => item.category === category),
    }));
  }, []);

  const selectedSet = useMemo(() => new Set(selectedSoftwareIds), [selectedSoftwareIds]);

  const toggleSoftware = (softwareId: string) => {
    setSelectedSoftwareIds((current) =>
      current.includes(softwareId)
        ? current.filter((id) => id !== softwareId)
        : [...current, softwareId],
    );
  };

  const updateUsers = (nextValue: number) => {
    const clamped = clampUserCount(nextValue, ARCA_PRICING.maxUsers);
    setUsers(clamped);
    setUserInput(String(clamped));
  };

  const handleUserInput = (value: string) => {
    setUserInput(value);
    if (value.trim() === "") return;
    const parsed = Number(value);
    // El calculo siempre refleja un valor valido: al teclear fuera de rango
    // (500, 3.7, 0) se clampa en vez de congelarse en el ultimo valor tecleado,
    // evitando que el campo muestre un numero distinto al del resumen.
    if (Number.isFinite(parsed)) {
      setUsers(clampUserCount(parsed, ARCA_PRICING.maxUsers));
    }
  };

  return (
    <section id="calculadora" className="relative overflow-hidden py-24 text-white">
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center" data-reveal>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]">
            Calculadora de ahorro
          </span>
          <h2 className="mt-3 text-[36px] font-semibold leading-tight">
            Centraliza tus herramientas y ve el costo real de operar separado.
          </h2>
          <p className="mt-4 text-[16px] leading-7 text-white/65">
            Selecciona el software que hoy sostiene tu operacion y compara su costo
            estimado con el plan de ARCA recomendado por cantidad de usuarios.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(350px,0.92fr)] lg:items-start">
          <div className="space-y-5" data-reveal>
            <UserQuantitySelector
              users={users}
              userInput={userInput}
              onDecrease={() => updateUsers(users - 1)}
              onIncrease={() => updateUsers(users + 1)}
              onInputChange={handleUserInput}
              onInputBlur={() => updateUsers(users)}
            />

            <div className="rounded-[14px] border border-white/12 bg-[#160827]/88 p-4 shadow-[0_22px_70px_rgba(7,2,18,0.35)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-[20px] font-semibold text-white">
                    Software que ARCA puede centralizar
                  </h3>
                  <p className="mt-1 text-[13px] leading-6 text-white/55">
                    Elige solo las herramientas que tu empresa usa actualmente.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedSoftwareIds(getAllExternalSoftwareIds(EXTERNAL_SOFTWARE_PRICING))
                    }
                    className="arca-btn arca-btn-sm border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.1]"
                  >
                    <Check size={14} /> Seleccionar todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSoftwareIds([])}
                    className="arca-btn arca-btn-sm border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
                  >
                    <Trash2 size={14} /> Limpiar
                  </button>
                </div>
              </div>

              <div className="mt-5 space-y-5">
                {softwareByCategory.map(({ category, software }) => {
                  const Icon = CATEGORY_ICONS[category] ?? Calculator;
                  return (
                    <div key={category}>
                      <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/40">
                        <Icon size={14} />
                        {category}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3">
                        {software.map((item) => (
                          <SoftwareOption
                            key={item.id}
                            software={item}
                            users={users}
                            selected={selectedSet.has(item.id)}
                            onToggle={() => toggleSoftware(item.id)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-5 lg:sticky lg:top-24" data-reveal>
            <SavingsSummary result={result} />
            <OperationModeToggle mode={comparisonMode} onModeChange={setComparisonMode} />
          </div>
        </div>
      </div>
    </section>
  );
}

type UserQuantitySelectorProps = {
  users: number;
  userInput: string;
  onDecrease: () => void;
  onIncrease: () => void;
  onInputChange: (value: string) => void;
  onInputBlur: () => void;
};

function UserQuantitySelector({
  users,
  userInput,
  onDecrease,
  onIncrease,
  onInputChange,
  onInputBlur,
}: UserQuantitySelectorProps) {
  const activeMarkId = users <= 7 ? "pro" : users <= 10 ? "enterprise" : "additional";

  return (
    <div className="rounded-[14px] border border-white/12 bg-[#160827]/88 p-5 shadow-[0_22px_70px_rgba(7,2,18,0.35)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <label
            htmlFor="arca-users"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]"
          >
            Cantidad de usuarios
          </label>
          <p className="mt-2 text-[15px] leading-6 text-white/62">
            Ajusta el equipo que usaria las herramientas seleccionadas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDecrease}
            disabled={users <= 1}
            aria-label="Restar usuario"
            className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-white/12 bg-white/[0.06] text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd]"
          >
            <Minus size={16} />
          </button>
          <input
            id="arca-users"
            type="number"
            min={1}
            max={ARCA_PRICING.maxUsers}
            value={userInput}
            inputMode="numeric"
            onChange={(event) => onInputChange(event.target.value)}
            onBlur={onInputBlur}
            aria-describedby="arca-users-help"
            className="h-11 w-24 rounded-[10px] border border-white/15 bg-white text-center text-[18px] font-semibold text-[#160827] shadow-[0_10px_28px_rgba(255,255,255,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd]"
          />
          <button
            type="button"
            onClick={onIncrease}
            disabled={users >= ARCA_PRICING.maxUsers}
            aria-label="Sumar usuario"
            className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-white/12 bg-white/[0.06] text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd]"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div id="arca-users-help" className="mt-4 grid gap-2 sm:grid-cols-3">
        {USER_QUANTITY_MARKS.map((mark) => (
          <div
            key={mark.id}
            className={cn(
              "rounded-[10px] border px-3 py-2 transition",
              activeMarkId === mark.id
                ? "border-[#a78bfa]/55 bg-[linear-gradient(135deg,rgba(124,58,237,0.22),rgba(37,99,235,0.16))]"
                : "border-white/10 bg-white/[0.04]",
            )}
          >
            <p className="text-[12px] font-semibold text-white">{mark.label}</p>
            <p className="mt-0.5 text-[11px] text-white/48">{mark.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

type SoftwareOptionProps = {
  software: ExternalSoftware;
  users: number;
  selected: boolean;
  onToggle: () => void;
};

function SoftwareOption({ software, users, selected, onToggle }: SoftwareOptionProps) {
  const cost = calculateSoftwareCost(software, users);
  const brand = SOFTWARE_BRANDS[software.id] ?? {
    label: software.name,
    mark: software.name.charAt(0),
    tone: "from-[#7c3aed] to-[#2563eb]",
  };
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={`${brand.label}. ${selected ? "Seleccionado" : "No seleccionado"}. Costo estimado ${formatCurrency(cost.monthlyCost)} al mes para ${users} usuarios.`}
      onClick={onToggle}
      className={cn(
        "group relative flex min-h-[96px] items-center justify-center rounded-[12px] border p-4 text-center transition duration-300 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd]",
        selected
          ? "border-[#a78bfa]/70 bg-[linear-gradient(160deg,rgba(124,58,237,0.24),rgba(37,99,235,0.16))] shadow-[0_18px_45px_rgba(124,58,237,0.24)]"
          : "border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.07]",
      )}
    >
      <span
        className={cn(
          "absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border transition",
          selected
            ? "border-[#86efac]/60 bg-[#052e1b] text-[#86efac]"
            : "border-white/18 bg-white/[0.05] text-transparent group-hover:text-white/35",
        )}
        aria-hidden
      >
        <Check size={13} />
      </span>

      <span className="flex flex-col items-center gap-2">
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,var(--tw-gradient-stops))] text-[18px] font-bold text-white shadow-[0_12px_28px_rgba(7,2,18,0.28)]",
            brand.tone,
          )}
          aria-hidden
        >
          {brand.mark}
        </span>
        <span className="max-w-[132px] text-[13px] font-semibold leading-tight text-white">
          {brand.label}
        </span>
      </span>
    </button>
  );
}

function SavingsSummary({ result }: { result: SavingsResult }) {
  const maxMonthly = Math.max(result.external.monthlyTotal, result.arca.monthlyTotal, 1);
  const externalBar = Math.max((result.external.monthlyTotal / maxMonthly) * 100, 4);
  const arcaBar = Math.max((result.arca.monthlyTotal / maxMonthly) * 100, 4);
  const mainCopy = getResultCopy(result);

  return (
    <aside
      aria-label="Resumen de ahorro"
      aria-live="polite"
      className="rounded-[16px] border border-white/14 bg-[linear-gradient(165deg,rgba(35,17,67,0.96),rgba(13,6,24,0.96))] p-5 shadow-[0_28px_80px_rgba(7,2,18,0.48)]"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]">
            Resumen dinamico
          </p>
          <h3 className="mt-2 text-[22px] font-semibold text-white">Comparacion mensual</h3>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-white text-[#4c1d95]">
          <Calculator size={20} />
        </div>
      </div>

      <div className="mt-5 rounded-[14px] border border-[#a78bfa]/30 bg-[linear-gradient(135deg,rgba(124,58,237,0.28),rgba(37,99,235,0.14))] p-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/48">
          Resultado principal
        </p>
        <p
          key={`${result.annualSavings}-${result.hasSelection}`}
          className="mt-2 text-[24px] font-semibold leading-tight text-white motion-safe:animate-[arca-amount-pop_.36s_ease-out]"
        >
          {mainCopy.title}
        </p>
        <p className="mt-2 text-[13px] leading-6 text-white/62">{mainCopy.description}</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Metric label="Aplicaciones" value={String(result.external.selectedCount)} />
        <Metric label="Usuarios" value={String(result.external.users)} />
        <Metric label="Apps / mes" value={formatCurrency(result.external.monthlyTotal)} />
        <Metric label="Apps / año" value={formatCurrency(result.external.annualTotal)} />
      </div>

      <div className="mt-5 rounded-[12px] border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] text-white/45">Plan recomendado</p>
            <p className="mt-1 text-[20px] font-semibold text-white">{result.arca.plan}</p>
          </div>
          <div className="text-right">
            <p className="text-[12px] text-white/45">ARCA mensual</p>
            <p className="mt-1 text-[24px] font-semibold text-white">
              {formatCurrency(result.arca.monthlyTotal)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-[12px] text-white/58">
          <div className="flex justify-between gap-3">
            <span>Usuarios incluidos</span>
            <span className="font-medium text-white">hasta {result.arca.includedUsers}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Usuarios adicionales</span>
            <span className="font-medium text-white">{result.arca.additionalUsers}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Costo adicional</span>
            <span className="font-medium text-white">
              {formatCurrency(result.arca.additionalUsersCost)}/mes
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span>ARCA anual</span>
            <span className="font-medium text-white">{formatCurrency(result.arca.annualTotal)}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <ComparisonBar
          label="Herramientas separadas"
          value={`${formatCurrency(result.external.monthlyTotal)}/mes`}
          width={externalBar}
        />
        <ComparisonBar
          label="ARCA"
          value={`${formatCurrency(result.arca.monthlyTotal)}/mes`}
          width={arcaBar}
          tone="arca"
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Metric
          label={result.annualSavings >= 0 ? "Ahorro mensual" : "Diferencia mensual"}
          value={formatCurrency(Math.abs(result.monthlySavings))}
        />
        <Metric
          label={result.annualSavings >= 0 ? "Ahorro anual" : "Diferencia anual"}
          value={formatCurrency(Math.abs(result.annualSavings))}
        />
      </div>

      <div className="mt-4 rounded-[12px] border border-white/10 bg-[#0d0618]/70 p-3">
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="text-white/52">Porcentaje de ahorro</span>
          <span className="font-semibold text-white">
            {result.isPositiveSavings ? formatPercent(result.savingsPercentage) : "Sin ahorro directo"}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Link
          href="/registro"
          className="arca-btn arca-btn-lg justify-center bg-white text-[#160827] transition hover:-translate-y-0.5 hover:bg-[#efe7ff]"
        >
          Empezar con ARCA <ArrowRight size={16} />
        </Link>
        <Link
          href="#precios"
          className="arca-btn arca-btn-lg justify-center border border-white/20 bg-white/[0.05] text-white transition hover:-translate-y-0.5 hover:bg-white/[0.1]"
        >
          Ver planes
        </Link>
      </div>

      <p className="mt-4 text-[11px] leading-5 text-white/42">
        Los resultados son estimaciones informativas. Los precios de aplicaciones externas
        pueden cambiar segun el pais, la cantidad de usuarios, los impuestos, las
        promociones y la modalidad de facturacion. Verifica las condiciones de cada
        proveedor antes de tomar una decision.
      </p>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[11px] text-white/42">{label}</p>
      <p className="mt-1 text-[18px] font-semibold text-white">{value}</p>
    </div>
  );
}

function ComparisonBar({
  label,
  value,
  width,
  tone = "external",
}: {
  label: string;
  value: string;
  width: number;
  tone?: "external" | "arca";
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-[12px]">
        <span className="text-white/55">{label}</span>
        <span className="font-semibold text-white">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 motion-reduce:transition-none",
            tone === "arca"
              ? "bg-[linear-gradient(90deg,#34d399,#a78bfa)]"
              : "bg-[linear-gradient(90deg,#f97316,#fbbf24)]",
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function OperationModeToggle({
  mode,
  onModeChange,
}: {
  mode: "without" | "with";
  onModeChange: (mode: "without" | "with") => void;
}) {
  return (
    <div className="rounded-[16px] border border-white/12 bg-[#160827]/88 p-5 shadow-[0_22px_70px_rgba(7,2,18,0.35)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-stretch xl:flex-row xl:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]">
            Operacion fragmentada
          </p>
          <h3 className="mt-2 text-[20px] font-semibold text-white">
            Sin Arca vs. Con Arca
          </h3>
        </div>
        <div className="grid grid-cols-2 rounded-full border border-white/12 bg-white/[0.05] p-1">
          {[
            ["without", "Sin Arca"],
            ["with", "Con Arca"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onModeChange(value as "without" | "with")}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c4b5fd]",
                mode === value
                  ? "bg-white text-[#160827]"
                  : "text-white/58 hover:text-white",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "mt-5 min-h-[300px] overflow-hidden",
          mode === "without"
            ? "rounded-[14px] border border-white/10 bg-[#0d0618]/78 p-4"
            : "p-0",
        )}
      >
        {mode === "without" ? <WithoutArcaView /> : <WithArcaView />}
      </div>
    </div>
  );
}

function WithoutArcaView() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/38">
        <Split size={14} />
        Herramientas separadas
      </div>
      <div className="grid grid-cols-2 gap-3">
        {WITHOUT_ARCA_ITEMS.map(([label, detail], index) => (
          <div
            key={label}
            className="rounded-[12px] border border-white/10 bg-white/[0.045] p-3 transition duration-300 motion-reduce:transition-none"
            style={{ transform: `translateY(${index % 2 === 0 ? 0 : 10}px)` }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white/10 text-white/70">
                {index % 3 === 0 ? <CreditCard size={15} /> : index % 3 === 1 ? <Receipt size={15} /> : <BarChart3 size={15} />}
              </span>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#3b0a12] text-[#fca5a5]">
                <X size={12} />
              </span>
            </div>
            <p className="mt-3 text-[13px] font-semibold text-white">{label}</p>
            <p className="mt-1 text-[11px] leading-4 text-white/45">{detail}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 text-[11px] text-white/48">
        {["Pagos separados", "Datos duplicados", "Reportes desconectados", "Mas soporte interno"].map(
          (item) => (
            <div key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
              {item}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function WithArcaView() {
  return (
    <div className="relative min-h-[300px] overflow-hidden py-2">
      <div
        aria-hidden
        className="absolute left-4 right-4 top-[72px] hidden h-px bg-[linear-gradient(90deg,transparent,rgba(167,139,250,0.58),transparent)] sm:block"
      />
      <div
        aria-hidden
        className="absolute left-1/2 top-[72px] hidden h-[108px] w-px -translate-x-1/2 bg-[linear-gradient(180deg,rgba(167,139,250,0.46),transparent)] sm:block"
      />

      <div className="relative z-10">
        <div className="mx-auto flex w-full max-w-[340px] items-center justify-center gap-3 rounded-full border border-[#a78bfa]/30 bg-white/[0.07] px-4 py-3 shadow-[0_18px_48px_rgba(124,58,237,0.2)] motion-safe:animate-[arca-amount-pop_.42s_ease-out]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#4c1d95] shadow-[0_10px_24px_rgba(255,255,255,0.14)]">
            <Sparkles size={17} />
          </span>
          <div className="min-w-0">
            <p className="text-[18px] font-semibold leading-none text-white">ARCA</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#c4b5fd]">
              Operacion centralizada
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {WITH_ARCA_ITEMS.map((item, index) => (
            <ArcaFlowPill key={item} label={item} index={index} />
          ))}
        </div>

        <div className="mt-6 overflow-hidden rounded-full bg-white/10">
          <div className="h-2 w-full rounded-full bg-[linear-gradient(90deg,#34d399,#a78bfa,#60a5fa)]" />
        </div>

        <div className="mt-4 grid grid-cols-3 divide-x divide-white/10 text-center">
          {["Un solo acceso", "Datos conectados", "Reportes claros"].map((item) => (
            <div key={item} className="px-2 text-[11px] font-semibold leading-4 text-[#86efac]">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ArcaFlowPill({ label, index }: { label: string; index: number }) {
  const Icon = index % 3 === 0 ? ShoppingCart : index % 3 === 1 ? Package : BarChart3;

  return (
    <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white/[0.055] px-3 py-2 text-[12px] font-semibold text-white/78 transition duration-300 hover:bg-white/[0.085] hover:text-white motion-reduce:transition-none">
      <Icon size={14} className="text-[#c4b5fd]" aria-hidden />
      {label}
      <Check size={12} className="text-[#86efac]" aria-hidden />
    </span>
  );
}

function getResultCopy(result: SavingsResult) {
  if (!result.hasSelection) {
    return {
      title: "Selecciona herramientas para calcular una comparacion honesta.",
      description:
        "ARCA no muestra ahorro hasta que existan aplicaciones externas seleccionadas.",
    };
  }

  if (result.annualSavings > 0) {
    return {
      title: `Ahorrarias aproximadamente ${formatCurrency(result.annualSavings)} al año con ARCA`,
      description: `Estimacion basada en ${result.external.selectedCount} aplicaciones y ${result.external.users} usuarios.`,
    };
  }

  if (result.annualSavings === 0) {
    return {
      title: "La seleccion actual queda al mismo costo anual que ARCA.",
      description:
        "La diferencia principal estaria en centralizar procesos, datos y reportes en una sola plataforma.",
    };
  }

  return {
    title: `La seleccion actual cuesta ${formatCurrency(Math.abs(result.annualSavings))} menos al año.`,
    description:
      "ARCA puede seguir aportando valor al reunir operaciones clave en una sola plataforma.",
  };
}
