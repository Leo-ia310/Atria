"use client";

import { useState } from "react";
import {
  CreditCard,
  Users,
  Building2,
  Check,
  FileText,
  Download,
  Sparkles,
} from "lucide-react";
import { subscriptionPlans } from "@atria/contracts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { DataTable, type Columna } from "@/components/ui/DataTable";
import { useApi, ApiAviso } from "@/lib/use-api";
import { apiClient, ApiError, ApiDisabledError } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { cn, formatearMoneda, formatearFecha } from "@/lib/utils";

type BillingOverview = {
  subscription: {
    planCode: "BUSINESS" | "ENTERPRISE";
    status: string;
    startedAt: string;
    expiresAt: string | null;
    apiAccessEnabled: boolean;
  };
  usage: { users: number; branches: number };
  invoices: {
    id: string;
    number: string;
    planCode: string;
    periodStart: string;
    periodEnd: string;
    amountDue: string | number;
    currencyCode: string;
    status: string;
    paidAt: string | null;
  }[];
};

export default function BillingPage() {
  const { data, loading, apiDisabled, error, refetch } =
    useApi<BillingOverview>("/billing/overview");
  const { mostrar } = useToast();
  const [cambiando, setCambiando] = useState<string | null>(null);

  async function cambiarPlan(planCode: "BUSINESS" | "ENTERPRISE") {
    setCambiando(planCode);
    try {
      await apiClient.post("/billing/change-plan", { planCode });
      mostrar("success", `Plan cambiado a ${planCode}`);
      await refetch();
    } catch (err) {
      if (err instanceof ApiDisabledError) mostrar("error", "API deshabilitada");
      else if (err instanceof ApiError) mostrar("error", err.message);
      else mostrar("error", "No pudimos cambiar de plan");
    } finally {
      setCambiando(null);
    }
  }

  const planActual = data?.subscription.planCode;
  const business = subscriptionPlans.business;
  const enterprise = subscriptionPlans.enterprise;

  const columnasFacturas: Columna<BillingOverview["invoices"][number]>[] = [
    {
      key: "numero",
      header: "Factura",
      cell: (r) => <span className="font-mono text-[12px]">{r.number}</span>,
    },
    {
      key: "plan",
      header: "Plan",
      cell: (r) => <Badge variant="info">{r.planCode}</Badge>,
    },
    {
      key: "periodo",
      header: "Período",
      cell: (r) => `${formatearFecha(r.periodStart)} → ${formatearFecha(r.periodEnd)}`,
    },
    {
      key: "monto",
      header: "Monto",
      align: "right",
      cell: (r) => formatearMoneda(Number(r.amountDue), r.currencyCode),
    },
    {
      key: "estado",
      header: "Estado",
      cell: (r) => (
        <Badge
          variant={
            r.status === "PAID" ? "success" : r.status === "PENDING" ? "warning" : "neutral"
          }
        >
          {r.status}
        </Badge>
      ),
    },
    {
      key: "accion",
      header: "",
      align: "right",
      cell: () => (
        <button
          type="button"
          className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
        >
          <Download size={14} />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="SaaS Billing"
        subtitle="Tu suscripción a Atria, plan actual e historial de cargos"
      />

      <ApiAviso apiDisabled={apiDisabled} error={error} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Plan actual"
          value={planActual ?? "—"}
          icon={Sparkles}
          hint={
            data?.subscription.expiresAt
              ? `Vence ${formatearFecha(data.subscription.expiresAt)}`
              : data?.subscription.status === "ACTIVE"
                ? "Suscripción activa"
                : loading
                  ? "Cargando..."
                  : "—"
          }
        />
        <KpiCard
          label="Usuarios"
          value={String(data?.usage.users ?? 0)}
          icon={Users}
          hint={
            planActual === "BUSINESS"
              ? `Límite: ${business.userLimit}`
              : "Ilimitados"
          }
        />
        <KpiCard
          label="Sucursales"
          value={String(data?.usage.branches ?? 0)}
          icon={Building2}
          hint={
            planActual === "BUSINESS"
              ? `Límite: ${business.branchLimit}`
              : "Ilimitadas"
          }
        />
      </div>

      <Card className="mt-6">
        <CardHeader title="Cambiar plan" subtitle="Sin contratos. Sube cuando lo necesites." />
        <CardBody>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {[business, enterprise].map((plan) => {
              const esActual = planActual === plan.code;
              return (
                <div
                  key={plan.code}
                  className={cn(
                    "flex flex-col rounded-lg border p-6 transition",
                    esActual
                      ? "border-[color:var(--color-primary)] bg-[color:var(--color-surface-2)]"
                      : "border-[color:var(--color-border)]",
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    {esActual && <Badge variant="success">Plan actual</Badge>}
                  </div>
                  <p className="text-small text-[color:var(--color-text-muted)]">
                    {plan.userLimit
                      ? `Hasta ${plan.userLimit} usuarios`
                      : "Usuarios ilimitados"}{" "}
                    ·{" "}
                    {plan.branchLimit
                      ? `${plan.branchLimit} sucursal`
                      : "Multi-sucursal"}
                  </p>
                  <ul className="my-5 flex-1 space-y-2 text-small">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check
                          size={14}
                          className="mt-0.5 flex-shrink-0 text-[color:var(--color-success)]"
                        />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={esActual ? "secondary" : "primary"}
                    disabled={esActual}
                    loading={cambiando === plan.code}
                    onClick={() => cambiarPlan(plan.code as "BUSINESS" | "ENTERPRISE")}
                  >
                    {esActual ? "Plan vigente" : `Cambiar a ${plan.name}`}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Historial de facturas"
          subtitle={`${data?.invoices.length ?? 0} cargos`}
        />
        <CardBody className="p-0">
          {!data?.invoices || data.invoices.length === 0 ? (
            <div className="px-5 py-8 text-center text-small text-[color:var(--color-text-muted)]">
              <FileText size={24} className="mx-auto mb-2 opacity-40" />
              Sin facturas aún
            </div>
          ) : (
            <DataTable
              data={data.invoices}
              columns={columnasFacturas}
              rowKey={(r) => r.id}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
