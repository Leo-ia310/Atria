"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Shield, Check } from "lucide-react";
import { crearRol, actualizarPermisosRol } from "@/lib/actions/configuracion";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

type Permiso = { id: string; clave: string; modulo: string; descripcion: string | null };
type Rol = {
  id: string;
  nombre: string;
  descripcion: string | null;
  esBase: boolean;
  permisoIds: string[];
};

function agrupar(permisos: Permiso[]) {
  const grupos: Record<string, Permiso[]> = {};
  for (const p of permisos) {
    (grupos[p.modulo] ??= []).push(p);
  }
  return Object.entries(grupos).sort((a, b) => a[0].localeCompare(b[0]));
}

export function RolesManager({
  roles,
  permisos,
}: {
  roles: Rol[];
  permisos: Permiso[];
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const grupos = useMemo(() => agrupar(permisos), [permisos]);

  const [editar, setEditar] = useState<Rol | null>(null);
  const [nuevo, setNuevo] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setNuevo(true)}>
          <Plus size={14} /> Nuevo rol
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((r) => (
          <Card key={r.id}>
            <CardBody>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-base font-semibold">
                  <Shield size={16} className="text-[color:var(--color-secondary)]" />
                  {r.nombre}
                </span>
                {r.esBase && <Badge variant="neutral">Base</Badge>}
              </div>
              {r.descripcion && (
                <p className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
                  {r.descripcion}
                </p>
              )}
              <div className="mt-2 text-[12px] text-[color:var(--color-text-muted)]">
                {r.permisoIds.length} de {permisos.length} permisos
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => setEditar(r)}
              >
                Editar permisos
              </Button>
            </CardBody>
          </Card>
        ))}
      </div>

      {editar && (
        <EditorPermisos
          key={editar.id}
          rol={editar}
          grupos={grupos}
          onCerrar={() => setEditar(null)}
          onGuardado={() => {
            setEditar(null);
            router.refresh();
          }}
          mostrar={mostrar}
        />
      )}

      {nuevo && (
        <NuevoRol
          grupos={grupos}
          onCerrar={() => setNuevo(false)}
          onCreado={() => {
            setNuevo(false);
            router.refresh();
          }}
          mostrar={mostrar}
        />
      )}
    </div>
  );
}

function ListaPermisos({
  grupos,
  seleccion,
  toggle,
}: {
  grupos: [string, Permiso[]][];
  seleccion: Set<string>;
  toggle: (id: string) => void;
}) {
  return (
    <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
      {grupos.map(([modulo, permisos]) => (
        <div key={modulo}>
          <div className="text-label mb-1.5 capitalize">{modulo}</div>
          <div className="space-y-1">
            {permisos.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-small hover:bg-[color:var(--color-surface-2)]"
              >
                <input
                  type="checkbox"
                  checked={seleccion.has(p.id)}
                  onChange={() => toggle(p.id)}
                  className="mt-0.5 rounded"
                />
                <span>
                  <span className="font-medium">{p.descripcion ?? p.clave}</span>
                  <span className="ml-1 font-mono text-[11px] text-[color:var(--color-text-muted)]">
                    {p.clave}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EditorPermisos({
  rol,
  grupos,
  onCerrar,
  onGuardado,
  mostrar,
}: {
  rol: Rol;
  grupos: [string, Permiso[]][];
  onCerrar: () => void;
  onGuardado: () => void;
  mostrar: (t: "success" | "error", m: string) => void;
}) {
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set(rol.permisoIds));
  const [guardando, setGuardando] = useState(false);

  function toggle(id: string) {
    setSeleccion((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  async function guardar() {
    setGuardando(true);
    const res = await actualizarPermisosRol(rol.id, [...seleccion]);
    setGuardando(false);
    if (!res.ok) return mostrar("error", res.error);
    mostrar("success", "Permisos actualizados");
    onGuardado();
  }

  return (
    <Modal
      abierto={true}
      onCerrar={onCerrar}
      titulo={`Permisos · ${rol.nombre}`}
      ancho="md"
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} loading={guardando}>
            <Check size={14} /> Guardar
          </Button>
        </>
      }
    >
      <ListaPermisos grupos={grupos} seleccion={seleccion} toggle={toggle} />
    </Modal>
  );
}

function NuevoRol({
  grupos,
  onCerrar,
  onCreado,
  mostrar,
}: {
  grupos: [string, Permiso[]][];
  onCerrar: () => void;
  onCreado: () => void;
  mostrar: (t: "success" | "error", m: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);

  function toggle(id: string) {
    setSeleccion((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  async function crear() {
    if (nombre.trim().length < 2) return mostrar("error", "Escribe el nombre del rol");
    setGuardando(true);
    const res = await crearRol({
      nombre,
      descripcion,
      permisoIds: [...seleccion],
    });
    setGuardando(false);
    if (!res.ok) return mostrar("error", res.error);
    mostrar("success", "Rol creado");
    onCreado();
  }

  return (
    <Modal
      abierto={true}
      onCerrar={onCerrar}
      titulo="Nuevo rol"
      ancho="md"
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={crear} loading={guardando}>
            Crear rol
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Input
            label="Descripción (opcional)"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>
        <div>
          <div className="text-label mb-2">Permisos</div>
          <ListaPermisos grupos={grupos} seleccion={seleccion} toggle={toggle} />
        </div>
      </div>
    </Modal>
  );
}
