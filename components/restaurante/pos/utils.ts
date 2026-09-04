import type {
  BadgeVariant,
  EstadoMesaSimple,
  MesaPos,
  OrdenItemPos,
  OrdenPos,
  ProductoPos,
} from "@/components/restaurante/pos/types";

export function normalizarTexto(valor?: string | null): string {
  return (valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizarFeedback(valor?: string | null): string {
  const texto = (valor ?? "").trim();
  return texto ? texto.slice(0, 180) : "Operacion procesada.";
}

export function minutosDesde(fecha: Date): number {
  return Math.max(0, Math.round((Date.now() - fecha.getTime()) / 60000));
}

export function cantidadSinCeros(item: OrdenItemPos): string {
  const cantidad = parseFloat(item.cantidad);
  if (!Number.isFinite(cantidad)) return "1";
  return Number.isInteger(cantidad) ? String(cantidad) : cantidad.toFixed(2);
}

export function totalItem(item: OrdenItemPos): number {
  return Math.max(
    0,
    parseFloat(item.cantidad) * parseFloat(item.precioUnitario) - parseFloat(item.descuento),
  );
}

export function totalNumero(valor: string): number {
  const numero = parseFloat(valor);
  return Number.isFinite(numero) ? numero : 0;
}

export function estadoMesaSimple(
  mesa: MesaPos,
  orden: OrdenPos | undefined,
  items: OrdenItemPos[],
  estadoKdsPorItem: Map<string, string>,
): EstadoMesaSimple {
  if (!orden) {
    if (mesa.estado === "disponible") return "libre";
    if (mesa.estado === "por_limpiar") return "por_limpiar";
    if (mesa.estado === "cuenta_solicitada") return "cuenta_solicitada";
    return "no_disponible";
  }
  if (orden.estado === "cuenta_solicitada") return "cuenta_solicitada";
  if (items.length === 0) return "ocupada";
  const estados = items.map((item) => estadoItemMesero(item, estadoKdsPorItem.get(item.id)));
  if (estados.some((estado) => estado === "nuevo")) return "ocupada";
  if (estados.some((estado) => estado === "preparando" || estado === "enviado")) {
    return "en_cocina";
  }
  if (estados.every((estado) => estado === "lista" || estado === "entregado")) return "lista";
  return "ocupada";
}

export function estadoItemMesero(item: OrdenItemPos, estadoComanda?: string): string {
  if (item.estado === "borrador") return "nuevo";
  if (estadoComanda === "preparando") return "preparando";
  if (estadoComanda === "lista" || estadoComanda === "entregada") return "lista";
  if (item.estado === "listo" || item.estado === "entregado") return "lista";
  if (estadoComanda === "enviada" || estadoComanda === "recibida" || item.estado === "enviado") {
    return "enviado";
  }
  return item.estado;
}

export function prioridadEstadoCocina(estado: string): number {
  const prioridad: Record<string, number> = {
    enviada: 1,
    recibida: 2,
    preparando: 3,
    lista: 4,
    entregada: 5,
    cancelada: 0,
  };
  return prioridad[estado] ?? 0;
}

export function labelEstadoMesaSimple(estado: EstadoMesaSimple): string {
  const labels: Record<EstadoMesaSimple, string> = {
    libre: "Libre",
    ocupada: "Ocupada",
    en_cocina: "En cocina",
    lista: "Lista",
    cuenta_solicitada: "Cuenta solicitada",
    por_limpiar: "Por limpiar",
    no_disponible: "No disponible",
  };
  return labels[estado];
}

export function variantEstadoMesaSimple(estado: EstadoMesaSimple): BadgeVariant {
  if (estado === "libre" || estado === "lista") return "success";
  if (estado === "en_cocina") return "info";
  if (estado === "cuenta_solicitada") return "warning";
  if (estado === "por_limpiar") return "error";
  return "neutral";
}

export function classEstadoMesa(estado: EstadoMesaSimple): string {
  if (estado === "libre" || estado === "lista") return "text-[color:var(--color-success)]";
  if (estado === "en_cocina") return "text-[color:var(--color-info)]";
  if (estado === "cuenta_solicitada") return "text-[color:var(--color-warning)]";
  if (estado === "por_limpiar") return "text-[color:var(--color-error)]";
  return "text-[color:var(--color-text-muted)]";
}

export function labelEstadoOrden(estado: string): string {
  const labels: Record<string, string> = {
    borrador: "Borrador",
    abierta: "Abierta",
    en_cocina: "En cocina",
    cuenta_solicitada: "Cuenta solicitada",
    pagada: "Pagada",
    cancelada: "Cancelada",
  };
  return labels[estado] ?? estado;
}

export function variantEstadoOrden(estado: string): BadgeVariant {
  if (estado === "pagada") return "success";
  if (estado === "en_cocina") return "info";
  if (estado === "cuenta_solicitada") return "warning";
  if (estado === "cancelada") return "error";
  return "neutral";
}

export function labelCanal(canal: string): string {
  const labels: Record<string, string> = {
    salon: "Salon",
    qr_mesa: "QR mesa",
    para_llevar: "Para llevar",
    delivery_propio: "Delivery propio",
    delivery_externo: "Delivery externo",
    pedido_web: "Pedido web",
  };
  return labels[canal] ?? canal;
}

export function labelTipoProducto(tipo: string): string {
  const labels: Record<string, string> = {
    platillo: "Platillo",
    producto_directo: "Producto directo",
    combo: "Combo",
  };
  return labels[tipo] ?? tipo;
}

export function productoRequiereModal(producto: ProductoPos): boolean {
  const opciones = opcionesProducto(producto);
  return (
    producto.alergenos.length > 0 ||
    opciones.terminos.length > 0 ||
    opciones.extras.length > 0 ||
    opciones.quitar.length > 0 ||
    opciones.rapidas.length > 0
  );
}

export function opcionesProducto(producto: ProductoPos): {
  terminos: string[];
  extras: string[];
  quitar: string[];
  rapidas: string[];
} {
  const texto = normalizarTexto(
    [producto.nombre, producto.categoriaNombre, producto.tipoRestaurante, ...producto.etiquetas].join(" "),
  );
  const esBebida = /bebida|refresco|gaseosa|coca|cola|limonada|jugo|cafe|cerveza|agua/.test(texto);
  const esCarne = /hamburg|carne|res|steak|filete|parrilla|pollo/.test(texto);
  const aceptaExtras = /hamburg|pizza|sandwich|taco|burrito|plato|combo/.test(texto);
  return {
    terminos: esCarne ? ["Medio", "3/4", "Bien cocido"] : [],
    extras: aceptaExtras ? ["Extra queso", "Extra bacon"] : [],
    quitar: esBebida ? [] : ["Sin cebolla", "Sin tomate", "Sin sal"],
    rapidas: producto.etiquetas.slice(0, 4),
  };
}
