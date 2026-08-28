"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import {
  actualizarTipoEmpresa,
  eliminarDatosRestaurante,
} from "@/lib/actions/configuracion";

type TipoEmpresa = "general" | "restaurante" | "retail" | "servicios";

type EmpresaTipoFormProps = {
  tipoInicial: TipoEmpresa;
  datosRestaurante: { menus: number; pedidos: number; dominio?: number; total: number };
  palabraConfirmacion: string;
};

export function EmpresaTipoForm(props: EmpresaTipoFormProps) {
  return (
    <EmpresaTipoFormInner
      key={`${props.tipoInicial}:${props.datosRestaurante.total}:${props.palabraConfirmacion}`}
      {...props}
    />
  );
}

function EmpresaTipoFormInner({
  tipoInicial,
  datosRestaurante,
  palabraConfirmacion,
}: EmpresaTipoFormProps) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [tipoEmpresa, setTipoEmpresa] = useState<TipoEmpresa>(() => tipoInicial);
  const [confirmacion, setConfirmacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const tieneDatosRestaurante = datosRestaurante.total > 0;
  const cambioBloqueado =
    tipoInicial === "restaurante" &&
    tipoEmpresa !== "restaurante" &&
    tieneDatosRestaurante;

  async function guardar() {
    if (cambioBloqueado) {
      mostrar(
        "warning",
        "Primero elimina los menus virtuales y pedidos de cocina.",
      );
      return;
    }
    setGuardando(true);
    const res = await actualizarTipoEmpresa({ tipoEmpresa });
    setGuardando(false);
    if (!res.ok) return mostrar("error", res.error);
    mostrar("success", "Tipo de empresa actualizado");
    if (tipoEmpresa === "restaurante") {
      router.replace("/restaurante?bienvenida=1");
      router.refresh();
      return;
    }
    router.refresh();
  }

  async function eliminarTodoRestaurante() {
    setEliminando(true);
    const res = await eliminarDatosRestaurante({
      reto: palabraConfirmacion,
      confirmacion,
    });
    setEliminando(false);
    if (!res.ok) return mostrar("error", res.error);
    mostrar("success", "Datos de restaurante eliminados");
    setConfirmacion("");
    router.refresh();
  }

  return (
    <>
      <Card>
      <CardHeader
        title="Vertical de negocio"
        subtitle="Restaurante abre el dashboard operativo propio de ARCA Restaurante."
      />
      <CardBody className="space-y-4">
        <Select
          label="Giro del negocio"
          value={tipoEmpresa}
          onChange={(e) => setTipoEmpresa(e.target.value as TipoEmpresa)}
          options={[
            { value: "general", label: "Comercio general" },
            { value: "restaurante", label: "Restaurante / cafeteria" },
            { value: "retail", label: "Tienda / retail" },
            { value: "servicios", label: "Servicios profesionales" },
          ]}
        />
        {cambioBloqueado && (
          <div className="rounded-md bg-[color:var(--color-warning-bg)] px-3 py-2 text-small text-[color:var(--color-warning)]">
            No puedes cambiar fuera de restaurante porque hay informacion creada.
            Elimina primero los datos operativos de restaurante.
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={guardar} loading={guardando} disabled={cambioBloqueado}>
            Guardar cambios
          </Button>
        </div>
      </CardBody>
      </Card>

      {tipoInicial === "restaurante" && tieneDatosRestaurante && (
        <Card>
          <CardHeader
            title="Eliminar datos de restaurante"
            subtitle="Borra menus, ordenes, comandas, mesas, recetas y CRM restaurante. Las ventas y facturas no se eliminan."
          />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-center text-small">
              <div className="rounded-md bg-[color:var(--color-surface-2)] p-3">
                <div className="text-lg font-semibold text-[color:var(--color-text-primary)]">
                  {datosRestaurante.menus}
                </div>
                <div className="text-[color:var(--color-text-muted)]">
                  Menus virtuales
                </div>
              </div>
              <div className="rounded-md bg-[color:var(--color-surface-2)] p-3">
                <div className="text-lg font-semibold text-[color:var(--color-text-primary)]">
                  {datosRestaurante.pedidos}
                </div>
                <div className="text-[color:var(--color-text-muted)]">
                  Pedidos cocina
                </div>
              </div>
              <div className="col-span-2 rounded-md bg-[color:var(--color-surface-2)] p-3">
                <div className="text-lg font-semibold text-[color:var(--color-text-primary)]">
                  {datosRestaurante.dominio ?? 0}
                </div>
                <div className="text-[color:var(--color-text-muted)]">
                  Ordenes ARCA Restaurante
                </div>
              </div>
            </div>

            <div className="rounded-md border border-[color:var(--color-error)]/30 bg-[color:var(--color-error-bg)] p-3 text-small text-[color:var(--color-error)]">
              Para confirmar, escribe exactamente:{" "}
              <span className="font-mono font-semibold">{palabraConfirmacion}</span>
            </div>

            <Input
              label="Palabra de confirmacion"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              autoComplete="off"
            />

            <div className="flex justify-end">
              <Button
                variant="danger"
                onClick={eliminarTodoRestaurante}
                loading={eliminando}
                disabled={confirmacion !== palabraConfirmacion}
              >
                Eliminar todo
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </>
  );
}
