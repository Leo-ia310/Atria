"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  recuperarSolicitarSchema,
  recuperarCanjearSchema,
  type RecuperarSolicitarInput,
  type RecuperarCanjearInput,
} from "@/lib/validations/auth";
import {
  solicitarCodigoRecuperacion,
  canjearCodigoRecuperacion,
} from "@/lib/actions/recuperacion";

type Paso = "solicitar" | "codigo";

export default function RecuperarPage() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>("solicitar");
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [reenviado, setReenviado] = useState(false);

  const formSolicitar = useForm<RecuperarSolicitarInput>({
    resolver: zodResolver(recuperarSolicitarSchema),
  });

  const formCanjear = useForm<RecuperarCanjearInput>({
    resolver: zodResolver(recuperarCanjearSchema),
    defaultValues: { email: "", codigo: "", password: "", confirmarPassword: "" },
  });

  async function onSolicitar(values: RecuperarSolicitarInput) {
    setErrorGlobal(null);
    setEnviando(true);
    const res = await solicitarCodigoRecuperacion(values);
    setEnviando(false);
    if (!res.ok) {
      setErrorGlobal(res.error);
      return;
    }
    formCanjear.setValue("email", values.email);
    setPaso("codigo");
  }

  async function onCanjear(values: RecuperarCanjearInput) {
    setErrorGlobal(null);
    setEnviando(true);
    const res = await canjearCodigoRecuperacion(values);
    setEnviando(false);
    if (!res.ok) {
      setErrorGlobal(res.error);
      return;
    }
    router.push("/login?restablecida=1");
  }

  async function reenviarCodigo() {
    setErrorGlobal(null);
    setReenviado(false);
    const email = formCanjear.getValues("email");
    const res = await solicitarCodigoRecuperacion({ email });
    if (!res.ok) {
      setErrorGlobal(res.error);
      return;
    }
    setReenviado(true);
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="arca-card p-8">
        {paso === "solicitar" ? (
          <>
            <h1 className="text-xl text-[color:var(--color-text-primary)]">
              Recuperar contraseña
            </h1>
            <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
              Te enviaremos un código de 6 dígitos por correo para restablecerla.
            </p>

            <form
              onSubmit={formSolicitar.handleSubmit(onSolicitar)}
              className="mt-6 space-y-4"
            >
              <Input
                label="Correo electrónico"
                type="email"
                autoComplete="email"
                placeholder="tu@empresa.com"
                error={formSolicitar.formState.errors.email?.message}
                {...formSolicitar.register("email")}
              />

              {errorGlobal && (
                <div className="rounded-md bg-[color:var(--color-error-bg)] px-3 py-2 text-small text-[color:var(--color-error)]">
                  {errorGlobal}
                </div>
              )}

              <Button type="submit" className="w-full" loading={enviando}>
                Enviar código
              </Button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-xl text-[color:var(--color-text-primary)]">
              Ingresa tu código
            </h1>
            <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
              Si <strong>{formCanjear.getValues("email")}</strong> existe en ARCA, te
              llegó un código de 6 dígitos. Vence en 15 minutos.
            </p>

            <form
              onSubmit={formCanjear.handleSubmit(onCanjear)}
              className="mt-6 space-y-4"
            >
              <Input
                label="Código"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                error={formCanjear.formState.errors.codigo?.message}
                {...formCanjear.register("codigo")}
              />
              <Input
                label="Nueva contraseña"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                error={formCanjear.formState.errors.password?.message}
                {...formCanjear.register("password")}
              />
              <Input
                label="Confirmar contraseña"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                error={formCanjear.formState.errors.confirmarPassword?.message}
                {...formCanjear.register("confirmarPassword")}
              />

              {reenviado && (
                <div className="rounded-md bg-[color:var(--color-success-bg)] px-3 py-2 text-small text-[color:var(--color-success)]">
                  Te enviamos un nuevo código.
                </div>
              )}
              {errorGlobal && (
                <div className="rounded-md bg-[color:var(--color-error-bg)] px-3 py-2 text-small text-[color:var(--color-error)]">
                  {errorGlobal}
                </div>
              )}

              <Button type="submit" className="w-full" loading={enviando}>
                Restablecer contraseña
              </Button>

              <button
                type="button"
                onClick={reenviarCodigo}
                className="w-full text-center text-small text-[color:var(--color-secondary)] hover:underline"
              >
                Reenviar código
              </button>
            </form>
          </>
        )}
      </div>

      <p className="mt-6 text-center text-small text-[color:var(--color-text-muted)]">
        <Link
          href="/login"
          className="font-medium text-[color:var(--color-primary)] hover:underline"
        >
          ← Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}
