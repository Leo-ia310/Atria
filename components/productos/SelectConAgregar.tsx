"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type Opcion = { value: string; label: string };

type CrearResultado =
  | { ok: true; id: string; nombre: string }
  | { ok: false; error: string };

export function SelectConAgregar({
  label,
  value,
  onChange,
  options: opcionesIniciales,
  tituloModal,
  onCrear,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Opcion[];
  tituloModal: string;
  onCrear: (nombre: string) => Promise<CrearResultado>;
}) {
  const { mostrar } = useToast();
  const [opcionesCreadas, setOpcionesCreadas] = useState<Opcion[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const opciones = useMemo(() => {
    const vistas = new Map(opcionesIniciales.map((opcion) => [opcion.value, opcion]));
    for (const opcion of opcionesCreadas) {
      if (!vistas.has(opcion.value)) vistas.set(opcion.value, opcion);
    }
    return Array.from(vistas.values());
  }, [opcionesIniciales, opcionesCreadas]);

  async function guardar() {
    const limpio = nombre.trim();
    if (!limpio) return;
    setGuardando(true);
    const res = await onCrear(limpio);
    setGuardando(false);
    if (!res.ok) {
      mostrar("error", res.error);
      return;
    }
    setOpcionesCreadas((prev) =>
      prev.some((o) => o.value === res.id)
        ? prev
        : [...prev, { value: res.id, label: res.nombre }],
    );
    onChange(res.id);
    setNombre("");
    setAbierto(false);
    mostrar("success", `"${res.nombre}" agregado`);
  }

  return (
    <div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Select
            label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            options={opciones}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setAbierto(true)}
          className="shrink-0"
          title={tituloModal}
        >
          <Plus size={16} />
        </Button>
      </div>

      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo={tituloModal}
        ancho="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAbierto(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={guardar} loading={guardando}>
              Guardar
            </Button>
          </>
        }
      >
        <Input
          label="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              guardar();
            }
          }}
          placeholder="Escribe el nombre…"
        />
      </Modal>
    </div>
  );
}
