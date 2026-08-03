"use client";

import { Copy, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function MenuQrCard({
  url,
  qrDataUrl,
  nombre,
}: {
  url: string;
  qrDataUrl: string;
  nombre: string;
}) {
  const { mostrar } = useToast();
  const nombreSeguro = escapeHtml(nombre);
  const urlSegura = escapeHtml(url);

  async function copiar() {
    await navigator.clipboard.writeText(url);
    mostrar("success", "Link copiado.");
  }

  function imprimir() {
    const win = window.open("", "_blank", "width=420,height=620");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>QR ${nombre}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; display: grid; place-items: center; min-height: 100vh; }
            .wrap { text-align: center; padding: 28px; }
            img { width: 280px; height: 280px; }
            h1 { font-size: 20px; margin: 0 0 12px; }
            p { color: #555; font-size: 13px; word-break: break-all; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <h1>${nombreSeguro}</h1>
            <img src="${qrDataUrl}" alt="QR ${nombreSeguro}" />
            <p>${urlSegura}</p>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  }

  return (
    <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      <div className="mb-3 text-small font-semibold text-[color:var(--color-text-primary)]">
        QR general
      </div>
      <img
        src={qrDataUrl}
        alt={`QR ${nombre}`}
        className="mx-auto h-48 w-48 rounded-md border border-[color:var(--color-border)] bg-white p-2"
      />
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 block break-all text-center text-small font-medium text-[color:var(--color-primary)] hover:underline"
      >
        {url}
      </a>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={copiar}>
          <Copy size={14} /> Copiar
        </Button>
        <a
          href={qrDataUrl}
          download={`${nombre.replace(/\s+/g, "-").toLowerCase()}-qr.png`}
          className="arca-btn arca-btn-ghost arca-btn-sm"
        >
          <Download size={14} /> QR
        </a>
        <Button type="button" size="sm" variant="secondary" onClick={imprimir}>
          <Printer size={14} /> Imprimir
        </Button>
      </div>
    </div>
  );
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
