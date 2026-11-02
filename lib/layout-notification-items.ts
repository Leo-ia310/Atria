export type LayoutNotificationCounts = {
  cxcVencidas: number;
  cxpVencidas: number;
  solicitudesPendientes: number;
};
export const layoutNotificationTag = (empresaId: string) =>
  `layout-notifications:${empresaId}`;
export type LayoutNotificationItem = {
  id: string;
  titulo: string;
  detalle: string;
  href: string;
  tono: "error" | "warning" | "info";
};
export function layoutNotificationItems(
  counts: LayoutNotificationCounts,
): LayoutNotificationItem[] {
  const items: LayoutNotificationItem[] = [];
  if (counts.cxcVencidas > 0)
    items.push({
      id: "cxc-vencidas",
      titulo: `${counts.cxcVencidas} ${counts.cxcVencidas === 1 ? "cuenta vencida por cobrar" : "cuentas vencidas por cobrar"}`,
      detalle: "Revisa los cobros pendientes",
      href: "/cxc",
      tono: "error",
    });
  if (counts.cxpVencidas > 0)
    items.push({
      id: "cxp-vencidas",
      titulo: `${counts.cxpVencidas} ${counts.cxpVencidas === 1 ? "cuenta vencida por pagar" : "cuentas vencidas por pagar"}`,
      detalle: "Tienes pagos a proveedores vencidos",
      href: "/cxp",
      tono: "warning",
    });
  if (counts.solicitudesPendientes > 0)
    items.push({
      id: "solicitudes-pendientes",
      titulo: `${counts.solicitudesPendientes} ${counts.solicitudesPendientes === 1 ? "solicitud pendiente" : "solicitudes pendientes"}`,
      detalle: "Solicitudes de RRHH por resolver",
      href: "/rrhh/solicitudes",
      tono: "info",
    });
  return items;
}
