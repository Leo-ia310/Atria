"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
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
    const destino = params.get("redirect") ?? "/dashboard";
    router.push(destino);
    router.refresh();
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="atria-card p-8">
        <h1 className="text-xl text-[color:var(--color-text-primary)]">
          Inicia sesión
        </h1>
        <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
          Bienvenido de vuelta a ATRIA.
        </p>

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

          {errorGlobal && (
            <div className="rounded-md bg-[color:var(--color-error-bg)] px-3 py-2 text-small text-[color:var(--color-error)]">
              {errorGlobal}
            </div>
          )}

          <Button type="submit" className="w-full" loading={enviando}>
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

      <p className="mt-6 text-center text-small text-[color:var(--color-text-muted)]">
        ¿Aún no tienes cuenta?{" "}
        <Link
          href="/registro"
          className="font-medium text-[color:var(--color-primary)] hover:underline"
        >
          Crea una empresa
        </Link>
      </p>
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
