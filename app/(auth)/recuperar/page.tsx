"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function RecuperarPage() {
  const [enviado, setEnviado] = useState(false);

  return (
    <div className="w-full max-w-[420px]">
      <div className="arca-card p-8">
        <h1 className="text-xl text-[color:var(--color-text-primary)]">
          Recuperar contraseña
        </h1>
        <p className="mt-1 text-small text-[color:var(--color-text-muted)]">
          Te enviaremos un correo con un enlace para restablecerla.
        </p>

        {enviado ? (
          <div className="mt-6 rounded-md bg-[color:var(--color-success-bg)] px-4 py-3 text-small text-[color:var(--color-success)]">
            Si la cuenta existe, recibirás un correo en unos minutos.
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setEnviado(true);
            }}
            className="mt-6 space-y-4"
          >
            <Input
              label="Correo electrónico"
              type="email"
              placeholder="tu@empresa.com"
              required
            />
            <Button type="submit" className="w-full">
              Enviar enlace
            </Button>
          </form>
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
