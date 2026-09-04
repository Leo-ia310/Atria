export type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral";

export type MesaPos = {
  id: string;
  sucursalId: string;
  nombre: string;
  capacidad: number;
  estado: string;
};

export type OrdenPos = {
  id: string;
  numero: string;
  mesaId: string | null;
  canal: string;
  estado: string;
  personas: number;
  subtotal: string;
  descuento: string;
  impuesto: string;
  propina: string;
  total: string;
  abiertoEn: Date;
  sucursalId: string;
  comensalNombre: string | null;
  comensalAlergias: string | null;
};

export type ProductoPos = {
  id: string;
  nombre: string;
  precioBase: string;
  costoPromedio: string;
  categoriaId: string | null;
  categoriaNombre: string | null;
  tipoRestaurante: string;
  tiempoPreparacionMin: number;
  alergenos: string[];
  etiquetas: string[];
  indiceBusqueda: string;
};

export type OrdenItemPos = {
  id: string;
  ordenId: string;
  productoId: string;
  nombreSnapshot: string;
  cantidad: string;
  precioUnitario: string;
  descuento: string;
  impuesto: string;
  estado: string;
  notasCocina: string | null;
};

export type EstadoMesaSimple =
  | "libre"
  | "ocupada"
  | "en_cocina"
  | "lista"
  | "cuenta_solicitada"
  | "por_limpiar"
  | "no_disponible";
