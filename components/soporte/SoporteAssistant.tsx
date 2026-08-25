"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, Send, UserRound } from "lucide-react";
import { responderSoporte } from "@/lib/actions/soporte";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import type { SoporteModulo } from "@/lib/soporte/modulos";

type Mensaje = {
  role: "user" | "assistant";
  content: string;
  modulos?: SoporteModulo[];
};

type SoporteAssistantProps = {
  planNombre: string;
  preguntasDiarias: number | null;
  palabrasPorPregunta: number | null;
  titulo?: string;
  mensajeInicial?: string;
  sugerencias?: [string, string][];
};

function textoHistorial(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 600);
}

function contarPalabras(texto: string): number {
  return texto.trim().match(/\S+/g)?.length ?? 0;
}

export function SoporteAssistant({
  planNombre,
  preguntasDiarias,
  palabrasPorPregunta,
  titulo = "Asistente ARCA",
  mensajeInicial = "Hola. Soy el asistente de ARCA. Puedo ayudarte con ventas, inventario, facturas, caja, contabilidad, cobros, pagos, reportes y configuracion.",
  sugerencias = [
    ["Configurar factura", "Como configuro impuestos y formas de pago?"],
    ["Buscar por SKU", "Como encuentro rapido productos por categoria?"],
    ["Revisar asiento", "Donde veo el asiento contable de una venta?"],
  ],
}: SoporteAssistantProps) {
  const { mostrar } = useToast();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      role: "assistant",
      content: mensajeInicial,
    },
  ]);
  const palabrasActuales = useMemo(() => contarPalabras(texto), [texto]);
  const excedePalabras =
    palabrasPorPregunta !== null && palabrasActuales > palabrasPorPregunta;

  const historial = useMemo(
    () =>
      mensajes
        .filter((mensaje) => mensaje.content.trim())
        .slice(-4)
        .map((mensaje) => ({ role: mensaje.role, content: textoHistorial(mensaje.content) })),
    [mensajes],
  );

  async function enviar() {
    const mensaje = texto.trim();
    if (!mensaje || enviando) return;
    const palabrasMensaje = contarPalabras(mensaje);
    if (palabrasPorPregunta !== null && palabrasMensaje > palabrasPorPregunta) {
      mostrar(
        "warning",
        `Tu plan ${planNombre} permite hasta ${palabrasPorPregunta} palabras por pregunta.`,
      );
      return;
    }

    setTexto("");
    setEnviando(true);
    setMensajes((actual) => [...actual, { role: "user", content: mensaje }]);

    const res = await responderSoporte({ mensaje, historial });
    setEnviando(false);

    if (!res.ok) {
      mostrar(res.tipo ?? "error", res.error);
      return;
    }

    setMensajes((actual) => [
      ...actual,
      { role: "assistant", content: res.respuesta, modulos: res.modulos },
    ]);
  }

  return (
    <div className="grid min-h-[calc(100vh-170px)] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <Card className="flex min-h-[620px] flex-col overflow-hidden">
        <CardHeader title={titulo} />
        <CardBody className="flex flex-1 flex-col gap-4 p-0">
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
            {mensajes.map((mensaje, index) => (
              <div
                key={index}
                className={`flex gap-3 ${mensaje.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {mensaje.role === "assistant" && (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[color:var(--color-primary)] text-white">
                    <Bot size={16} />
                  </div>
                )}
                <div
                  className={`max-w-[760px] rounded-md border px-3 py-2 text-small leading-relaxed ${
                    mensaje.role === "user"
                      ? "border-[color:var(--color-primary)]/20 bg-[color:var(--color-primary)] text-white"
                      : "border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] text-[color:var(--color-text-primary)]"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{mensaje.content}</div>
                  {mensaje.modulos && mensaje.modulos.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {mensaje.modulos.map((modulo) => (
                        <Link
                          key={`${modulo.modulo}-${modulo.href}`}
                          href={modulo.href}
                          className="arca-btn arca-btn-secondary arca-btn-sm"
                        >
                          {modulo.label} <ArrowRight size={13} />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                {mensaje.role === "user" && (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[color:var(--color-surface-2)] text-[color:var(--color-text-muted)]">
                    <UserRound size={16} />
                  </div>
                )}
              </div>
            ))}
            {enviando && (
              <div className="flex items-center gap-3 text-small text-[color:var(--color-text-muted)]">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[color:var(--color-primary)] text-white">
                  <Bot size={16} />
                </div>
                <span>Respondiendo...</span>
              </div>
            )}
          </div>
          <div className="border-t border-[color:var(--color-border)] p-3 sm:p-4">
            <div className="flex items-end gap-2">
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviar();
                  }
                }}
                rows={2}
                maxLength={3500}
                className="arca-input min-h-12 flex-1 resize-none"
                placeholder={
                  palabrasPorPregunta === null
                    ? "Escribe tu consulta..."
                    : `Escribe tu consulta (max. ${palabrasPorPregunta} palabras)...`
                }
              />
              <Button
                type="button"
                onClick={enviar}
                loading={enviando}
                disabled={!texto.trim() || excedePalabras}
              >
                <Send size={14} /> Enviar
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[color:var(--color-text-muted)]">
              <span>
                Plan {planNombre}:{" "}
                {preguntasDiarias === null
                  ? "sin limite diario"
                  : `${preguntasDiarias} preguntas al dia`}
              </span>
              {palabrasPorPregunta !== null && (
                <span
                  className={
                    excedePalabras
                      ? "font-medium text-[color:var(--color-danger)]"
                      : undefined
                  }
                >
                  {palabrasActuales}/{palabrasPorPregunta} palabras
                </span>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      <aside className="space-y-3">
        <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-small">
          <div className="font-medium text-[color:var(--color-text-primary)]">IA incluida</div>
          <div className="mt-1 text-[color:var(--color-text-muted)]">
            {preguntasDiarias === null
              ? "Sin limite diario"
              : `${preguntasDiarias} preguntas cortas por dia`}
            {palabrasPorPregunta !== null
              ? `, hasta ${palabrasPorPregunta} palabras cada una.`
              : "."}
          </div>
        </div>
        {sugerencias.map(([label, prompt]) => (
          <button
            key={label}
            type="button"
            onClick={() => setTexto(prompt)}
            className="w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-left text-small transition hover:border-[color:var(--color-border-strong)] hover:bg-[color:var(--color-surface-2)]"
          >
            {label}
          </button>
        ))}
      </aside>
    </div>
  );
}
