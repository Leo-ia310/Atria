"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const restablecida = params.get("restablecida") === "1";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    if (!aceptaTerminos) {
      setErrorGlobal(
        "Debes aceptar los Términos y Condiciones y la Política de Privacidad para continuar.",
      );
      return;
    }
    setErrorGlobal(null);
    setEnviando(true);
    const res = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    setEnviando(false);
    if (res?.error) {
      setErrorGlobal("Correo o contraseña incorrectos");
      return;
    }
    const session = await getSession();
    const redirectParam = params.get("redirect");
    const destino = session?.user?.esSuperAdmin
      ? redirectParam?.startsWith("/superadmin")
        ? redirectParam
        : "/superadmin"
      : redirectParam ?? "/dashboard";
    router.push(destino);
    router.refresh();
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="arca-card p-8">
        <h1 className="text-xl text-[color:var(--color-text-primary)]">
          Inicia sesión
        </h1>
        <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
          Bienvenido de vuelta a ARCA.
        </p>

        {restablecida && (
          <div className="mt-4 rounded-md bg-[color:var(--color-success-bg)] px-3 py-2 text-small text-[color:var(--color-success)]">
            Contraseña actualizada. Inicia sesión con tu nueva contraseña.
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <Input
            label="Correo electrónico"
            type="email"
            autoComplete="email"
            placeholder="tu@empresa.com"
            error={errors.email?.message}
            {...register("email")}
          />
          <Input
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register("password")}
          />

          <label className="flex cursor-pointer items-start gap-2.5 text-small text-[color:var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={aceptaTerminos}
              onChange={(e) => setAceptaTerminos(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[color:var(--color-primary)]"
            />
            <span>
              Acepto los{" "}
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
            <div className="rounded-md bg-[color:var(--color-error-bg)] px-3 py-2 text-small text-[color:var(--color-error)]">
              {errorGlobal}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            loading={enviando}
            disabled={!aceptaTerminos}
          >
            Iniciar sesión
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-between text-small">
          <Link
            href="/recuperar"
            className="text-[color:var(--color-secondary)] hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3 border-t border-[color:var(--color-border)] pt-5">
        <span className="text-small text-[color:var(--color-text-muted)]">
          ¿Aún no tienes cuenta?
        </span>
        <Link href="/registro" className="arca-btn arca-btn-sm arca-btn-secondary">
          Regístrate
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
