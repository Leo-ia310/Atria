"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  crearFormaPago,
  actualizarFormaPago,
  eliminarFormaPago,
} from "@/lib/actions/configuracion";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

type Forma = {
  id: string;
  codigo: string;
  nombre: string;
  cuentaFinancieraId: string | null;
  cuentaFinanciera: string | null;
  requiereReferencia: boolean;
  activa: boolean;
};

type CuentaOpt = { value: string; label: string };

const VACIA = {
  id: "",
  codigo: "",
  nombre: "",
  cuentaFinancieraId: "",
  requiereReferencia: false,
};

export function FormasPagoManager({
  formas,
  cuentas,
}: {
  formas: Forma[];
  cuentas: CuentaOpt[];
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [modal, setModal] = useState<
    | null
    | {
        id: string;
        codigo: string;
        nombre: string;
        cuentaFinancieraId: string;
        requiereReferencia: boolean;
      }
  >(null);
  const [guardando, setGuardando] = useState(false);

  function abrirNueva() {
    setModal({ ...VACIA });
  }
  function abrirEditar(f: Forma) {
    setModal({
      id: f.id,
      codigo: f.codigo,
      nombre: f.nombre,
      cuentaFinancieraId: f.cuentaFinancieraId ?? "",
      requiereReferencia: f.requiereReferencia,
    });
  }

  async function guardar() {
    if (!modal) return;
    setGuardando(true);
    const payload = {
      codigo: modal.codigo,
      nombre: modal.nombre,
      cuentaFinancieraId: modal.cuentaFinancieraId,
      requiereReferencia: modal.requiereReferencia,
    };
    const res = modal.id
      ? await actualizarFormaPago(modal.id, payload)
      : await crearFormaPago(payload);
    setGuardando(false);
    if (!res.ok) return mostrar("error", res.error);
    mostrar("success", modal.id ? "Forma de pago actualizada" : "Forma de pago creada");
    setModal(null);
    router.refresh();
  }

  async function eliminar(f: Forma) {
    if (!confirm(`¿Desactivar la forma de pago "${f.nombre}"?`)) return;
    const res = await eliminarFormaPago(f.id);
    if (!res.ok) return mostrar("error", res.error);
    mostrar("success", "Forma de pago desactivada");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader
        title="Formas de pago"
        actions={
          <Button size="sm" onClick={abrirNueva}>
            <Plus size={14} /> Nueva
          </Button>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full text-small">
          <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]">
            <tr>
              <th className="text-label px-4 py-3 text-left">Código</th>
              <th className="text-label px-4 py-3 text-left">Nombre</th>
              <th className="text-label px-4 py-3 text-left">Cuenta financiera</th>
              <th className="text-label px-4 py-3 text-left">Referencia</th>
              <th className="text-label px-4 py-3 text-left">Estado</th>
              <th className="text-label px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {formas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[color:var(--color-text-muted)]">
                  No hay formas de pago. Crea la primera.
                </td>
              </tr>
            ) : (
              formas.map((f) => (
                <tr key={f.id} className="border-b border-[color:var(--color-border)] last:border-b-0">
                  <td className="px-4 py-2 font-mono text-[12px]">{f.codigo}</td>
                  <td className="px-4 py-2 font-medium">{f.nombre}</td>
                  <td className="px-4 py-2">
                    {f.cuentaFinanciera ?? (
                      <span className="italic text-[color:var(--color-text-muted)]">— Sin asignar</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {f.requiereReferencia ? (
                      <Badge variant="warning">Requerida</Badge>
                    ) : (
                      <Badge variant="neutral">No</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {f.activa ? (
                      <Badge variant="success">Activa</Badge>
                    ) : (
                      <Badge variant="neutral">Inactiva</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => abrirEditar(f)}
                        className="rounded p-1.5 text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-secondary)]"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      {f.activa && (
                        <button
                          type="button"
                          onClick={() => eliminar(f)}
                          className="rounded p-1.5 text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-error-bg)] hover:text-[color:var(--color-error)]"
                          title="Desactivar"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal
          abierto={true}
          onCerrar={() => setModal(null)}
          titulo={modal.id ? "Editar forma de pago" : "Nueva forma de pago"}
          ancho="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModal(null)} disabled={guardando}>
                Cancelar
              </Button>
              <Button onClick={guardar} loading={guardando}>
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
                placeholder="EFE"
              />
              <div className="col-span-2">
                <Input
                  label="Nombre"
                  value={modal.nombre}
                  onChange={(e) => setModal({ ...modal, nombre: e.target.value })}
                  placeholder="Efectivo"
                />
              </div>
            </div>
            <Select
              label="Cuenta financiera (opcional)"
              value={modal.cuentaFinancieraId}
              onChange={(e) => setModal({ ...modal, cuentaFinancieraId: e.target.value })}
              options={[{ value: "", label: "Sin asignar" }, ...cuentas]}
            />
            <label className="flex items-center gap-2 text-small">
              <input
                type="checkbox"
                checked={modal.requiereReferencia}
                onChange={(e) => setModal({ ...modal, requiereReferencia: e.target.checked })}
                className="rounded"
              />
              Requiere número de referencia / autorización
            </label>
          </div>
        </Modal>
      )}
    </Card>
  );
}
