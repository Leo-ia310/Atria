import {
  Banknote,
  BarChart3,
  BookOpen,
  CalendarCheck,
  CircleDollarSign,
  Coins,
  FileText,
  HandCoins,
  Inbox,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  UserRound,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ModuloAcceso } from "@/lib/access-control";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  modulo: ModuloAcceso;
};

export type NavGroup = {
  titulo: string;
  items: NavItem[];
};

export type CommandItem = {
  label: string;
  href: string;
  grupo: string;
  modulo: ModuloAcceso;
  keywords?: string;
};

export const NAV_GROUPS: NavGroup[] = [
  {
    titulo: "Operativo",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, modulo: "dashboard" },
      { href: "/pos", label: "POS", icon: ShoppingCart, modulo: "pos" },
      { href: "/caja", label: "Caja", icon: Store, modulo: "caja" },
      { href: "/ventas", label: "Ventas", icon: Receipt, modulo: "ventas" },
      { href: "/inventario", label: "Inventario", icon: Package, modulo: "inventario" },
      { href: "/clientes", label: "Clientes", icon: Users, modulo: "clientes" },
      { href: "/compras", label: "Compras", icon: Truck, modulo: "compras" },
    ],
  },
  {
    titulo: "Finanzas",
    items: [
      { href: "/facturas", label: "Facturas", icon: FileText, modulo: "facturas" },
      { href: "/cxc", label: "Cobros (CxC)", icon: HandCoins, modulo: "cxc" },
      { href: "/cxp", label: "Pagos (CxP)", icon: Banknote, modulo: "cxp" },
      { href: "/contabilidad", label: "Contabilidad", icon: BookOpen, modulo: "contabilidad" },
      { href: "/tesoreria", label: "Tesorería", icon: Wallet, modulo: "tesoreria" },
    ],
  },
  {
    titulo: "Recursos Humanos",
    items: [
      { href: "/rrhh", label: "Panel RRHH", icon: UsersRound, modulo: "rrhh" },
      { href: "/rrhh/empleados", label: "Empleados", icon: UserRound, modulo: "rrhh" },
      { href: "/rrhh/asistencia", label: "Asistencia", icon: CalendarCheck, modulo: "rrhh" },
      { href: "/rrhh/nomina", label: "Nómina", icon: Wallet, modulo: "rrhh" },
      { href: "/rrhh/ingresos", label: "Ingresos", icon: CircleDollarSign, modulo: "rrhh" },
      { href: "/rrhh/deducciones", label: "Deducciones", icon: Coins, modulo: "rrhh" },
      { href: "/rrhh/solicitudes", label: "Solicitudes", icon: Inbox, modulo: "rrhh" },
    ],
  },
  {
    titulo: "Gestión",
    items: [
      { href: "/reportes", label: "Reportes", icon: BarChart3, modulo: "reportes" },
      { href: "/configuracion", label: "Configuración", icon: Settings, modulo: "configuracion" },
    ],
  },
];

export const COMMAND_ITEMS: CommandItem[] = [
  { label: "Dashboard", href: "/dashboard", grupo: "Operativo", modulo: "dashboard" },
  { label: "Punto de Venta (POS)", href: "/pos", grupo: "Operativo", modulo: "pos", keywords: "caja cobrar vender" },
  { label: "Caja / Sesiones", href: "/caja", grupo: "Operativo", modulo: "caja", keywords: "arqueo apertura cierre" },
  { label: "Ventas", href: "/ventas", grupo: "Operativo", modulo: "ventas" },
  { label: "Inventario", href: "/inventario", grupo: "Operativo", modulo: "inventario", keywords: "productos stock" },
  { label: "Nuevo producto", href: "/inventario/nuevo", grupo: "Operativo", modulo: "inventario" },
  { label: "Clientes", href: "/clientes", grupo: "Operativo", modulo: "clientes" },
  { label: "Compras", href: "/compras", grupo: "Operativo", modulo: "compras", keywords: "proveedores" },
  { label: "Facturas", href: "/facturas", grupo: "Finanzas", modulo: "facturas", keywords: "documentos recibos" },
  { label: "Cobros (CxC)", href: "/cxc", grupo: "Finanzas", modulo: "cxc", keywords: "cuentas por cobrar" },
  { label: "Pagos (CxP)", href: "/cxp", grupo: "Finanzas", modulo: "cxp", keywords: "cuentas por pagar" },
  { label: "Contabilidad", href: "/contabilidad", grupo: "Finanzas", modulo: "contabilidad", keywords: "asientos libro diario mayor balance" },
  { label: "Libro Diario", href: "/contabilidad/libro-diario", grupo: "Finanzas", modulo: "contabilidad" },
  { label: "Estado de Resultados", href: "/contabilidad/estado-resultados", grupo: "Finanzas", modulo: "contabilidad" },
  { label: "Balance General", href: "/contabilidad/balance-general", grupo: "Finanzas", modulo: "contabilidad" },
  { label: "Tesorería", href: "/tesoreria", grupo: "Finanzas", modulo: "tesoreria", keywords: "bancos gastos" },
  { label: "Gastos", href: "/tesoreria/gastos", grupo: "Finanzas", modulo: "tesoreria" },
  { label: "Panel RRHH", href: "/rrhh", grupo: "Recursos Humanos", modulo: "rrhh" },
  { label: "Empleados", href: "/rrhh/empleados", grupo: "Recursos Humanos", modulo: "rrhh" },
  { label: "Asistencia", href: "/rrhh/asistencia", grupo: "Recursos Humanos", modulo: "rrhh" },
  { label: "Historial de asistencias", href: "/rrhh/asistencia/historial", grupo: "Recursos Humanos", modulo: "rrhh" },
  { label: "Nómina", href: "/rrhh/nomina", grupo: "Recursos Humanos", modulo: "rrhh", keywords: "pago salario planilla" },
  { label: "Ingresos", href: "/rrhh/ingresos", grupo: "Recursos Humanos", modulo: "rrhh", keywords: "bonos comisiones extra variables" },
  { label: "Deducciones", href: "/rrhh/deducciones", grupo: "Recursos Humanos", modulo: "rrhh", keywords: "gasolina transporte comida adelanto prestamo variables" },
  { label: "Feriados", href: "/rrhh/feriados", grupo: "Recursos Humanos", modulo: "rrhh" },
  { label: "Solicitudes", href: "/rrhh/solicitudes", grupo: "Recursos Humanos", modulo: "rrhh", keywords: "permisos vacaciones" },
  { label: "Reportes", href: "/reportes", grupo: "Gestión", modulo: "reportes" },
  { label: "Reporte de inventario", href: "/reportes/inventario", grupo: "Gestión", modulo: "reportes" },
  { label: "Reporte de ventas", href: "/reportes/ventas", grupo: "Gestión", modulo: "reportes" },
  { label: "Rentabilidad", href: "/reportes/rentabilidad", grupo: "Gestión", modulo: "reportes-avanzados" },
  { label: "Configuración", href: "/configuracion", grupo: "Gestión", modulo: "configuracion" },
  { label: "Usuarios", href: "/configuracion/usuarios", grupo: "Gestión", modulo: "configuracion" },
  { label: "Roles y permisos", href: "/configuracion/roles", grupo: "Gestión", modulo: "configuracion" },
  { label: "Cajas", href: "/configuracion/cajas", grupo: "Gestión", modulo: "configuracion" },
  { label: "Impuestos", href: "/configuracion/impuestos", grupo: "Gestión", modulo: "configuracion" },
  { label: "Formas de pago", href: "/configuracion/formas-pago", grupo: "Gestión", modulo: "configuracion" },
  { label: "Cuentas financieras", href: "/configuracion/cuentas-financieras", grupo: "Gestión", modulo: "configuracion" },
  { label: "Facturación fiscal", href: "/configuracion/facturacion", grupo: "Gestión", modulo: "configuracion", keywords: "cai secuencias" },
  { label: "Sucursales", href: "/configuracion/sucursales", grupo: "Gestión", modulo: "configuracion" },
  { label: "Mi cuenta", href: "/mi-cuenta", grupo: "Gestión", modulo: "mi-cuenta", keywords: "perfil contraseña" },
];

export function filtrarCommandItems(modulosPermitidos: ModuloAcceso[]): CommandItem[] {
  const permitidos = new Set(modulosPermitidos);
  return COMMAND_ITEMS.filter((item) => permitidos.has(item.modulo));
}
