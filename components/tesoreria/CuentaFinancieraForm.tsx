"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { crearCuentaFinanciera } from "@/lib/actions/tesoreria";

type Opcion = { value: string; label: string };

const TIPO_OPCIONES = [
  { value: "caja", label: "Caja (efectivo)" },
  { value: "banco", label: "Cuenta bancaria" },
  { value: "tarjeta", label: "Tarjeta de crédito/débito" },
  { value: "wallet", label: "Wallet / pago electrónico" },
];

export function CuentaFinancieraForm({
  moneda,
  cuentasContables,
}: {
  moneda: string;
  cuentasContables: Opcion[];
}) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [enviando, setEnviando] = useState(false);

  const [tipo, setTipo] = useState<"caja" | "banco" | "tarjeta" | "wallet">("caja");
  const [nombre, setNombre] = useState("");
  const [banco, setBanco] = useState("");
  const [numeroCuenta, setNumeroCuenta] = useState("");
  const [saldoInicial, setSaldoInicial] = useState<number | "">("");
  const [cuentaContableId, setCuentaContableId] = useState(cuentasContables[0]?.value ?? "");

  async function enviar() {
    if (!nombre.trim()) {
      mostrar("warning", "Ingresa un nombre para la cuenta");
      return;
    }
    setEnviando(true);
    const res = await crearCuentaFinanciera({
      tipo,
      nombre: nombre.trim(),
      banco: banco.trim() || undefined,
      numeroCuenta: numeroCuenta.trim() || undefined,
      moneda,
      saldoInicial: typeof saldoInicial === "number" ? saldoInicial : 0,
      cuentaContableId: cuentaContableId || undefined,
    });
    setEnviando(false);
    if (!res.ok) {
      mostrar("error", res.error);
      return;
    }
    mostrar("success", "Cuenta creada");
    router.push("/tesoreria/cuentas");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Card>
        <CardHeader title="Datos de la cuenta" />
        <CardBody className="space-y-4">
          <Select
            label="Tipo de cuenta"
            value={tipo}
            onChange={(e) =>
              setTipo(e.target.value as "caja" | "banco" | "tarjeta" | "wallet")
            }
            options={TIPO_OPCIONES}
          />
          <Input
            label="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Caja Sucursal Norte, Cuenta BAC dólares"
          />
          {(tipo === "banco" || tipo === "tarjeta") && (
            <>
              <Input
                label="Banco / entidad financiera"
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
                placeholder="BAC, Banpro, Lafise..."
              />
              <Input
                label="Número de cuenta (últimos 4 dígitos)"
                value={numeroCuenta}
                onChange={(e) => setNumeroCuenta(e.target.value)}
                placeholder="1234"
                maxLength={20}
              />
            </>
          )}
          <Input
            label="Saldo inicial"
            type="number"
            step="0.01"
            min="0"
            value={saldoInicial}
            onChange={(e) => setSaldoInicial(parseFloat(e.target.value) || "")}
            placeholder="0.00"
          />
          {cuentasContables.length > 0 && (
            <Select
              label="Cuenta contable vinculada"
              value={cuentaContableId}
              onChange={(e) => setCuentaContableId(e.target.value)}
              options={[{ value: "", label: "— Sin vincular —" }, ...cuentasContables]}
            />
          )}
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.back()} disabled={enviando}>
          Cancelar
        </Button>
        <Button onClick={enviar} loading={enviando}>
          Crear cuenta
        </Button>
      </div>
    </div>
  );
}
