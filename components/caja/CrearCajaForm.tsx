"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { crearCaja } from "@/lib/actions/caja";

export function CrearCajaForm() {
  const router = useRouter();
  const { mostrar } = useToast();
  const [enviando, setEnviando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");

  async function enviar() {
    if (!nombre.trim() || !codigo.trim()) {
      mostrar("warning", "Nombre y código son requeridos");
      return;
    }
    setEnviando(true);
    const res = await crearCaja({ nombre: nombre.trim(), codigo: codigo.trim() });
    setEnviando(false);
    if (!res.ok) {
      mostrar("error", res.error);
      return;
    }
    mostrar("success", "Caja creada");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader title="Crear caja" />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Caja 1"
          />
          <Input
            label="Código"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="CJ1"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={enviar} loading={enviando}>
            Crear caja
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
