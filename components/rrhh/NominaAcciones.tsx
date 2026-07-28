"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Banknote, Trash2 } from "lucide-react";
import {
  aprobarNomina,
  pagarNomina,
  eliminarNominaBorrador,
} from "@/lib/actions/rrhh";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function NominaAcciones({
  nominaId,
  estado,
  cuentas,
}: {
  nominaId: string;
  estado: string;
  cuentas: { value: string; label: string }[];
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [pending, startTransition] = useTransition();
  const [modalPago, setModalPago] = useState(false);
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.value ?? "");

  function aprobar() {
    startTransition(async () => {
      const res = await aprobarNomina(nominaId);
      if (!res.ok) return mostrar("error", res.error);
      mostrar("success", "Nómina aprobada · asiento contable generado");
      router.refresh();
    });
  }

  function pagar() {
    if (!cuentaId) return mostrar("error", "Selecciona la cuenta de pago");
    startTransition(async () => {
      const res = await pagarNomina(nominaId, cuentaId);
      if (!res.ok) return mostrar("error", res.error);
      mostrar("success", "Nómina pagada · asiento de pago generado");
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
        <Button size="sm" onClick={aprobar} loading={pending}>
          <CheckCircle2 size={14} /> Aprobar
        </Button>
      </div>
    );
  }

  if (estado === "aprobada") {
    return (
      <>
        <Button size="sm" onClick={() => setModalPago(true)} disabled={pending}>
          <Banknote size={14} /> Registrar pago
        </Button>
        <Modal
          abierto={modalPago}
          onCerrar={() => setModalPago(false)}
          titulo="Pagar nómina"
          descripcion="Genera el asiento de pago desde la cuenta seleccionada"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalPago(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button onClick={pagar} loading={pending}>
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
