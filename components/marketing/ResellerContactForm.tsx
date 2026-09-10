"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";

type Estado = "idle" | "sending" | "success" | "error";

export function ResellerContactForm() {
  const [estado, setEstado] = useState<Estado>("idle");
  const [mensajeError, setMensajeError] = useState("");

  async function enviarSolicitud(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEstado("sending");
    setMensajeError("");

    const formulario = event.currentTarget;
    const datos = Object.fromEntries(new FormData(formulario));

    try {
      const respuesta = await fetch("/api/reseller", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      const cuerpo = (await respuesta.json()) as { error?: string };

      if (!respuesta.ok) {
        throw new Error(cuerpo.error || "No pudimos enviar tu solicitud.");
      }

      formulario.reset();
      setEstado("success");
    } catch (error) {
      setMensajeError(error instanceof Error ? error.message : "No pudimos enviar tu solicitud.");
      setEstado("error");
    }
  }

  if (estado === "success") {
    return (
      <div className="rounded-[10px] border border-emerald-300/30 bg-emerald-300/10 px-5 py-6 text-left">
        <Check className="h-5 w-5 text-emerald-300" aria-hidden="true" />
        <p className="mt-3 font-semibold text-white">Solicitud enviada</p>
        <p className="mt-1 text-sm leading-6 text-white/70">
          Gracias por tu interés. El equipo de ARCA te contactará pronto.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviarSolicitud} className="mt-8 grid gap-4 text-left" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-white/85">
          Nombre completo
          <input
            name="nombre"
            type="text"
            autoComplete="name"
            required
            maxLength={120}
            className="h-12 rounded-lg border border-white/15 bg-white/10 px-3 text-white outline-none transition focus:border-[#c4b5fd] focus:ring-2 focus:ring-[#c4b5fd]/25"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-white/85">
          Correo electrónico
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            className="h-12 rounded-lg border border-white/15 bg-white/10 px-3 text-white outline-none transition focus:border-[#c4b5fd] focus:ring-2 focus:ring-[#c4b5fd]/25"
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-white/85">
          Teléfono
          <input
            name="telefono"
            type="tel"
            autoComplete="tel"
            required
            maxLength={40}
            className="h-12 rounded-lg border border-white/15 bg-white/10 px-3 text-white outline-none transition focus:border-[#c4b5fd] focus:ring-2 focus:ring-[#c4b5fd]/25"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-white/85">
          Empresa o red de contactos
          <input
            name="empresa"
            type="text"
            autoComplete="organization"
            required
            maxLength={160}
            className="h-12 rounded-lg border border-white/15 bg-white/10 px-3 text-white outline-none transition focus:border-[#c4b5fd] focus:ring-2 focus:ring-[#c4b5fd]/25"
          />
        </label>
      </div>
      <label className="grid gap-2 text-sm font-medium text-white/85">
        Cuéntanos brevemente cómo conociste ARCA
        <textarea
          name="mensaje"
          rows={4}
          maxLength={1500}
          className="resize-y rounded-lg border border-white/15 bg-white/10 px-3 py-3 text-white outline-none transition focus:border-[#c4b5fd] focus:ring-2 focus:ring-[#c4b5fd]/25"
        />
      </label>
      <input name="sitioWeb" type="text" tabIndex={-1} autoComplete="off" className="sr-only" aria-hidden="true" />
      {estado === "error" ? <p className="text-sm text-red-300" role="alert">{mensajeError}</p> : null}
      <button
        type="submit"
        disabled={estado === "sending"}
        className="arca-btn arca-btn-lg justify-center bg-white text-[#160827] transition hover:-translate-y-0.5 hover:bg-[#efe7ff] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {estado === "sending" ? <LoaderCircle className="animate-spin" size={16} /> : <ArrowRight size={16} />}
        {estado === "sending" ? "Enviando..." : "Enviar solicitud"}
      </button>
    </form>
  );
}
