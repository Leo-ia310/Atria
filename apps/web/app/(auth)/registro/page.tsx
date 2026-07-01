"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { register, type RegisterPayload } from "@/lib/auth-client";
import { ApiError, ApiDisabledError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";

type Paso = 1 | 2 | 3;

const BUSINESS_TYPES = [
  { value: "HARDWARE", label: "Ferretería" },
  { value: "PHARMACY", label: "Farmacia" },
  { value: "RETAIL", label: "Tienda al detalle" },
  { value: "DISTRIBUTOR", label: "Distribuidora" },
  { value: "MEDICAL_SUPPLY", label: "Suministros médicos" },
  { value: "OTHER", label: "Otro" },
];

const COUNTRIES = [
  { value: "HN", currency: "HNL", timezone: "America/Tegucigalpa", label: "Honduras (HNL)" },
  { value: "NI", currency: "NIO", timezone: "America/Managua", label: "Nicaragua (NIO)" },
  { value: "GT", currency: "GTQ", timezone: "America/Guatemala", label: "Guatemala (GTQ)" },
  { value: "CR", currency: "CRC", timezone: "America/Costa_Rica", label: "Costa Rica (CRC)" },
  { value: "SV", currency: "USD", timezone: "America/El_Salvador", label: "El Salvador (USD)" },
];

const PASOS = [
  { num: 1, label: "Empresa" },
  { num: 2, label: "Admin" },
  { num: 3, label: "Sucursal" },
];

export default function RegistroPage() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>(1);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [form, setForm] = useState<RegisterPayload>({
    companyName: "",
    legalName: "",
    businessType: "RETAIL",
    countryCode: "NI",
    currencyCode: "NIO",
    timezone: "America/Managua",
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    primaryBranch: { name: "Sucursal Principal" },
  });

  function actualizarPais(codigo: string) {
    const cfg = COUNTRIES.find((c) => c.value === codigo);
    if (!cfg) return;
    setForm((f) => ({
      ...f,
      countryCode: cfg.value,
      currencyCode: cfg.currency,
      timezone: cfg.timezone,
    }));
  }

  async function enviar() {
    setErrorGlobal(null);
    setEnviando(true);
    try {
      await register(form);
      router.push("/app?bienvenida=1");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiDisabledError) {
        setErrorGlobal("API deshabilitada en este entorno. Activa API_ENABLED=true para registrarte.");
      } else if (err instanceof ApiError) {
        setErrorGlobal(err.message);
      } else {
        setErrorGlobal("No pudimos crear tu cuenta.");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="w-full max-w-[540px]">
      <div className="atria-card p-8">
        <ol className="mb-7 flex items-center gap-3">
          {PASOS.map((p, i) => {
            const completo = paso > p.num;
            const activo = paso === p.num;
            return (
              <li key={p.num} className="flex flex-1 items-center gap-2">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border text-[12px] font-semibold",
                    completo && "border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-white",
                    activo && !completo && "border-[color:var(--color-primary)] text-[color:var(--color-primary)]",
                    !activo && !completo && "border-[color:var(--color-border-strong)] text-[color:var(--color-text-muted)]",
                  )}
                >
                  {completo ? <Check size={14} /> : p.num}
                </div>
                <span
                  className={cn(
                    "text-[12px] font-medium uppercase tracking-wide",
                    activo
                      ? "text-[color:var(--color-text-primary)]"
                      : "text-[color:var(--color-text-muted)]",
                  )}
                >
                  {p.label}
                </span>
                {i < PASOS.length - 1 && (
                  <div className="ml-1 h-px flex-1 bg-[color:var(--color-border)]" />
                )}
              </li>
            );
          })}
        </ol>

        {paso === 1 && (
          <div className="space-y-4">
            <h1 className="text-xl">Cuéntanos de tu negocio</h1>
            <Input
              label="Nombre comercial"
              placeholder="La Esperanza"
              value={form.companyName}
              onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            />
            <Input
              label="Razón social"
              placeholder="Ferretería La Esperanza S.A."
              value={form.legalName}
              onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Rubro"
                value={form.businessType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, businessType: e.target.value as RegisterPayload["businessType"] }))
                }
                options={BUSINESS_TYPES}
              />
              <Select
                label="País"
                value={form.countryCode}
                onChange={(e) => actualizarPais(e.target.value)}
                options={COUNTRIES.map((c) => ({ value: c.value, label: c.label }))}
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setPaso(2)}
                disabled={!form.companyName || !form.legalName}
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-4">
            <h1 className="text-xl">Tu cuenta de administrador</h1>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Nombre"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              />
              <Input
                label="Apellido"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
            <Input
              label="Correo electrónico"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Input
              label="Contraseña"
              type="password"
              autoComplete="new-password"
              hint="Mínimo 10 caracteres"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setPaso(1)}>← Atrás</Button>
              <Button
                onClick={() => setPaso(3)}
                disabled={
                  !form.firstName ||
                  !form.lastName ||
                  !form.email ||
                  form.password.length < 10
                }
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {paso === 3 && (
          <div className="space-y-4">
            <h1 className="text-xl">Sucursal principal</h1>
            <p className="text-small text-[color:var(--color-text-muted)]">
              Crearemos automáticamente roles, almacén, formas de pago y catálogo de cuentas.
            </p>
            <Input
              label="Nombre de la sucursal"
              placeholder="Sucursal Principal"
              value={form.primaryBranch.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, primaryBranch: { name: e.target.value } }))
              }
            />

            {errorGlobal && (
              <div className="rounded-md bg-[color:var(--color-error-bg)] px-3 py-2 text-small text-[color:var(--color-error)]">
                {errorGlobal}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setPaso(2)} disabled={enviando}>
                ← Atrás
              </Button>
              <Button onClick={enviar} loading={enviando} disabled={!form.primaryBranch.name}>
                Crear cuenta
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-small text-[color:var(--color-text-muted)]">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-[color:var(--color-primary)] hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
