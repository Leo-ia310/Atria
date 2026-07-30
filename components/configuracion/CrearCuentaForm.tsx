"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import {
  cuentaFinancieraSchema,
  type CuentaFinancieraInput,
} from "@/lib/validations/configuracion";
import { crearCuentaFinanciera } from "@/lib/actions/configuracion";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const TIPOS = [
  { value: "caja", label: "Caja (efectivo)" },
  { value: "banco", label: "Cuenta bancaria" },
  { value: "tarjeta", label: "Tarjeta / TPV" },
  { value: "wallet", label: "Billetera / Wallet" },
];

const MONEDAS = [
  { value: "NIO", label: "Córdoba (NIO)" },
  { value: "HNL", label: "Lempira (HNL)" },
  { value: "GTQ", label: "Quetzal (GTQ)" },
  { value: "CRC", label: "Colón (CRC)" },
  { value: "USD", label: "Dólar (USD)" },
];

export function CrearCuentaForm({ monedaDefault }: { monedaDefault: string }) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CuentaFinancieraInput>({
    resolver: zodResolver(cuentaFinancieraSchema),
    defaultValues: {
      tipo: "caja",
      nombre: "",
      banco: "",
      numeroCuenta: "",
      moneda: (monedaDefault as CuentaFinancieraInput["moneda"]) ?? "NIO",
      saldoInicial: 0,
    },
  });

  async function onSubmit(values: CuentaFinancieraInput) {
    setEnviando(true);
    const res = await crearCuentaFinanciera(values);
    setEnviando(false);
    if (!res.ok) return mostrar("error", res.error);
    mostrar("success", "Cuenta creada");
    setAbierto(false);
    reset();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="arca-btn arca-btn-primary arca-btn-sm"
      >
        <Plus size={14} /> Nueva cuenta
      </button>

      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Nueva cuenta financiera"
        ancho="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAbierto(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit(onSubmit)} loading={enviando}>
              Crear
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select label="Tipo" options={TIPOS} {...register("tipo")} />
          <Input label="Nombre" error={errors.nombre?.message} {...register("nombre")} placeholder="Caja general" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Banco (opcional)" {...register("banco")} />
            <Input label="N° de cuenta (opcional)" {...register("numeroCuenta")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Moneda" options={MONEDAS} {...register("moneda")} />
            <Input
              label="Saldo inicial"
              type="number"
              step="0.01"
              error={errors.saldoInicial?.message}
              {...register("saldoInicial")}
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
