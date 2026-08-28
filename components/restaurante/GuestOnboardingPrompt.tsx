"use client";

import { useState, useTransition, type ReactNode } from "react";
import { X } from "lucide-react";
import { registrarComensalMenuPublico } from "@/lib/actions/restaurante-vertical";

export function GuestOnboardingPrompt({
  slug,
  colorPrimario,
}: {
  slug: string;
  colorPrimario: string;
}) {
  const [visible, setVisible] = useState(true);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [cumpleanos, setCumpleanos] = useState("");
  const [alergias, setAlergias] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!visible) return null;

  function enviar() {
    setError(null);
    setMensaje(null);
    startTransition(async () => {
      const res = await registrarComensalMenuPublico({
        slug,
        nombre,
        telefono,
        email,
        cumpleanos,
        alergias,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMensaje("Gracias. Ya puedes seguir viendo el menu.");
      window.setTimeout(() => setVisible(false), 900);
    });
  }

  return (
    <section className="px-5 py-4 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl rounded-md border border-black/10 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Hola, bienvenido</h2>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              Si es tu primera vez, puedes dejarnos unos datos para atenderte mejor.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-black/10 text-slate-600"
            aria-label="Cerrar"
          >
            <X size={17} />
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <PublicField label="Nombre">
            <input
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              className="rounded-md border border-black/10 px-3 py-2 text-sm"
            />
          </PublicField>
          <PublicField label="Telefono">
            <input
              value={telefono}
              onChange={(event) => setTelefono(event.target.value)}
              className="rounded-md border border-black/10 px-3 py-2 text-sm"
            />
          </PublicField>
          <PublicField label="Email">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-md border border-black/10 px-3 py-2 text-sm"
            />
          </PublicField>
          <PublicField label="Cumpleanos">
            <input
              value={cumpleanos}
              onChange={(event) => setCumpleanos(event.target.value)}
              type="date"
              className="rounded-md border border-black/10 px-3 py-2 text-sm"
            />
          </PublicField>
          <PublicField label="Alergias" className="md:col-span-3">
            <input
              value={alergias}
              onChange={(event) => setAlergias(event.target.value)}
              className="rounded-md border border-black/10 px-3 py-2 text-sm"
            />
          </PublicField>
          <button
            type="button"
            onClick={enviar}
            disabled={pending || nombre.trim().length < 2}
            className="self-end rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: colorPrimario }}
          >
            {pending ? "Guardando..." : "Continuar al menu"}
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        {mensaje && <p className="mt-3 text-sm text-emerald-700">{mensaje}</p>}
      </div>
    </section>
  );
}

function PublicField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
