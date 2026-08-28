"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { actualizarPerfil, cambiarMiPassword } from "@/lib/actions/configuracion";

type PerfilFormProps = {
  nombreInicial: string;
  emailInicial: string;
  telefonoInicial: string;
};

export function PerfilForm(props: PerfilFormProps) {
  return (
    <PerfilFormInner
      key={`${props.nombreInicial}:${props.emailInicial}:${props.telefonoInicial}`}
      {...props}
    />
  );
}

function PerfilFormInner({
  nombreInicial,
  emailInicial,
  telefonoInicial,
}: PerfilFormProps) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [nombre, setNombre] = useState(() => nombreInicial);
  const [email, setEmail] = useState(() => emailInicial);
  const [telefono, setTelefono] = useState(() => telefonoInicial);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    const res = await actualizarPerfil({ nombre, email, telefono });
    setGuardando(false);
    if (!res.ok) return mostrar("error", res.error);
    mostrar("success", "Perfil actualizado");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader title="Datos personales" />
      <CardBody className="space-y-4">
        <Input
          label="Nombre"
          name="nombre"
          autoComplete="name"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Input
          label="Correo"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          hint="Lo usas para iniciar sesión"
        />
        <Input
          label="Teléfono"
          name="telefono"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
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
