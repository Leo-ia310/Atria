"use client";

import { useActionState } from "react";
import { PlusCircle } from "lucide-react";
import {
  crearGastoPlataformaAction,
  type SuperAdminActionState,
} from "@/lib/actions/superadmin";
import { cn } from "@/lib/utils";

const INITIAL_STATE: SuperAdminActionState = { ok: false, mensaje: "" };
const INPUT_CLASS =
  "w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:border-white/25";

export function PlatformExpenseForm() {
  const [state, action, pending] = useActionState(crearGastoPlataformaAction, INITIAL_STATE);
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center gap-2">
        <PlusCircle size={18} className="text-white/50" />
        <div>
          <h2 className="text-base font-semibold text-white">Registrar gasto</h2>
          <p className="text-[12px] text-white/45">Costos internos del SaaS: hosting, herramientas, soporte, ads.</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Fecha">
          <input name="fecha" type="date" defaultValue={hoy} className={INPUT_CLASS} />
        </Field>
        <Field label="Categoria">
          <input name="categoria" className={INPUT_CLASS} placeholder="Hosting, soporte, marketing" />
        </Field>
        <Field label="Proveedor">
          <input name="proveedor" className={INPUT_CLASS} placeholder="Vercel, Supabase, Meta..." />
        </Field>
        <Field label="Metodo de pago">
          <input name="metodoPago" className={INPUT_CLASS} placeholder="Tarjeta, transferencia, PayPal" />
        </Field>
        <Field label="Monto">
          <input name="monto" type="number" min="0" step="0.01" className={INPUT_CLASS} placeholder="0.00" />
        </Field>
        <Field label="Moneda">
          <select name="moneda" defaultValue="USD" className={INPUT_CLASS}>
            <option value="USD">USD</option>
            <option value="NIO">NIO</option>
            <option value="HNL">HNL</option>
            <option value="GTQ">GTQ</option>
            <option value="CRC">CRC</option>
          </select>
        </Field>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3">
        <Field label="Descripcion">
          <input name="descripcion" className={INPUT_CLASS} placeholder="Ej. servidor de produccion mensual" />
        </Field>
        <Field label="Notas">
          <textarea name="notas" className={cn(INPUT_CLASS, "min-h-20")} placeholder="Opcional" />
        </Field>
        <label className="flex items-center gap-2 text-[12px] text-white/65">
          <input name="recurrente" type="checkbox" />
          Gasto recurrente
        </label>
      </div>

      <button type="submit" disabled={pending} className="arca-btn mt-5 border-white/10 bg-white text-[#1A1225] hover:bg-white/90 disabled:opacity-60">
        {pending ? "Guardando..." : "Guardar gasto"}
      </button>

      {state.mensaje && (
        <p className={cn("mt-3 rounded-md border px-3 py-2 text-[12px]", state.ok ? "border-green-500/25 bg-green-500/10 text-green-200" : "border-red-500/25 bg-red-500/10 text-red-200")}>
          {state.mensaje}
        </p>
      )}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-medium uppercase tracking-wide text-white/45">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
