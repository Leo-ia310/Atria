"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.primaryNavigation = void 0;
exports.primaryNavigation = [
    { key: "dashboard", label: "Resumen", href: "/app" },
    { key: "ventas", label: "Ventas", href: "/app/ventas", permission: "sales:view" },
    {
        key: "inventario",
        label: "Inventario",
        href: "/app/inventario",
        permission: "inventory:view",
    },
    { key: "pos", label: "POS", href: "/app/pos", permission: "pos:view" },
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
        key: "facturacion",
        label: "Facturación",
        href: "/app/facturacion",
        permission: "billing:view",
    },
    {
        key: "configuracion",
        label: "Configuración",
        href: "/app/configuracion",
        permission: "settings:view",
    },
];
