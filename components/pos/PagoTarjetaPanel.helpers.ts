export type ResultadoTarjeta = {
  autorizacion?: string;
  ultimos4?: string;
  marca?: string;
};

export function referenciaTarjeta(info: ResultadoTarjeta): string {
  const partes: string[] = [];
  if (info.marca) partes.push(info.marca);
  if (info.ultimos4) partes.push(`****${info.ultimos4}`);
  if (info.autorizacion) partes.push(`Autz ${info.autorizacion}`);
  return partes.length ? partes.join(" · ") : "Tarjeta aprobada";
}
