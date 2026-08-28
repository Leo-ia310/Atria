"use client";

import { useActionState, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, CreditCard, PauseCircle, Trash2 } from "lucide-react";
import {
  activarMembresiaManualAction,
  borrarEmpresaCompletaAction,
  suspenderEmpresaAction,
  type SuperAdminActionState,
} from "@/lib/actions/superadmin";
import { getPlan, type PlanId } from "@/lib/pricing";
import { cn } from "@/lib/utils";

const INITIAL_STATE: SuperAdminActionState = { ok: false, mensaje: "" };
const INPUT_CLASS =
  "w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:border-white/25";

type TenantInfo = {
  id: string;
  razonSocial: string;
};

export function TenantAdminActions({ tenant }: { tenant: TenantInfo }) {
  const [panel, setPanel] = useState<"activar" | "suspender" | "borrar" | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <ActionButton
          active={panel === "activar"}
          onClick={() => setPanel(panel === "activar" ? null : "activar")}
          icon={CreditCard}
          label="Activar"
        />
        <ActionButton
          active={panel === "suspender"}
          onClick={() => setPanel(panel === "suspender" ? null : "suspender")}
          icon={PauseCircle}
          label="Suspender"
          tone="warning"
        />
        <ActionButton
          active={panel === "borrar"}
          onClick={() => setPanel(panel === "borrar" ? null : "borrar")}
          icon={Trash2}
          label="Borrar"
          tone="danger"
        />
      </div>

      {panel === "activar" && <ActivarForm tenant={tenant} />}
      {panel === "suspender" && <SuspenderForm tenant={tenant} />}
      {panel === "borrar" && <BorrarForm tenant={tenant} />}
    </div>
  );
}

function ActivarForm({ tenant }: { tenant: TenantInfo }) {
  const [state, action, pending] = useActionState(activarMembresiaManualAction, INITIAL_STATE);
  const [planId, setPlanId] = useState<Exclude<PlanId, "demo">>("pro");
  const [ciclo, setCiclo] = useState<"mensual" | "anual">("mensual");
  const monto = useMemo(() => {
    const plan = getPlan(planId);
    if (ciclo === "anual") return plan.precioAnual.toFixed(2);
    return plan.precioMensual.toFixed(2);
  }, [planId, ciclo]);
  const codigo = `PAGO ${shortCode(tenant.id)}`;

  return (
    <Panel tone="success" title="Activar membresia por transferencia">
      <form action={action} className="space-y-3">
        <input type="hidden" name="empresaId" value={tenant.id} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Plan">
            <select
              name="planId"
              value={planId}
              onChange={(e) => setPlanId(e.target.value as Exclude<PlanId, "demo">)}
              className={INPUT_CLASS}
            >
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </Field>
          <Field label="Ciclo">
            <select
              name="ciclo"
              value={ciclo}
              onChange={(e) => setCiclo(e.target.value as "mensual" | "anual")}
              className={INPUT_CLASS}
            >
              <option value="mensual">Mensual</option>
              <option value="anual">Anual</option>
            </select>
          </Field>
          <Field label="Monto USD">
            <input name="monto" className={INPUT_CLASS} defaultValue={monto} key={monto} />
          </Field>
        </div>
        <Field label="Referencia de transferencia">
          <input name="referencia" className={INPUT_CLASS} />
        </Field>
        <Field label="Notas internas">
          <textarea name="notas" className={cn(INPUT_CLASS, "min-h-16")} />
        </Field>
        <TripleConfirm tenant={tenant} accion="ACTIVAR" codigo={codigo} />
        <Submit pending={pending} label="Activar membresia" tone="success" />
        <ActionState state={state} />
      </form>
    </Panel>
  );
}

function SuspenderForm({ tenant }: { tenant: TenantInfo }) {
  const [state, action, pending] = useActionState(suspenderEmpresaAction, INITIAL_STATE);
  const codigo = `SUSPENDER ${shortCode(tenant.id)}`;

  return (
    <Panel tone="warning" title="Suspender negocio">
      <form action={action} className="space-y-3">
        <input type="hidden" name="empresaId" value={tenant.id} />
        <Field label="Motivo">
          <textarea name="motivo" className={cn(INPUT_CLASS, "min-h-16")} />
        </Field>
        <TripleConfirm tenant={tenant} accion="SUSPENDER" codigo={codigo} />
        <Submit pending={pending} label="Suspender negocio" tone="warning" />
        <ActionState state={state} />
      </form>
    </Panel>
  );
}

function BorrarForm({ tenant }: { tenant: TenantInfo }) {
  const [state, action, pending] = useActionState(borrarEmpresaCompletaAction, INITIAL_STATE);
  const codigo = `BORRAR ${shortCode(tenant.id)}`;

  return (
    <Panel tone="danger" title="Borrar todos los datos del negocio">
      <div className="mb-3 flex items-start gap-2 rounded-md border border-red-500/25 bg-red-500/10 p-3 text-[12px] text-red-100">
        <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-red-300" />
        <p>
          Esta accion elimina empresa, usuarios, ventas, inventario, contabilidad, facturas,
          pagos y configuraciones asociadas. No es reversible desde esta consola.
        </p>
      </div>
      <form action={action} className="space-y-3">
        <input type="hidden" name="empresaId" value={tenant.id} />
        <Field label="Motivo">
          <textarea name="motivo" className={cn(INPUT_CLASS, "min-h-16")} />
        </Field>
        <TripleConfirm tenant={tenant} accion="BORRAR" codigo={codigo} />
        <Submit pending={pending} label="Borrar datos" tone="danger" />
        <ActionState state={state} />
      </form>
    </Panel>
  );
}

function TripleConfirm({
  tenant,
  accion,
  codigo,
}: {
  tenant: TenantInfo;
  accion: "ACTIVAR" | "SUSPENDER" | "BORRAR";
  codigo: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-2">
      <Field label={`1. Escribe: ${tenant.razonSocial}`}>
        <input name="confirmarEmpresa" className={INPUT_CLASS} autoComplete="off" />
      </Field>
      <Field label={`2. Escribe: ${accion}`}>
        <input name="confirmarAccion" className={cn(INPUT_CLASS, "uppercase")} autoComplete="off" />
      </Field>
      <Field label={`3. Escribe: ${codigo}`}>
        <input name="confirmarCodigo" className={cn(INPUT_CLASS, "uppercase")} autoComplete="off" />
      </Field>
      <label className="flex items-start gap-2 rounded-md border border-white/10 bg-white/[0.03] p-2 text-[12px] text-white/70">
        <input name="confirmoImpacto" type="checkbox" className="mt-0.5" />
        Entiendo el impacto operativo de esta accion y deseo ejecutarla.
      </label>
    </div>
  );
}

function ActionButton({
  active,
  onClick,
  icon: Icon,
  label,
  tone = "neutral",
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  tone?: "neutral" | "warning" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] transition",
        active ? "bg-white/15 text-white" : "bg-white/[0.03] text-white/70 hover:bg-white/10 hover:text-white",
        tone === "neutral" && "border-white/10",
        tone === "warning" && "border-yellow-500/25",
        tone === "danger" && "border-red-500/25",
      )}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function Panel({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "success" | "warning" | "danger";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        tone === "success" && "border-green-500/20 bg-green-500/5",
        tone === "warning" && "border-yellow-500/20 bg-yellow-500/5",
        tone === "danger" && "border-red-500/20 bg-red-500/5",
      )}
    >
      <div className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-white/70">
        {title}
      </div>
      {children}
    </div>
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

function Submit({
  pending,
  label,
  tone,
}: {
  pending: boolean;
  label: string;
  tone: "success" | "warning" | "danger";
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60",
        tone === "success" && "bg-green-600 hover:bg-green-500",
        tone === "warning" && "bg-yellow-600 hover:bg-yellow-500",
        tone === "danger" && "bg-red-600 hover:bg-red-500",
      )}
    >
      {pending ? "Procesando..." : label}
    </button>
  );
}

function ActionState({ state }: { state: SuperAdminActionState }) {
  if (!state.mensaje) return null;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]",
        state.ok
          ? "border-green-500/25 bg-green-500/10 text-green-200"
          : "border-red-500/25 bg-red-500/10 text-red-200",
      )}
    >
      {state.ok && <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />}
      <span>{state.mensaje}</span>
    </div>
  );
}

function shortCode(id: string): string {
  return id.slice(0, 8).toUpperCase();
}
