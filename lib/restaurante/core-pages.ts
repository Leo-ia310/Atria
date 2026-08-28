export type BadgeTone = "success" | "warning" | "error" | "info" | "neutral";

export function numero(valor: number | string | null | undefined): number {
  if (valor === null || valor === undefined) return 0;
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  return Number.isFinite(n) ? n : 0;
}

export function cantidad(valor: number | string | null | undefined): string {
  return numero(valor).toLocaleString("es", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

export function porcentaje(valor: number | string | null | undefined): string {
  return `${(numero(valor) * 100).toFixed(2)}%`;
}

export function estadoTone(estado: string | null | undefined): BadgeTone {
  if (!estado) return "neutral";
  if (
    [
      "pagada",
      "pagado",
      "completada",
      "completado",
      "recibida",
      "emitido",
      "entregado",
      "cerrada",
      "aprobada",
      "activo",
      "activa",
    ].includes(estado)
  ) {
    return "success";
  }
  if (["vencida", "anulada", "cancelada", "baja", "suspendido", "anulado"].includes(estado)) {
    return "error";
  }
  if (["parcial", "pendiente", "borrador", "en_progreso", "abierta", "enviada"].includes(estado)) {
    return "warning";
  }
  if (["en_cocina", "cuenta_solicitada", "trial", "presente", "preparando", "lista"].includes(estado)) {
    return "info";
  }
  return "neutral";
}

export function labelEstado(valor: string | null | undefined): string {
  if (!valor) return "Sin estado";
  return valor
    .replaceAll("_", " ")
    .split(" ")
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(" ");
}

export function labelCanalRestaurante(valor: string | null | undefined): string {
  if (!valor) return "Sin canal";
  const labels: Record<string, string> = {
    salon: "Comer en el lugar",
    qr_mesa: "QR mesa",
    para_llevar: "Para llevar",
    delivery_propio: "Delivery propio",
    delivery_externo: "Delivery externo",
    pedido_web: "Pedido web",
  };
  return labels[valor] ?? labelEstado(valor);
}
