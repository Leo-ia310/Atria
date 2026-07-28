"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { crearImpuesto } from "@/lib/actions/configuracion";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type Estado = {
  nombre: string;
  codigo: string;
  tasaPct: string;
  esRetencion: boolean;
};

const VACIO: Estado = { nombre: "", codigo: "", tasaPct: "", esRetencion: false };

export function CrearImpuestoForm({ tasaInssPct }: { tasaInssPct: number }) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [modal, setModal] = useState<Estado | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function enviar(estado: Estado) {
    setGuardando(true);
    const res = await crearImpuesto({
      nombre: estado.nombre,
      codigo: estado.codigo,
      tasa: (parseFloat(estado.tasaPct) || 0) / 100,
      esRetencion: estado.esRetencion,
    });
    setGuardando(false);
    if (!res.ok) return mostrar("error", res.error);
    mostrar("success", "Impuesto creado");
    setModal(null);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        onClick={() =>
          setModal({
            nombre: "INSS Laboral",
            codigo: "INSS",
            tasaPct: String((tasaInssPct * 100).toFixed(2)),
            esRetencion: true,
          })
        }
      >
        Agregar INSS
      </Button>
      <Button size="sm" onClick={() => setModal({ ...VACIO })}>
        <Plus size={14} /> Nuevo impuesto
      </Button>

      {modal && (
        <Modal
          abierto={true}
          onCerrar={() => setModal(null)}
          titulo="Nuevo impuesto"
          ancho="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModal(null)} disabled={guardando}>
                Cancelar
              </Button>
              <Button onClick={() => enviar(modal)} loading={guardando}>
                Guardar
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Código"
                value={modal.codigo}
                onChange={(e) => setModal({ ...modal, codigo: e.target.value.toUpperCase() })}
                placeholder="IVA15"
              />
              <div className="col-span-2">
                <Input
                  label="Nombre"
                  value={modal.nombre}
                  onChange={(e) => setModal({ ...modal, nombre: e.target.value })}
                  placeholder="IVA 15%"
                />
              </div>
            </div>
            <Input
              label="Tasa (%)"
              type="text"
              inputMode="decimal"
              value={modal.tasaPct}
              onChange={(e) =>
                setModal({ ...modal, tasaPct: e.target.value.replace(/[^0-9.]/g, "") })
              }
              placeholder="15"
              hint="Porcentaje. Ej. 15 para 15%, 7 para INSS."
            />
            <label className="flex items-center gap-2 text-small">
              <input
                type="checkbox"
                checked={modal.esRetencion}
                onChange={(e) => setModal({ ...modal, esRetencion: e.target.checked })}
                className="rounded"
              />
              Es retención (se resta, no se traslada)
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
