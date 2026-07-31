"use client";

import { useState } from "react";
import { Clock, FileJson, ListChecks, Printer } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatearMoneda, formatearFecha } from "@/lib/utils";
import type { PaisCodigo } from "@/lib/paises";

type Linea = { concepto: string; monto: number; nota?: string | null };
type SemanaColilla = {
  label: string;
  inicio: string;
  fin: string;
  ingresos: Linea[];
  deducciones: Linea[];
  totalIngresos: number;
  totalDeducciones: number;
  neto: number;
};
export type ColillaSnapshot = {
  empresa: { nombre: string; identificacionFiscal?: string; direccion?: string | null; telefono?: string | null };
  periodo: { nomina: string; descripcion: string; inicio: string; fin: string; fechaPago: string };
  empleado: {
    codigo: string;
    nombre: string;
    salarioMensual: number;
    departamento?: string | null;
    equipo?: string | null;
    puesto?: string | null;
  };
  semanas: SemanaColilla[];
  totales: { totalIngresos: number; totalDeducciones: number; pagoNeto: number };
};

export function HorasExtraDetalle({
  pais,
  horas,
  monto,
  salarioMensual,
}: {
  pais: PaisCodigo;
  horas: number;
  monto: number;
  salarioMensual: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const salarioHora = salarioMensual / 240;
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title={`Pagado: ${formatearMoneda(monto, pais)}`}
        className="inline-flex items-center justify-end gap-1 text-[color:var(--color-secondary)] hover:underline"
      >
        <Clock size={13} /> {horas}
      </button>
      <Modal abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Horas extra" ancho="sm">
        <div className="space-y-2 text-small">
          <Fila label="Horas" value={horas.toFixed(2)} />
          <Fila label="Salario hora" value={formatearMoneda(salarioHora, pais)} />
          <Fila label="Factor" value="1.5" />
          <Fila label="Pagado" value={formatearMoneda(monto, pais)} fuerte />
        </div>
      </Modal>
    </>
  );
}

export function DeduccionesDetalle({
  pais,
  total,
  fijas,
  variables,
}: {
  pais: PaisCodigo;
  total: number;
  fijas: Linea[];
  variables: (Linea & { semana: string })[];
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center justify-end gap-1 text-[color:var(--color-secondary)] hover:underline"
      >
        <ListChecks size={13} /> {formatearMoneda(total, pais)}
      </button>
      <Modal abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Detalle de deducciones" ancho="md">
        <div className="space-y-4 text-small">
          <BloqueLineas titulo="Fijas" pais={pais} lineas={fijas} />
          <BloqueLineas
            titulo="Variables"
            pais={pais}
            lineas={variables.map((v) => ({
              concepto: `${v.concepto} (${labelSemana(v.semana)})`,
              monto: v.monto,
              nota: v.nota,
            }))}
          />
          <div className="border-t border-[color:var(--color-border)] pt-2">
            <Fila label="Total deducciones" value={formatearMoneda(total, pais)} fuerte />
          </div>
        </div>
      </Modal>
    </>
  );
}

export function ColillaPagoVer({
  pais,
  snapshot,
}: {
  pais: PaisCodigo;
  snapshot: ColillaSnapshot | null;
}) {
  const [abierto, setAbierto] = useState(false);
  if (!snapshot) {
    return <span className="text-[11px] text-[color:var(--color-text-muted)]">Sin colilla</span>;
  }

  function imprimir() {
    document.body.classList.add("imprimiendo-colilla");
    const cleanup = () => {
      document.body.classList.remove("imprimiendo-colilla");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    window.setTimeout(cleanup, 1500);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1 text-[color:var(--color-secondary)] hover:underline"
      >
        <FileJson size={13} /> Colilla
      </button>
      <Modal
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Colilla de pago"
        ancho="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAbierto(false)}>
              Cerrar
            </Button>
            <Button onClick={imprimir}>
              <Printer size={14} /> Imprimir
            </Button>
          </>
        }
      >
        <div className="colilla-imprimible mx-auto max-w-3xl rounded-md border border-[color:var(--color-border)] bg-white p-6 text-[13px] text-[color:var(--color-text-primary)]">
          <div className="text-center">
            <div className="text-lg font-bold uppercase">{snapshot.empresa.nombre}</div>
            <div className="text-small font-semibold">Colilla de pago</div>
            <div className="text-[12px] text-[color:var(--color-text-muted)]">
              Periodo {formatearFecha(snapshot.periodo.inicio)} - {formatearFecha(snapshot.periodo.fin)}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Fila label="Empleado" value={snapshot.empleado.nombre} />
            <Fila label="Codigo" value={snapshot.empleado.codigo} />
            <Fila label="Salario mensual" value={formatearMoneda(snapshot.empleado.salarioMensual, pais)} />
            <Fila label="Departamento" value={snapshot.empleado.departamento ?? "-"} />
            <Fila label="Equipo" value={snapshot.empleado.equipo ?? snapshot.empleado.puesto ?? "-"} />
            <Fila label="Nomina" value={snapshot.periodo.nomina} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {snapshot.semanas.map((semana) => (
              <div key={semana.label} className="rounded-md border border-[color:var(--color-border)] p-3">
                <div className="mb-2 font-semibold">
                  {semana.label} - {formatearFecha(semana.inicio)} al {formatearFecha(semana.fin)}
                </div>
                <BloqueLineas titulo="Ingresos" pais={pais} lineas={semana.ingresos} />
                <div className="my-3 border-t border-[color:var(--color-border)]" />
                <BloqueLineas titulo="Deducciones" pais={pais} lineas={semana.deducciones} />
                <div className="mt-3 space-y-1 border-t border-[color:var(--color-border)] pt-2">
                  <Fila label="Total ingresos" value={formatearMoneda(semana.totalIngresos, pais)} />
                  <Fila label="Total deducciones" value={formatearMoneda(semana.totalDeducciones, pais)} />
                  <Fila label="Neto" value={formatearMoneda(semana.neto, pais)} fuerte />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-md bg-[color:var(--color-surface-2)] p-3">
            <Fila label="Total ingresos" value={formatearMoneda(snapshot.totales.totalIngresos, pais)} />
            <Fila label="Total deducciones" value={formatearMoneda(snapshot.totales.totalDeducciones, pais)} />
            <Fila label="Pago neto" value={formatearMoneda(snapshot.totales.pagoNeto, pais)} fuerte />
          </div>

          <details className="mt-4 print:hidden">
            <summary className="cursor-pointer text-small text-[color:var(--color-secondary)]">
              JSON
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-[color:var(--color-dark-bg)] p-3 text-[11px] text-white">
              {JSON.stringify(snapshot, null, 2)}
            </pre>
          </details>
        </div>
      </Modal>
    </>
  );
}

function BloqueLineas({
  titulo,
  pais,
  lineas,
}: {
  titulo: string;
  pais: PaisCodigo;
  lineas: Linea[];
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase text-[color:var(--color-text-muted)]">
        {titulo}
      </div>
      {lineas.length === 0 ? (
        <div className="text-[12px] text-[color:var(--color-text-muted)]">Sin registros</div>
      ) : (
        <div className="space-y-1">
          {lineas.map((linea, index) => (
            <div key={`${linea.concepto}-${index}`}>
              <Fila label={linea.concepto} value={formatearMoneda(linea.monto, pais)} />
              {linea.nota && (
                <div className="text-[11px] text-[color:var(--color-text-muted)]">{linea.nota}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Fila({ label, value, fuerte }: { label: string; value: string; fuerte?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[color:var(--color-text-muted)]">{label}</span>
      <span className={fuerte ? "text-right font-bold" : "text-right font-medium"}>{value}</span>
    </div>
  );
}

function labelSemana(value: string): string {
  if (value === "semana_1") return "Semana 1";
  if (value === "semana_2") return "Semana 2";
  return "Periodo";
}
