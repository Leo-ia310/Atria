export function notaRestauranteVisible(valor?: string | null): string | null {
  const limpio = valor?.trim();
  if (!limpio) return null;
  if (/^seed:[\w-]+/i.test(limpio)) return null;
  return limpio;
}

export function labelItemCocina(estado: string): string {
  const labels: Record<string, string> = {
    borrador: "Nuevo sin enviar",
    enviado: "Enviado a cocina",
    recibida: "Recibida",
    preparando: "Preparando",
    listo: "Listo",
    lista: "Lista",
    entregado: "Entregado",
    cancelado: "Cancelado",
    cancelada: "Cancelada",
  };
  return labels[estado] ?? estado;
}
