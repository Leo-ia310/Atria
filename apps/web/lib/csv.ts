export function descargarCSV(nombre: string, filas: (string | number)[][]): void {
  const contenido = filas
    .map((fila) =>
      fila
        .map((valor) => {
          const texto = String(valor ?? "");
          return /[",\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
        })
        .join(","),
    )
    .join("\n");

  const blob = new Blob([`﻿${contenido}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nombre;
  link.click();
  URL.revokeObjectURL(url);
}
