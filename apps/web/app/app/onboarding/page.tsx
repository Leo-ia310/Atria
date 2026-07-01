"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Sparkles,
  Building2,
  Percent,
  Users,
  Package,
} from "lucide-react";
import { COUNTRIES_LIST, getCountryConfig, type CountryCode } from "@atria/contracts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useApi, ApiAviso } from "@/lib/use-api";
import { apiClient, ApiError, ApiDisabledError } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

type OnboardingState = {
  organization: {
    businessType: string;
    countryCode: string;
    currencyCode: string;
    timezone: string;
  };
  branch: { name: string } | null;
  completed: boolean;
};

type Tax = { code: string; name: string; rate: number; scope: "SALE" | "PURCHASE" | "BOTH" };
type InitialUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleKey: string;
  jobTitle?: string;
};
type InitialProduct = {
  id: string;
  name: string;
  sku: string;
  salePrice: number;
  costPrice: number;
  minStock: number;
  categoryName?: string;
};

const PASOS = [
  { num: 1, label: "Empresa", icon: Building2 },
  { num: 2, label: "Impuestos", icon: Percent },
  { num: 3, label: "Equipo", icon: Users },
  { num: 4, label: "Productos", icon: Package },
];

const BUSINESS_TYPES = [
  { value: "HARDWARE", label: "Ferretería" },
  { value: "PHARMACY", label: "Farmacia" },
  { value: "RETAIL", label: "Tienda al detalle" },
  { value: "DISTRIBUTOR", label: "Distribuidora" },
  { value: "MEDICAL_SUPPLY", label: "Suministros médicos" },
  { value: "OTHER", label: "Otro" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { mostrar } = useToast();
  const state = useApi<OnboardingState>("/onboarding/state");

  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(1);
  const [enviando, setEnviando] = useState(false);
  const [empresa, setEmpresa] = useState({
    businessType: "RETAIL",
    countryCode: "NI" as CountryCode,
    currencyCode: "NIO",
    timezone: "America/Managua",
    primaryBranchName: "Sucursal Principal",
  });
  const [taxes, setTaxes] = useState<Tax[]>([
    { code: "IVA15", name: "IVA", rate: 15, scope: "BOTH" },
  ]);
  const [users, setUsers] = useState<InitialUser[]>([]);
  const [products, setProducts] = useState<InitialProduct[]>([]);

  useEffect(() => {
    if (!state.data) return;
    if (state.data.completed) {
      router.replace("/app");
      return;
    }
    const cfg = getCountryConfig(state.data.organization.countryCode);
    setEmpresa((e) => ({
      ...e,
      businessType: state.data!.organization.businessType,
      countryCode: cfg.code,
      currencyCode: cfg.currency,
      timezone: cfg.timezone,
      primaryBranchName: state.data!.branch?.name ?? e.primaryBranchName,
    }));
    setTaxes([
      {
        code: cfg.taxCode,
        name: cfg.taxName,
        rate: cfg.taxRate * 100,
        scope: "BOTH",
      },
    ]);
  }, [state.data, router]);

  function actualizarPais(codigo: CountryCode) {
    const cfg = getCountryConfig(codigo);
    setEmpresa((e) => ({
      ...e,
      countryCode: cfg.code,
      currencyCode: cfg.currency,
      timezone: cfg.timezone,
    }));
    setTaxes([
      {
        code: cfg.taxCode,
        name: cfg.taxName,
        rate: cfg.taxRate * 100,
        scope: "BOTH",
      },
    ]);
  }

  async function completar() {
    setEnviando(true);
    try {
      await apiClient.post("/onboarding/complete", {
        businessType: empresa.businessType,
        countryCode: empresa.countryCode,
        currencyCode: empresa.currencyCode,
        timezone: empresa.timezone,
        primaryBranchName: empresa.primaryBranchName,
        taxes: taxes.map((t) => ({ ...t, rate: t.rate / 100 })),
        initialUsers: users.map(({ id, ...u }) => {
          void id;
          return u;
        }),
        initialProducts: products.map(({ id, ...p }) => {
          void id;
          return p;
        }),
      });
      mostrar("success", "Onboarding completado");
      router.replace("/app");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiDisabledError) mostrar("error", "API deshabilitada");
      else if (err instanceof ApiError) mostrar("error", err.message);
      else mostrar("error", "No pudimos completar el onboarding");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Configuremos Atria"
        subtitle="4 pasos rápidos antes de empezar a operar"
        actions={<Sparkles className="text-[color:var(--color-tertiary)]" size={20} />}
      />

      <ApiAviso apiDisabled={state.apiDisabled} error={state.error} />

      <ol className="mb-7 flex items-center gap-3">
        {PASOS.map((p, i) => {
          const completo = paso > p.num;
          const activo = paso === p.num;
          const Icon = p.icon;
          return (
            <li key={p.num} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border text-[12px] font-semibold",
                  completo && "border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-white",
                  activo && !completo && "border-[color:var(--color-primary)] text-[color:var(--color-primary)]",
                  !activo && !completo && "border-[color:var(--color-border-strong)] text-[color:var(--color-text-muted)]",
                )}
              >
                {completo ? <Check size={14} /> : <Icon size={14} />}
              </div>
              <span
                className={cn(
                  "text-[12px] font-medium uppercase tracking-wide hidden sm:inline",
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

      <Card>
        <CardBody>
          {paso === 1 && (
            <PasoEmpresa
              empresa={empresa}
              setEmpresa={setEmpresa}
              actualizarPais={actualizarPais}
              onSiguiente={() => setPaso(2)}
            />
          )}
          {paso === 2 && (
            <PasoImpuestos
              taxes={taxes}
              setTaxes={setTaxes}
              onAtras={() => setPaso(1)}
              onSiguiente={() => setPaso(3)}
            />
          )}
          {paso === 3 && (
            <PasoEquipo
              users={users}
              setUsers={setUsers}
              onAtras={() => setPaso(2)}
              onSiguiente={() => setPaso(4)}
            />
          )}
          {paso === 4 && (
            <PasoProductos
              products={products}
              setProducts={setProducts}
              enviando={enviando}
              onAtras={() => setPaso(3)}
              onCompletar={completar}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function PasoEmpresa({
  empresa,
  setEmpresa,
  actualizarPais,
  onSiguiente,
}: {
  empresa: {
    businessType: string;
    countryCode: CountryCode;
    currencyCode: string;
    timezone: string;
    primaryBranchName: string;
  };
  setEmpresa: (fn: (e: typeof empresa) => typeof empresa) => void;
  actualizarPais: (c: CountryCode) => void;
  onSiguiente: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Tu negocio</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="Rubro"
          value={empresa.businessType}
          onChange={(e) => setEmpresa((s) => ({ ...s, businessType: e.target.value }))}
          options={BUSINESS_TYPES}
        />
        <Select
          label="País"
          value={empresa.countryCode}
          onChange={(e) => actualizarPais(e.target.value as CountryCode)}
          options={COUNTRIES_LIST.map((c) => ({ value: c.code, label: c.name }))}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Moneda" value={empresa.currencyCode} disabled />
        <Input label="Zona horaria" value={empresa.timezone} disabled />
      </div>
      <Input
        label="Nombre de la sucursal principal"
        value={empresa.primaryBranchName}
        onChange={(e) => setEmpresa((s) => ({ ...s, primaryBranchName: e.target.value }))}
      />
      <div className="flex justify-end pt-3">
        <Button onClick={onSiguiente} disabled={!empresa.primaryBranchName}>
          Continuar <ArrowRight size={14} />
        </Button>
      </div>
    </div>
  );
}

function PasoImpuestos({
  taxes,
  setTaxes,
  onAtras,
  onSiguiente,
}: {
  taxes: Tax[];
  setTaxes: (t: Tax[]) => void;
  onAtras: () => void;
  onSiguiente: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Impuestos aplicables</h2>
      <p className="text-small text-[color:var(--color-text-muted)]">
        El primer impuesto será el predeterminado para nuevos productos.
      </p>
      {taxes.map((t, i) => (
        <div key={i} className="grid grid-cols-1 gap-2 rounded-md border border-[color:var(--color-border)] p-3 sm:grid-cols-4">
          <Input
            label="Código"
            value={t.code}
            onChange={(e) => setTaxes(taxes.map((x, idx) => (idx === i ? { ...x, code: e.target.value } : x)))}
          />
          <Input
            label="Nombre"
            value={t.name}
            onChange={(e) => setTaxes(taxes.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))}
          />
          <Input
            label="Tasa (%)"
            type="number"
            step="0.01"
            value={t.rate}
            onChange={(e) =>
              setTaxes(taxes.map((x, idx) => (idx === i ? { ...x, rate: parseFloat(e.target.value) || 0 } : x)))
            }
          />
          <div className="flex items-end gap-2">
            <Select
              label="Aplica a"
              value={t.scope}
              onChange={(e) =>
                setTaxes(
                  taxes.map((x, idx) => (idx === i ? { ...x, scope: e.target.value as Tax["scope"] } : x)),
                )
              }
              options={[
                { value: "SALE", label: "Venta" },
                { value: "PURCHASE", label: "Compra" },
                { value: "BOTH", label: "Ambas" },
              ]}
            />
            {taxes.length > 1 && (
              <button
                type="button"
                onClick={() => setTaxes(taxes.filter((_, idx) => idx !== i))}
                className="rounded p-2 text-[color:var(--color-error)] hover:bg-[color:var(--color-error-bg)]"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setTaxes([...taxes, { code: "", name: "", rate: 0, scope: "BOTH" }])}
      >
        <Plus size={14} /> Agregar impuesto
      </Button>
      <div className="flex justify-between pt-3">
        <Button variant="ghost" onClick={onAtras}>
          <ArrowLeft size={14} /> Atrás
        </Button>
        <Button onClick={onSiguiente}>
          Continuar <ArrowRight size={14} />
        </Button>
      </div>
    </div>
  );
}

function PasoEquipo({
  users,
  setUsers,
  onAtras,
  onSiguiente,
}: {
  users: InitialUser[];
  setUsers: (u: InitialUser[]) => void;
  onAtras: () => void;
  onSiguiente: () => void;
}) {
  function agregar() {
    setUsers([
      ...users,
      {
        id: crypto.randomUUID(),
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        roleKey: "worker",
        jobTitle: "",
      },
    ]);
  }

  function actualizar(id: string, cambios: Partial<InitialUser>) {
    setUsers(users.map((u) => (u.id === id ? { ...u, ...cambios } : u)));
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Tu equipo</h2>
      <p className="text-small text-[color:var(--color-text-muted)]">
        Opcional. Invita ahora o agrega después en /empleados.
      </p>
      {users.length === 0 ? (
        <p className="rounded-md bg-[color:var(--color-surface-2)] p-4 text-center text-small text-[color:var(--color-text-muted)]">
          Sin usuarios iniciales. Puedes saltar este paso.
        </p>
      ) : (
        users.map((u) => (
          <div key={u.id} className="space-y-3 rounded-md border border-[color:var(--color-border)] p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input
                label="Nombre"
                value={u.firstName}
                onChange={(e) => actualizar(u.id, { firstName: e.target.value })}
              />
              <Input
                label="Apellido"
                value={u.lastName}
                onChange={(e) => actualizar(u.id, { lastName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input
                label="Correo"
                type="email"
                value={u.email}
                onChange={(e) => actualizar(u.id, { email: e.target.value })}
              />
              <Input
                label="Contraseña inicial"
                type="text"
                value={u.password}
                onChange={(e) => actualizar(u.id, { password: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Select
                label="Rol"
                value={u.roleKey}
                onChange={(e) => actualizar(u.id, { roleKey: e.target.value })}
                options={[
                  { value: "owner", label: "Dueño" },
                  { value: "admin", label: "Administrador" },
                  { value: "accountant", label: "Contador" },
                  { value: "worker", label: "Operador" },
                ]}
              />
              <Input
                label="Cargo"
                value={u.jobTitle ?? ""}
                onChange={(e) => actualizar(u.id, { jobTitle: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setUsers(users.filter((x) => x.id !== u.id))}
                className="mt-6 rounded p-2 text-[color:var(--color-error)] hover:bg-[color:var(--color-error-bg)]"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))
      )}
      <Button variant="secondary" size="sm" onClick={agregar}>
        <Plus size={14} /> Agregar usuario
      </Button>
      <div className="flex justify-between pt-3">
        <Button variant="ghost" onClick={onAtras}>
          <ArrowLeft size={14} /> Atrás
        </Button>
        <Button onClick={onSiguiente}>
          Continuar <ArrowRight size={14} />
        </Button>
      </div>
    </div>
  );
}

function PasoProductos({
  products,
  setProducts,
  enviando,
  onAtras,
  onCompletar,
}: {
  products: InitialProduct[];
  setProducts: (p: InitialProduct[]) => void;
  enviando: boolean;
  onAtras: () => void;
  onCompletar: () => void;
}) {
  function agregar() {
    setProducts([
      ...products,
      {
        id: crypto.randomUUID(),
        name: "",
        sku: "",
        salePrice: 0,
        costPrice: 0,
        minStock: 0,
        categoryName: "",
      },
    ]);
  }

  function actualizar(id: string, cambios: Partial<InitialProduct>) {
    setProducts(products.map((p) => (p.id === id ? { ...p, ...cambios } : p)));
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Productos iniciales</h2>
      <p className="text-small text-[color:var(--color-text-muted)]">
        Opcional. Carga unos productos para arrancar o agrégalos después en /inventario.
      </p>
      {products.length === 0 ? (
        <p className="rounded-md bg-[color:var(--color-surface-2)] p-4 text-center text-small text-[color:var(--color-text-muted)]">
          Sin productos iniciales. Puedes terminar el onboarding y agregarlos después.
        </p>
      ) : (
        products.map((p) => (
          <div key={p.id} className="space-y-3 rounded-md border border-[color:var(--color-border)] p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Input
                label="SKU"
                value={p.sku}
                onChange={(e) => actualizar(p.id, { sku: e.target.value })}
              />
              <Input
                label="Nombre"
                value={p.name}
                onChange={(e) => actualizar(p.id, { name: e.target.value })}
              />
              <Input
                label="Categoría"
                value={p.categoryName ?? ""}
                onChange={(e) => actualizar(p.id, { categoryName: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Input
                label="Precio venta"
                type="number"
                step="0.01"
                value={p.salePrice}
                onChange={(e) => actualizar(p.id, { salePrice: parseFloat(e.target.value) || 0 })}
              />
              <Input
                label="Costo"
                type="number"
                step="0.01"
                value={p.costPrice}
                onChange={(e) => actualizar(p.id, { costPrice: parseFloat(e.target.value) || 0 })}
              />
              <Input
                label="Stock mín."
                type="number"
                value={p.minStock}
                onChange={(e) => actualizar(p.id, { minStock: parseFloat(e.target.value) || 0 })}
              />
              <button
                type="button"
                onClick={() => setProducts(products.filter((x) => x.id !== p.id))}
                className="mt-6 rounded p-2 text-[color:var(--color-error)] hover:bg-[color:var(--color-error-bg)]"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))
      )}
      <Button variant="secondary" size="sm" onClick={agregar}>
        <Plus size={14} /> Agregar producto
      </Button>
      <div className="flex justify-between pt-3">
        <Button variant="ghost" onClick={onAtras} disabled={enviando}>
          <ArrowLeft size={14} /> Atrás
        </Button>
        <Button onClick={onCompletar} loading={enviando}>
          <Check size={14} /> Completar onboarding
        </Button>
      </div>
    </div>
  );
}
