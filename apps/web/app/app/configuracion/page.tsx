"use client";

import { useEffect, useState } from "react";
import { Building2, Shield, Percent, Settings as SettingsIcon, Save } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useApi, ApiAviso } from "@/lib/use-api";
import { apiClient, ApiError, ApiDisabledError } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";

type CompanyResponse = {
  organization: {
    id: string;
    displayName: string;
    legalName: string;
    countryCode: string;
    currencyCode: string;
    timezone: string;
    businessType: string;
  };
  settings: {
    invoicePrefix: string | null;
    quotePrefix: string | null;
    themePrimary: string | null;
    themeSecondary: string | null;
    posAllowDiscounts: boolean;
    posRequireCustomer: boolean;
  };
  taxes: {
    id: string;
    code: string;
    name: string;
    rate: string | number;
    scope: string;
    isDefault: boolean;
  }[];
  subscription: {
    planCode: string;
    status: string;
    startedAt: string;
    expiresAt: string | null;
  } | null;
};

type Security = {
  totalDevices: number;
  activeDevices: number;
  passwordPolicies: string[];
};

export default function ConfiguracionPage() {
  const company = useApi<CompanyResponse>("/settings/company");
  const security = useApi<Security>("/settings/security");
  const { mostrar } = useToast();
  const [enviando, setEnviando] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    legalName: "",
    invoicePrefix: "",
    quotePrefix: "",
    posAllowDiscounts: true,
    posRequireCustomer: false,
  });

  useEffect(() => {
    if (company.data) {
      setForm({
        displayName: company.data.organization.displayName,
        legalName: company.data.organization.legalName,
        invoicePrefix: company.data.settings.invoicePrefix ?? "",
        quotePrefix: company.data.settings.quotePrefix ?? "",
        posAllowDiscounts: company.data.settings.posAllowDiscounts,
        posRequireCustomer: company.data.settings.posRequireCustomer,
      });
    }
  }, [company.data]);

  async function guardar() {
    setEnviando(true);
    try {
      await apiClient.patch("/settings/company", form);
      mostrar("success", "Configuración actualizada");
      await company.refetch();
    } catch (err) {
      if (err instanceof ApiDisabledError) mostrar("error", "API deshabilitada");
      else if (err instanceof ApiError) mostrar("error", err.message);
      else mostrar("error", "No pudimos guardar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Ajusta el sistema a tu operación" />

      <ApiAviso apiDisabled={company.apiDisabled} error={company.error} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Empresa" subtitle="Datos legales y comerciales" />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Nombre comercial"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              />
              <Input
                label="Razón social"
                value={form.legalName}
                onChange={(e) => setForm({ ...form, legalName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                label="País"
                value={company.data?.organization.countryCode ?? ""}
                disabled
              />
              <Input
                label="Moneda"
                value={company.data?.organization.currencyCode ?? ""}
                disabled
              />
              <Input
                label="Zona horaria"
                value={company.data?.organization.timezone ?? ""}
                disabled
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Suscripción" />
          <CardBody className="space-y-3 text-small">
            <Fila
              label="Plan"
              valor={
                <Badge variant="info">
                  {company.data?.subscription?.planCode ?? "—"}
                </Badge>
              }
            />
            <Fila
              label="Estado"
              valor={
                <Badge
                  variant={
                    company.data?.subscription?.status === "ACTIVE"
                      ? "success"
                      : company.data?.subscription?.status === "TRIAL"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {company.data?.subscription?.status ?? "—"}
                </Badge>
              }
            />
            <Fila
              label="Vence"
              valor={
                company.data?.subscription?.expiresAt
                  ? new Date(company.data.subscription.expiresAt).toLocaleDateString("es")
                  : "Sin vencimiento"
              }
            />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Facturación y POS" subtitle="Numeración y comportamiento" />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Prefijo facturas"
                placeholder="FAC-"
                value={form.invoicePrefix}
                onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })}
              />
              <Input
                label="Prefijo cotizaciones"
                placeholder="COT-"
                value={form.quotePrefix}
                onChange={(e) => setForm({ ...form, quotePrefix: e.target.value })}
              />
            </div>
            <div className="space-y-2 text-small">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.posAllowDiscounts}
                  onChange={(e) =>
                    setForm({ ...form, posAllowDiscounts: e.target.checked })
                  }
                />
                Permitir descuentos en el POS
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.posRequireCustomer}
                  onChange={(e) =>
                    setForm({ ...form, posRequireCustomer: e.target.checked })
                  }
                />
                Requerir cliente en cada venta
              </label>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Seguridad" />
          <CardBody className="space-y-3 text-small">
            <Fila
              label="Dispositivos totales"
              valor={String(security.data?.totalDevices ?? 0)}
            />
            <Fila
              label="Dispositivos activos"
              valor={String(security.data?.activeDevices ?? 0)}
            />
            {security.data?.passwordPolicies && (
              <div>
                <span className="text-[color:var(--color-text-muted)]">Políticas:</span>
                <ul className="mt-1 list-disc pl-4 text-[12px]">
                  {security.data.passwordPolicies.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Impuestos configurados" />
          <CardBody className="p-0">
            {!company.data?.taxes || company.data.taxes.length === 0 ? (
              <div className="px-5 py-6 text-center text-small text-[color:var(--color-text-muted)]">
                <Percent size={20} className="mx-auto mb-1 opacity-40" /> Sin impuestos
              </div>
            ) : (
              <table className="w-full text-small">
                <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
                  <tr className="text-label">
                    <th className="px-4 py-2 text-left">Código</th>
                    <th className="px-4 py-2 text-left">Nombre</th>
                    <th className="px-4 py-2 text-right">Tasa</th>
                    <th className="px-4 py-2 text-left">Aplica a</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {company.data.taxes.map((t) => (
                    <tr key={t.id} className="border-b border-[color:var(--color-border)] last:border-b-0">
                      <td className="px-4 py-2 font-mono text-[12px]">{t.code}</td>
                      <td className="px-4 py-2 font-medium">{t.name}</td>
                      <td className="px-4 py-2 text-right">{(Number(t.rate)).toFixed(2)}%</td>
                      <td className="px-4 py-2">
                        <Badge variant="neutral">{t.scope}</Badge>
                      </td>
                      <td className="px-4 py-2">
                        {t.isDefault && <Badge variant="success">Por defecto</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={guardar} loading={enviando}>
          <Save size={14} /> Guardar cambios
        </Button>
      </div>
    </div>
  );
}

function Fila({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[color:var(--color-text-muted)]">{label}</span>
      <span className="font-medium">{valor}</span>
    </div>
  );
}
