"use client";

import { Copy, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type MesaQr = {
  mesaNumero: number;
  url: string;
  qrDataUrl: string;
};

export function MenuMesaQrsCard({
  nombre,
  mesas,
}: {
  nombre: string;
  mesas: MesaQr[];
}) {
  const { mostrar } = useToast();

  async function copiar(url: string) {
    await navigator.clipboard.writeText(url);
    mostrar("success", "Link de mesa copiado.");
  }

  function imprimirMesa(mesa: MesaQr) {
    imprimirDocumento(nombre, [mesa]);
  }

  function imprimirTodas() {
    imprimirDocumento(nombre, mesas);
  }

  if (mesas.length === 0) {
    return (
      <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
        <div className="text-small font-semibold text-[color:var(--color-text-primary)]">
          QR por mesas
        </div>
        <p className="mt-2 text-small text-[color:var(--color-text-muted)]">
          Define el numero de mesas en ajustes para generar QRs individuales.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-small font-semibold text-[color:var(--color-text-primary)]">
            QR por mesas
          </div>
          <p className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">
            {mesas.length} mesas generadas.
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={imprimirTodas}>
          <Printer size={14} /> Imprimir todos
        </Button>
      </div>

      <div className="mt-4 grid max-h-[560px] gap-3 overflow-auto pr-1">
        {mesas.map((mesa) => (
          <div
            key={mesa.mesaNumero}
            className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-3"
          >
            <div className="flex items-center gap-3">
              <img
                src={mesa.qrDataUrl}
                alt={`QR mesa ${mesa.mesaNumero}`}
                className="h-20 w-20 rounded-md border border-[color:var(--color-border)] bg-white p-1"
              />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[color:var(--color-text-primary)]">
                  Mesa {mesa.mesaNumero}
                </div>
                <a
                  href={mesa.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate text-[12px] font-medium text-[color:var(--color-primary)] hover:underline"
                >
                  {mesa.url}
                </a>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => copiar(mesa.url)}>
                <Copy size={14} /> Copiar
              </Button>
              <a
                href={mesa.qrDataUrl}
                download={`${nombre.replace(/\s+/g, "-").toLowerCase()}-mesa-${mesa.mesaNumero}-qr.png`}
                className="arca-btn arca-btn-ghost arca-btn-sm"
              >
                <Download size={14} /> QR
              </a>
              <Button type="button" size="sm" variant="ghost" onClick={() => imprimirMesa(mesa)}>
                <Printer size={14} /> Imprimir
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function imprimirDocumento(nombre: string, mesas: MesaQr[]) {
  const win = window.open("", "_blank", "width=900,height=720");
  if (!win) return;
  const nombreSeguro = escapeHtml(nombre);
  const contenido = mesas
    .map((mesa) => {
      const urlSegura = escapeHtml(mesa.url);
      return `
        <section class="qr">
          <h1>${nombreSeguro}</h1>
          <h2>Mesa ${mesa.mesaNumero}</h2>
          <img src="${mesa.qrDataUrl}" alt="QR mesa ${mesa.mesaNumero}" />
          <p>${urlSegura}</p>
        </section>
      `;
    })
    .join("");

  win.document.write(`
    <html>
      <head>
        <title>QR mesas ${nombreSeguro}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 24px; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
          .qr { border: 1px solid #ddd; border-radius: 8px; padding: 18px; text-align: center; page-break-inside: avoid; }
          img { width: 220px; height: 220px; }
          h1 { font-size: 18px; margin: 0 0 6px; }
          h2 { font-size: 24px; margin: 0 0 12px; }
          p { color: #555; font-size: 12px; word-break: break-all; }
          @media print { body { padding: 0; } .grid { gap: 10px; } .qr { border-radius: 0; } }
        </style>
      </head>
      <body>
        <div class="grid">${contenido}</div>
        <script>window.onload = () => window.print();</script>
      </body>
    </html>
  `);
  win.document.close();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[char] ?? char;
  });
}
