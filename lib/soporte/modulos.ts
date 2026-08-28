import type { ModuloAcceso } from "@/lib/access-control";

export type SoporteModulo = {
  modulo: ModuloAcceso;
  label: string;
  href: string;
  keywords: string[];
};

export const SOPORTE_MODULOS: SoporteModulo[] = [
  { modulo: "dashboard", label: "Dashboard", href: "/dashboard", keywords: ["dashboard", "inicio", "kpi", "resumen"] },
  { modulo: "pos", label: "POS", href: "/pos", keywords: ["pos", "cobrar", "ticket", "vender", "venta rapida"] },
  { modulo: "caja", label: "Caja", href: "/caja", keywords: ["caja", "apertura", "cierre", "arqueo", "sesion"] },
  { modulo: "ventas", label: "Ventas", href: "/ventas", keywords: ["venta", "ventas", "historial", "anular"] },
  { modulo: "facturas", label: "Facturas", href: "/facturas", keywords: ["factura", "facturas", "credito", "cobrada", "imprimir"] },
  { modulo: "inventario", label: "Inventario", href: "/inventario", keywords: ["inventario", "producto", "sku", "stock", "categoria", "codigo de barras"] },
  { modulo: "clientes", label: "Clientes", href: "/clientes", keywords: ["cliente", "clientes", "credito cliente"] },
  { modulo: "compras", label: "Compras", href: "/compras", keywords: ["compra", "compras", "proveedor", "entrada"] },
  { modulo: "cxc", label: "Cobros", href: "/cxc", keywords: ["cxc", "cobro", "cuentas por cobrar", "abono", "deuda cliente"] },
  { modulo: "cxp", label: "Pagos", href: "/cxp", keywords: ["cxp", "pago", "cuentas por pagar", "proveedor"] },
  { modulo: "contabilidad", label: "Contabilidad", href: "/contabilidad/libro-diario", keywords: ["contabilidad", "asiento", "libro diario", "mayor", "balance"] },
  { modulo: "tesoreria", label: "Tesoreria", href: "/tesoreria", keywords: ["tesoreria", "gasto", "banco", "cuenta financiera"] },
  { modulo: "rrhh", label: "RRHH", href: "/rrhh", keywords: ["rrhh", "nomina", "empleado", "asistencia", "solicitud"] },
  { modulo: "reportes", label: "Reportes", href: "/reportes", keywords: ["reporte", "reportes", "ventas", "rentabilidad"] },
  { modulo: "configuracion", label: "Configuracion", href: "/configuracion", keywords: ["configurar", "configuracion", "usuarios", "roles", "impuestos", "sucursales"] },
  { modulo: "restaurante-dashboard", label: "Dashboard restaurante", href: "/restaurante", keywords: ["restaurante", "turno", "dashboard restaurante", "salon", "cocina"] },
  { modulo: "restaurante-pos", label: "POS restaurante", href: "/restaurante/pos", keywords: ["pos restaurante", "orden", "ordenes", "mesa", "comanda"] },
  { modulo: "restaurante-kds", label: "KDS", href: "/restaurante/kds", keywords: ["kds", "cocina", "comanda", "preparacion", "pedido cocina"] },
  { modulo: "restaurante-menu", label: "Menu QR", href: "/restaurante/menu", keywords: ["menu qr", "qr", "carta", "menu publico", "platillo"] },
  { modulo: "restaurante-mesas", label: "Mesas", href: "/restaurante/mesas", keywords: ["mesa", "mesas", "salon", "area", "qr mesa"] },
  { modulo: "restaurante-inventario", label: "Insumos", href: "/restaurante/inventario", keywords: ["insumo", "insumos", "food cost", "merma", "stock cocina"] },
  { modulo: "restaurante-configuracion", label: "Configuracion restaurante", href: "/restaurante/configuracion", keywords: ["configuracion restaurante", "configurar restaurante", "estacion", "sucursal restaurante"] },
];

export function sugerirModulosSoporte(
  texto: string,
  permitidos: ModuloAcceso[],
): SoporteModulo[] {
  const permitido = new Set(permitidos);
  const normalizado = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const candidatos: { item: SoporteModulo; score: number }[] = [];
  for (const item of SOPORTE_MODULOS) {
    if (!permitido.has(item.modulo)) continue;
      const score = item.keywords.reduce(
        (total, keyword) => total + (normalizado.includes(keyword) ? 1 : 0),
        0,
      );
    if (score > 0) candidatos.push({ item, score });
  }

  return candidatos
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ item }) => item);
}
