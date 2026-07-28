"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { actualizarPerfil, cambiarMiPassword } from "@/lib/actions/configuracion";

export function PerfilForm({
  nombreInicial,
  telefonoInicial,
}: {
  nombreInicial: string;
  telefonoInicial: string;
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [nombre, setNombre] = useState(nombreInicial);
  const [telefono, setTelefono] = useState(telefonoInicial);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    const res = await actualizarPerfil({ nombre, telefono });
    setGuardando(false);
    if (!res.ok) return mostrar("error", res.error);
    mostrar("success", "Perfil actualizado");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader title="Datos personales" />
      <CardBody className="space-y-4">
        <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Input
          label="Teléfono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
        />
        <div className="flex justify-end">
          <Button onClick={guardar} loading={guardando}>
            Guardar cambios
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export function PasswordForm() {
  const { mostrar } = useToast();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    const res = await cambiarMiPassword({ actual, nueva, confirmar });
    setGuardando(false);
    if (!res.ok) return mostrar("error", res.error);
    mostrar("success", "Contraseña actualizada");
    setActual("");
    setNueva("");
    setConfirmar("");
  }

  return (
    <Card>
      <CardHeader title="Cambiar contraseña" />
      <CardBody className="space-y-4">
        <Input
          label="Contraseña actual"
          type="password"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Nueva contraseña"
            type="password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            hint="Mínimo 8 caracteres"
          />
          <Input
            label="Confirmar nueva contraseña"
            type="password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={guardar} loading={guardando}>
            Actualizar contraseña
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
