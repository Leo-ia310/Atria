"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { crearCaja } from "@/lib/actions/caja";

export function CrearCajaForm({
  sucursales,
  defaultSucursalId,
}: {
  sucursales: { value: string; label: string }[];
  defaultSucursalId?: string;
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [enviando, setEnviando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [sucursalId, setSucursalId] = useState(defaultSucursalId ?? sucursales[0]?.value ?? "");

  async function enviar() {
    if (!nombre.trim() || !codigo.trim()) {
      mostrar("warning", "Nombre y codigo son requeridos");
      return;
    }
    if (!sucursalId) {
      mostrar("warning", "Selecciona una sucursal");
      return;
    }

    setEnviando(true);
    const res = await crearCaja({
      nombre: nombre.trim(),
      codigo: codigo.trim(),
      sucursalId,
    });
    setEnviando(false);
    if (!res.ok) {
      mostrar("error", res.error);
      return;
    }

    mostrar("success", "Caja creada");
    setNombre("");
    setCodigo("");
    router.refresh();
  }

  const sinSucursales = sucursales.length === 0;

  return (
    <Card>
      <CardHeader title="Crear caja" />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select
            label="Sucursal"
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            options={sucursales}
            placeholder="Selecciona una sucursal"
            disabled={sinSucursales}
          />
          <Input
            label="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Caja 1"
          />
          <Input
            label="Codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
            placeholder="CJ2"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={enviar} loading={enviando} disabled={sinSucursales}>
            Crear caja
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
