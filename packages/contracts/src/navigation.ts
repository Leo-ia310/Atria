import type { PermissionKey } from "./permissions";

export type NavigationItem = {
  key: string;
  label: string;
  href: string;
  permission?: PermissionKey;
};

export const primaryNavigation: NavigationItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/app" },
  { key: "pos", label: "POS", href: "/app/pos", permission: "pos:view" },
  { key: "ventas", label: "Ventas", href: "/app/ventas", permission: "sales:view" },
  {
    key: "clientes",
    label: "Clientes",
    href: "/app/clientes",
    permission: "sales:view",
  },
  {
    key: "inventario",
    label: "Inventario",
    href: "/app/inventario",
    permission: "inventory:view",
  },
  {
    key: "compras",
    label: "Compras",
    href: "/app/compras",
    permission: "inventory:view",
  },
  {
    key: "contabilidad",
    label: "Contabilidad",
    href: "/app/contabilidad",
    permission: "accounting:view",
  },
  {
    key: "empleados",
    label: "Empleados",
    href: "/app/empleados",
    permission: "employees:view",
  },
  {
    key: "sucursales",
    label: "Sucursales",
    href: "/app/sucursales",
    permission: "branches:view",
  },
  {
    key: "reportes",
    label: "Reportes",
    href: "/app/reportes",
    permission: "reports:view",
  },
  {
    key: "configuracion",
    label: "Configuracion",
    href: "/app/configuracion",
    permission: "settings:view",
  },
  {
    key: "facturacion",
    label: "SaaS Billing",
    href: "/app/facturacion",
    permission: "billing:view",
  },
];
