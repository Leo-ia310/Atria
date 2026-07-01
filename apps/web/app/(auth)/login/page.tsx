"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { login } from "@/lib/auth-client";
import { ApiError, ApiDisabledError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const schema = z.object({
  email: z.string().email("Correo no válido"),
  password: z.string().min(10, "Mínimo 10 caracteres"),
});

type LoginForm = z.infer<typeof schema>;

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginForm) {
    setErrorGlobal(null);
    setEnviando(true);
    try {
      const optionalSlug = params.get("tenant") ?? undefined;
      await login({ ...values, tenantSlug: optionalSlug });
      const destino = params.get("redirect") ?? "/app";
      router.push(destino);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiDisabledError) {
        setErrorGlobal("API deshabilitada en modo desarrollo. Activa API_ENABLED=true en apps/api/.env");
      } else if (err instanceof ApiError) {
        setErrorGlobal(err.message);
      } else {
        setErrorGlobal("No pudimos iniciar sesión. Intenta de nuevo.");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="atria-card p-8">
        <h1 className="text-xl text-[color:var(--color-text-primary)]">Inicia sesión</h1>
        <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
          Bienvenido de vuelta a Atria.
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
      </div>

      <p className="mt-6 text-center text-small text-[color:var(--color-text-muted)]">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/registro" className="font-medium text-[color:var(--color-primary)] hover:underline">
          Crea una empresa
        </Link>
      </p>
    </div>
  );
}
