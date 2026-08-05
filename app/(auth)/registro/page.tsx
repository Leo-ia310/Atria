"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Check } from "lucide-react";
import { registrarEmpresa } from "@/lib/actions/registro";
import { DESCUENTO_ANUAL_PORCENTAJE, PLANES_ARRAY } from "@/lib/pricing";
import { PAISES_ARRAY, PAIS_DEFAULT, type PaisCodigo, getPaisConfig } from "@/lib/paises";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn, formatearMoneda } from "@/lib/utils";

type Paso = 1 | 2 | 3;

type EstadoEmpresa = {
  razonSocial: string;
  nombreComercial: string;
  identificacionFiscal: string;
  tipoEmpresa: "general" | "restaurante" | "retail" | "servicios";
  pais: PaisCodigo;
  moneda: string;
};

type EstadoAdmin = {
  nombre: string;
  email: string;
  password: string;
  confirmarPassword: string;
};

type EstadoPlan = {
  planId: "demo" | "pro" | "enterprise";
  ciclo: "mensual" | "anual";
};

const PASOS = [
  { num: 1, label: "Empresa" },
  { num: 2, label: "Administrador" },
  { num: 3, label: "Plan" },
];

export default function RegistroPage() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>(1);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const paisDefault = getPaisConfig(PAIS_DEFAULT);
  const [empresa, setEmpresa] = useState<EstadoEmpresa>({
    razonSocial: "",
    nombreComercial: "",
    identificacionFiscal: "",
    tipoEmpresa: "general",
    pais: PAIS_DEFAULT,
    moneda: paisDefault.moneda,
  });
  const [admin, setAdmin] = useState<EstadoAdmin>({
    nombre: "",
    email: "",
    password: "",
    confirmarPassword: "",
  });
  const [plan, setPlan] = useState<EstadoPlan>({ planId: "demo", ciclo: "mensual" });
  const [aceptaTerminos, setAceptaTerminos] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const planParam = params.get("plan");
    const cicloParam = params.get("ciclo");
    setPlan((actual) => ({
      planId: planParam === "pro" || planParam === "enterprise" || planParam === "demo"
        ? planParam
        : actual.planId,
      ciclo: cicloParam === "anual" || cicloParam === "mensual" ? cicloParam : actual.ciclo,
    }));
  }, []);

  function actualizarPais(codigo: PaisCodigo) {
    const cfg = getPaisConfig(codigo);
    setEmpresa((e) => ({ ...e, pais: codigo, moneda: cfg.moneda }));
  }

  const paisConfig = getPaisConfig(empresa.pais);

  async function enviar() {
    if (!aceptaTerminos) {
      setErrorGlobal(
        "Debes aceptar los Términos y Condiciones y la Política de Privacidad para continuar.",
      );
      return;
    }
    setErrorGlobal(null);
    setEnviando(true);
    const res = await registrarEmpresa({ empresa, admin, plan, aceptaTerminos });
    if (!res.ok) {
      setErrorGlobal(res.error);
      setEnviando(false);
      return;
    }
    const login = await signIn("credentials", {
      email: admin.email,
      password: admin.password,
      redirect: false,
    });
    setEnviando(false);
    if (login?.error) {
      setErrorGlobal("Cuenta creada, pero no pudimos iniciar sesión. Intenta desde /login.");
      return;
    }
    router.push("/dashboard?bienvenida=1");
    router.refresh();
  }

  return (
    <div className="w-full max-w-[540px]">
      <div className="arca-card p-8">
        <ol className="mb-7 flex items-center gap-3">
          {PASOS.map((p, i) => {
            const completo = paso > p.num;
            const activo = paso === p.num;
            return (
              <li key={p.num} className="flex flex-1 items-center gap-2">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border text-[12px] font-semibold",
                    completo &&
                      "border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-white",
                    activo &&
                      !completo &&
                      "border-[color:var(--color-primary)] text-[color:var(--color-primary)]",
                    !activo &&
                      !completo &&
                      "border-[color:var(--color-border-strong)] text-[color:var(--color-text-muted)]",
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
          <div>
            <h1 className="text-xl text-[color:var(--color-text-primary)]">
              Cuéntanos de tu negocio
            </h1>
            <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
              Esto define tu moneda, impuestos y formato de facturación.
            </p>
            <div className="mt-6 space-y-4">
              <Input
                label="Razón social"
                placeholder="Ferretería La Esperanza S.A."
                value={empresa.razonSocial}
                onChange={(e) =>
                  setEmpresa((p) => ({ ...p, razonSocial: e.target.value }))
                }
              />
              <Input
                label="Nombre comercial (opcional)"
                placeholder="La Esperanza"
                value={empresa.nombreComercial}
                onChange={(e) =>
                  setEmpresa((p) => ({ ...p, nombreComercial: e.target.value }))
                }
              />
              <Select
                label="Tipo de empresa"
                value={empresa.tipoEmpresa}
                onChange={(e) =>
                  setEmpresa((p) => ({
                    ...p,
                    tipoEmpresa: e.target.value as EstadoEmpresa["tipoEmpresa"],
                  }))
                }
                options={[
                  { value: "general", label: "Comercio general" },
                  { value: "restaurante", label: "Restaurante / cafeteria" },
                  { value: "retail", label: "Tienda / retail" },
                  { value: "servicios", label: "Servicios profesionales" },
                ]}
                hint="Si eliges restaurante, ARCA activara menu virtual y pedidos de cocina."
              />
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="País"
                  value={empresa.pais}
                  onChange={(e) => actualizarPais(e.target.value as PaisCodigo)}
                  options={PAISES_ARRAY.map((p) => ({
                    value: p.codigo,
                    label: p.nombre,
                  }))}
                />
                <Input
                  label="Moneda"
                  value={empresa.moneda}
                  disabled
                  hint={`Auto según ${paisConfig.nombre}`}
                />
              </div>
              <Input
                label={`Identificación fiscal (${paisConfig.idFiscalNombre})`}
                placeholder={paisConfig.idFiscalNombre}
                value={empresa.identificacionFiscal}
                onChange={(e) =>
                  setEmpresa((p) => ({ ...p, identificacionFiscal: e.target.value }))
                }
                hint={`El impuesto principal será ${paisConfig.impuestoNombre} ${(paisConfig.tasaDefault * 100).toFixed(0)}%`}
              />
            </div>
            <div className="mt-7 flex justify-end">
              <Button
                onClick={() => setPaso(2)}
                disabled={
                  !empresa.razonSocial ||
                  !empresa.identificacionFiscal ||
                  empresa.razonSocial.length < 2
                }
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {paso === 2 && (
          <div>
            <h1 className="text-xl text-[color:var(--color-text-primary)]">
              Crea tu cuenta de administrador
            </h1>
            <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
              Tendrás acceso total al sistema. Después puedes invitar más usuarios.
            </p>
            <div className="mt-6 space-y-4">
              <Input
                label="Tu nombre"
                placeholder="Juan Pérez"
                autoComplete="name"
                value={admin.nombre}
                onChange={(e) => setAdmin((p) => ({ ...p, nombre: e.target.value }))}
              />
              <Input
                label="Correo electrónico"
                type="email"
                autoComplete="email"
                placeholder="juan@empresa.com"
                value={admin.email}
                onChange={(e) => setAdmin((p) => ({ ...p, email: e.target.value }))}
              />
              <Input
                label="Contraseña"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres, una mayúscula y un número"
                value={admin.password}
                onChange={(e) => setAdmin((p) => ({ ...p, password: e.target.value }))}
              />
              <Input
                label="Confirmar contraseña"
                type="password"
                autoComplete="new-password"
                value={admin.confirmarPassword}
                onChange={(e) =>
                  setAdmin((p) => ({ ...p, confirmarPassword: e.target.value }))
                }
                error={
                  admin.confirmarPassword && admin.password !== admin.confirmarPassword
                    ? "Las contraseñas no coinciden"
                    : undefined
                }
              />
            </div>
            <div className="mt-7 flex justify-between">
              <Button variant="ghost" onClick={() => setPaso(1)}>
                ← Atrás
              </Button>
              <Button
                onClick={() => setPaso(3)}
                disabled={
                  !admin.nombre ||
                  !admin.email ||
                  admin.password.length < 8 ||
                  admin.password !== admin.confirmarPassword
                }
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {paso === 3 && (
          <div>
            <h1 className="text-xl text-[color:var(--color-text-primary)]">
              Elige tu plan
            </h1>
            <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
              Puedes empezar gratis y subir cuando lo necesites.
            </p>

            <div className="mt-5 inline-flex rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-0.5 text-small">
              {(["mensual", "anual"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPlan((p) => ({ ...p, ciclo: c }))}
                  className={cn(
                    "rounded px-3 py-1 transition",
                    plan.ciclo === c
                      ? "bg-[color:var(--color-primary)] font-medium text-white shadow-sm"
                      : "text-[color:var(--color-text-muted)]",
                  )}
                >
                  {c === "mensual"
                    ? "Mensual"
                    : `Anual (-${DESCUENTO_ANUAL_PORCENTAJE}%)`}
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              {PLANES_ARRAY.map((p) => {
                const seleccionado = plan.planId === p.id;
                const precio = plan.ciclo === "anual" ? p.precioAnualMensualizado : p.precioMensual;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlan((s) => ({ ...s, planId: p.id }))}
                    className={cn(
                      "w-full rounded-md border p-4 text-left transition",
                      seleccionado
                        ? "border-[color:var(--color-primary)] bg-[color:var(--color-surface-2)] ring-2 ring-[color:var(--color-tertiary)]/40"
                        : "border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] hover:border-[color:var(--color-border-strong)]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-semibold text-[color:var(--color-text-primary)]">
                            {p.nombre}
                          </span>
                          {p.destacado && (
                            <span className="arca-badge arca-badge-info">Popular</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-small text-[color:var(--color-text-muted)]">
                          {p.descripcionCorta}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-semibold text-[color:var(--color-text-primary)]">
                          {precio === 0 ? "Gratis" : formatearMoneda(precio, "NI").replace("C$", "$")}
                        </div>
                        {precio > 0 && (
                          <div className="text-[11px] text-[color:var(--color-text-muted)]">
                            /mes
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <label className="mt-6 flex cursor-pointer items-start gap-2.5 text-small text-[color:var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={aceptaTerminos}
                onChange={(e) => setAceptaTerminos(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[color:var(--color-primary)]"
              />
              <span>
                He leído y acepto los{" "}
                <Link
                  href="/legal/terminos"
                  target="_blank"
                  className="font-medium text-[color:var(--color-primary)] hover:underline"
                >
                  Términos y Condiciones
                </Link>{" "}
                y la{" "}
                <Link
                  href="/legal/privacidad"
                  target="_blank"
                  className="font-medium text-[color:var(--color-primary)] hover:underline"
                >
                  Política de Privacidad
                </Link>
                .
              </span>
            </label>

            {errorGlobal && (
              <div className="mt-4 rounded-md bg-[color:var(--color-error-bg)] px-3 py-2 text-small text-[color:var(--color-error)]">
                {errorGlobal}
              </div>
            )}

            <div className="mt-7 flex justify-between">
              <Button variant="ghost" onClick={() => setPaso(2)} disabled={enviando}>
                ← Atrás
              </Button>
              <Button onClick={enviar} loading={enviando} disabled={!aceptaTerminos}>
                Crear cuenta
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-small text-[color:var(--color-text-muted)]">
        ¿Ya tienes cuenta?{" "}
        <Link
          href="/login"
          className="font-medium text-[color:var(--color-primary)] hover:underline"
        >
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
