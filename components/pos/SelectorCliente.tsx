"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, User } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import type { ClientePOS } from "@/components/pos/POSContenedor";

function normalizarBusqueda(valor: string): string {
  return valor
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function SelectorCliente({
  clientes,
  clienteId,
  onChange,
  abierto,
  onAbrir,
  onCerrar,
}: {
  clientes: ClientePOS[];
  clienteId: string;
  onChange: (id: string) => void;
  abierto: boolean;
  onAbrir: () => void;
  onCerrar: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const busquedaRef = useRef<HTMLInputElement>(null);
  const cliente = clientes.find((c) => c.id === clienteId);

  useEffect(() => {
    if (!abierto) return;
    window.setTimeout(() => busquedaRef.current?.focus(), 0);
  }, [abierto]);

  const clientesFiltrados = useMemo(() => {
    const candidatos = clientes.filter((c) => !c.esConsumidorFinal);
    const consulta = normalizarBusqueda(busqueda);
    if (!consulta) return candidatos.sort((a, b) => a.nombre.localeCompare(b.nombre)).slice(0, 60);
    const tokens = consulta.split(/\s+/).filter(Boolean);
    return candidatos
      .map((c) => {
        const nombre = normalizarBusqueda(c.nombre);
        const identificacion = normalizarBusqueda(c.identificacionFiscal ?? "");
        const telefono = normalizarBusqueda(c.telefono ?? "");
        const email = normalizarBusqueda(c.email ?? "");
        const conjunto = `${nombre} ${identificacion} ${telefono} ${email}`;
        if (!tokens.every((token) => conjunto.includes(token))) return null;
        let puntaje = 0;
        if (nombre === consulta || identificacion === consulta) puntaje += 100;
        if (nombre.startsWith(consulta)) puntaje += 50;
        if (identificacion.startsWith(consulta) || telefono.startsWith(consulta)) puntaje += 35;
        if (email.startsWith(consulta)) puntaje += 20;
        return { cliente: c, puntaje };
      })
      .filter((resultado): resultado is { cliente: ClientePOS; puntaje: number } => Boolean(resultado))
      .sort((a, b) => b.puntaje - a.puntaje || a.cliente.nombre.localeCompare(b.cliente.nombre))
      .slice(0, 60)
      .map((resultado) => resultado.cliente);
  }, [busqueda, clientes]);

  function seleccionar(id: string) {
    onChange(id);
    setBusqueda("");
    onCerrar();
  }

  return (
    <div className="border-b border-[color:var(--color-border)] p-3">
      <button
        type="button"
        onClick={onAbrir}
        className="flex w-full items-center justify-between rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-small transition hover:border-[color:var(--color-border-strong)]"
      >
        <span className="flex items-center gap-2">
          <User size={14} className="text-[color:var(--color-text-muted)]" />
          {cliente?.nombre ?? "Consumidor final"}
        </span>
        <span className="text-[color:var(--color-text-muted)]">Cambiar (F4) →</span>
      </button>
      <Modal
        abierto={abierto}
        onCerrar={() => {
          setBusqueda("");
          onCerrar();
        }}
        titulo="Seleccionar cliente"
        descripcion="Busca por nombre, identificación fiscal, teléfono o correo."
        ancho="lg"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-muted)]"
            />
            <label htmlFor="pos-busqueda-clientes" className="sr-only">
              Buscar cliente
            </label>
            <input
              id="pos-busqueda-clientes"
              ref={busquedaRef}
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre, RUC, cédula, teléfono o correo..."
              className="arca-input arca-input-con-icono"
            />
          </div>
          <button
            type="button"
            onClick={() => seleccionar("")}
            className={cn(
              "w-full rounded-md border p-3 text-left transition",
              clienteId === ""
                ? "border-[color:var(--color-primary)] bg-[color:var(--color-surface-2)]"
                : "border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]",
            )}
          >
            <div className="font-medium">Consumidor final</div>
            <div className="text-[12px] text-[color:var(--color-text-muted)]">
              Sin datos fiscales · Solo contado
            </div>
          </button>
          <div className="max-h-[44vh] space-y-1 overflow-y-auto pr-1">
            {clientesFiltrados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => seleccionar(c.id)}
                className={cn(
                  "w-full rounded-md border p-3 text-left transition",
                  clienteId === c.id
                    ? "border-[color:var(--color-primary)] bg-[color:var(--color-surface-2)]"
                    : "border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{c.nombre}</span>
                  <span className="text-[12px] text-[color:var(--color-text-muted)]">
                    {c.tieneCredito ? `Crédito ${c.diasCredito} días` : "Solo contado"}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[color:var(--color-text-muted)]">
                  {c.identificacionFiscal && <span>{c.identificacionFiscal}</span>}
                  {c.telefono && <span>{c.telefono}</span>}
                  {c.email && <span>{c.email}</span>}
                </div>
              </button>
            ))}
            {clientesFiltrados.length === 0 && (
              <div className="py-6 text-center text-small text-[color:var(--color-text-muted)]">
                No encontramos clientes con todos esos datos.
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
