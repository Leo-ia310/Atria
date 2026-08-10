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

  return SOPORTE_MODULOS
    .filter((item) => permitido.has(item.modulo))
    .map((item) => {
      const score = item.keywords.reduce(
        (total, keyword) => total + (normalizado.includes(keyword) ? 1 : 0),
        0,
      );
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ item }) => item);
}
