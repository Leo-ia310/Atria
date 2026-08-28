"use client";

import { useState } from "react";
import Link from "next/link";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { abrirSesion } from "@/lib/actions/caja";

export function ModalAbrirCaja({
  cajas,
  onMasTarde,
  onAbierta,
  onError,
}: {
  cajas: { value: string; label: string }[];
  onMasTarde: () => void;
  onAbierta: () => void;
  onError: (msg: string) => void;
}) {
  const [cajaId, setCajaId] = useState(cajas[0]?.value ?? "");
  const [montoStr, setMontoStr] = useState("0");
  const [abriendo, setAbriendo] = useState(false);

  async function abrir() {
    if (!cajaId) return;
    setAbriendo(true);
    const res = await abrirSesion({
      cajaId,
      montoInicial: parseFloat(montoStr) || 0,
    });
    setAbriendo(false);
    if (!res.ok) {
      onError(res.error);
      return;
    }
    onAbierta();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-[color:var(--color-text-primary)] shadow-2xl">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[color:var(--color-tertiary)]/15 text-[color:var(--color-primary)]">
            <Store size={18} />
          </div>
          <h2 className="text-lg font-semibold">Abrir caja</h2>
        </div>
        <p className="mb-4 text-small text-[color:var(--color-text-muted)]">
          Para registrar ventas y generar facturas necesitas una caja abierta.
        </p>

        {cajas.length === 0 ? (
          <div className="rounded-md bg-[color:var(--color-warning)]/10 p-3 text-small">
            No hay cajas configuradas.{" "}
            <Link href="/configuracion/cajas" className="font-medium text-[color:var(--color-primary)] underline">
              Crear una caja
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <Select
              label="Caja"
              value={cajaId}
              onChange={(e) => setCajaId(e.target.value)}
              options={cajas}
            />
            <Input
              label="Monto inicial en caja"
              type="text"
              inputMode="decimal"
              value={montoStr}
              onChange={(e) => setMontoStr(e.target.value.replace(/[^0-9.]/g, ""))}
              onFocus={(e) => e.target.select()}
              hint="Efectivo con el que abres la caja"
            />
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={onMasTarde} disabled={abriendo}>
            Abrir más tarde
          </Button>
          {cajas.length > 0 && (
            <Button onClick={abrir} loading={abriendo} disabled={!cajaId}>
              <Store size={14} /> Abrir caja
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
