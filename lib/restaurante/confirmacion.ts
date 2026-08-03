export const PALABRAS_CONFIRMACION_RESTAURANTE = [
  "ScSnmADE",
  "ArcaBorraMenu42",
  "MesaRoja91",
  "CocinaLibre77",
  "QRFinal208",
  "MenuCero19",
  "PedidoNulo63",
  "CafeSinDatos5",
] as const;

export function palabraConfirmacionAleatoria(): string {
  const indice = Math.floor(Math.random() * PALABRAS_CONFIRMACION_RESTAURANTE.length);
  return PALABRAS_CONFIRMACION_RESTAURANTE[indice] ?? PALABRAS_CONFIRMACION_RESTAURANTE[0];
}

export function esPalabraConfirmacionRestaurante(valor: string): boolean {
  return PALABRAS_CONFIRMACION_RESTAURANTE.includes(
    valor as (typeof PALABRAS_CONFIRMACION_RESTAURANTE)[number],
  );
}
