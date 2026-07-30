"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Banknote, Trash2, Lock } from "lucide-react";
import {
  verificarNomina,
  finalizarPagoNomina,
  eliminarNominaBorrador,
} from "@/lib/actions/rrhh";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function NominaAcciones({
  nominaId,
  estado,
  nivelVerificacion,
  cuentas,
}: {
  nominaId: string;
  estado: string;
  nivelVerificacion: number;
  cuentas: { value: string; label: string }[];
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [pending, startTransition] = useTransition();
  const [modalPago, setModalPago] = useState(false);
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.value ?? "");

  function verificar() {
    startTransition(async () => {
      const res = await verificarNomina(nominaId);
      if (!res.ok) return mostrar("error", res.error);
      if (res.bloqueada) {
        mostrar("success", "Verificación 3/3 · nómina bloqueada y asiento generado");
      } else {
        mostrar(
          "success",
          `Verificación ${res.nivel}/3 registrada${res.nivel === 1 ? " · ahora agrega deducciones si aplica" : ""}`,
        );
      }
      router.refresh();
    });
  }

  function pagarTodos() {
    if (!cuentaId) return mostrar("error", "Selecciona la cuenta de pago");
    startTransition(async () => {
      const res = await finalizarPagoNomina(nominaId, cuentaId);
      if (!res.ok) return mostrar("error", res.error);
      mostrar("success", "Nómina pagada a todos · asiento de pago generado");
      setModalPago(false);
      router.refresh();
    });
  }

  function eliminar() {
    startTransition(async () => {
      const res = await eliminarNominaBorrador(nominaId);
      if (!res.ok) return mostrar("error", res.error);
      mostrar("success", "Nómina eliminada");
      router.push("/rrhh/nomina");
      router.refresh();
    });
  }

  if (estado === "borrador") {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={eliminar} disabled={pending}>
          <Trash2 size={14} /> Eliminar
        </Button>
        <Button size="sm" onClick={verificar} loading={pending}>
          <ShieldCheck size={14} /> Verificar ({nivelVerificacion}/3)
        </Button>
      </div>
    );
  }

  if (estado === "aprobada") {
    return (
      <>
        <span className="inline-flex items-center gap-1 text-[12px] text-[color:var(--color-text-muted)]">
          <Lock size={12} /> Bloqueada
        </span>
        <Button size="sm" onClick={() => setModalPago(true)} disabled={pending}>
          <Banknote size={14} /> Pagar a todos
        </Button>
        <Modal
          abierto={modalPago}
          onCerrar={() => setModalPago(false)}
          titulo="Pagar nómina a todos"
          descripcion="Marca todos los recibos como pagados y genera el asiento de pago"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalPago(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button onClick={pagarTodos} loading={pending}>
                Confirmar pago
              </Button>
            </>
          }
        >
          {cuentas.length === 0 ? (
            <p className="text-small text-[color:var(--color-text-muted)]">
              No hay cuentas financieras activas. Crea una en Tesorería o Configuración.
            </p>
          ) : (
            <Select
              label="Cuenta de pago"
              options={cuentas}
              value={cuentaId}
              onChange={(e) => setCuentaId(e.target.value)}
            />
          )}
        </Modal>
      </>
    );
  }

  return null;
}
