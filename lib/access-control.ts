import type { Plan, PlanFeatures } from "@/lib/pricing";

export type ModuloAcceso =
  | "dashboard"
  | "pos"
  | "caja"
  | "ventas"
  | "menu-virtual"
  | "pedidos-cocina"
  | "restaurante-dashboard"
  | "restaurante-pos"
  | "restaurante-mesas"
  | "restaurante-ordenes"
  | "restaurante-kds"
  | "restaurante-menu"
  | "restaurante-recetas"
  | "restaurante-inventario"
  | "restaurante-mermas"
  | "restaurante-reservaciones"
  | "restaurante-comensales"
  | "restaurante-reportes"
  | "restaurante-promociones"
  | "restaurante-soporte"
  | "restaurante-configuracion"
  | "restaurante-plan"
  | "inventario"
  | "clientes"
  | "compras"
  | "facturas"
  | "cxc"
  | "cxp"
  | "contabilidad"
  | "tesoreria"
  | "rrhh"
  | "reportes"
  | "reportes-avanzados"
  | "soporte"
  | "configuracion"
  | "mi-cuenta";

export type AccessSnapshot = {
  esAdminEmpresa: boolean;
  permisos: string[];
  plan: Plan;
  tipoEmpresa: "general" | "restaurante" | "retail" | "servicios";
  verticalEmpresa: "retail" | "restaurante";
};

type ReglaAcceso = {
  siempre?: boolean;
  soloAdmin?: boolean;
  permisos?: string[];
  features?: (keyof PlanFeatures)[];
  cualquierFeature?: (keyof PlanFeatures)[];
  soloRestaurante?: boolean;
};

export const REGLAS_ACCESO: Record<ModuloAcceso, ReglaAcceso> = {
  dashboard: { siempre: true },
  "mi-cuenta": { siempre: true },
  pos: { permisos: ["ventas.crear"], features: ["pos"] },
  caja: { permisos: ["ventas.crear"], features: ["pos"] },
  ventas: { permisos: ["ventas.ver", "ventas.crear"], features: ["facturacion"] },
  "menu-virtual": {
    permisos: ["restaurante.menu"],
    soloRestaurante: true,
  },
  "pedidos-cocina": {
    permisos: ["restaurante.pedidos"],
    soloRestaurante: true,
  },
  "restaurante-dashboard": {
    permisos: ["restaurante.dashboard.ver", "restaurante.pedidos"],
    soloRestaurante: true,
  },
  "restaurante-pos": {
    permisos: ["restaurante.ordenes.crear", "ventas.crear"],
    features: ["pos"],
    soloRestaurante: true,
  },
  "restaurante-mesas": {
    permisos: ["restaurante.mesas.ver"],
    soloRestaurante: true,
  },
  "restaurante-ordenes": {
    permisos: ["restaurante.ordenes.crear", "restaurante.ordenes.editar"],
    soloRestaurante: true,
  },
  "restaurante-kds": {
    permisos: ["restaurante.kds.ver", "restaurante.pedidos"],
    soloRestaurante: true,
  },
  "restaurante-menu": {
    permisos: ["restaurante.menu", "restaurante.recetas.ver"],
    soloRestaurante: true,
  },
  "restaurante-recetas": {
    permisos: ["restaurante.recetas.ver"],
    soloRestaurante: true,
  },
  "restaurante-inventario": {
    permisos: ["restaurante.recetas.ver", "inventario.ver"],
    cualquierFeature: ["inventario_basico", "inventario_avanzado"],
    soloRestaurante: true,
  },
  "restaurante-mermas": {
    permisos: ["restaurante.mermas.ver", "restaurante.mermas.crear"],
    soloRestaurante: true,
  },
  "restaurante-reservaciones": {
    permisos: ["restaurante.reservaciones.ver"],
    soloRestaurante: true,
  },
  "restaurante-comensales": {
    permisos: ["restaurante.crm.ver", "restaurante.reservaciones.ver"],
    soloRestaurante: true,
  },
  "restaurante-reportes": {
    permisos: ["restaurante.reportes.ver", "reportes.ver"],
    soloRestaurante: true,
  },
  "restaurante-promociones": {
    permisos: ["restaurante.promociones.ver", "restaurante.promociones.editar"],
    soloRestaurante: true,
  },
  "restaurante-soporte": {
    features: ["soporte_chat"],
    soloRestaurante: true,
  },
  "restaurante-configuracion": {
    soloAdmin: true,
    soloRestaurante: true,
  },
  "restaurante-plan": {
    soloRestaurante: true,
  },
  facturas: { permisos: ["ventas.ver", "ventas.crear"], features: ["facturacion"] },
  inventario: {
    permisos: ["inventario.ver"],
    cualquierFeature: ["inventario_basico", "inventario_avanzado"],
  },
  clientes: { permisos: ["ventas.ver", "ventas.crear"], features: ["facturacion"] },
  compras: { permisos: ["compras.crear"], features: ["gestion_proveedores"] },
  cxp: { permisos: ["compras.crear"], features: ["gestion_proveedores"] },
  cxc: { permisos: ["ventas.ver", "ventas.crear"], features: ["cuentas_por_cobrar"] },
  contabilidad: { permisos: ["contabilidad.ver"], features: ["contabilidad"] },
  tesoreria: {
    permisos: ["tesoreria.ver"],
    cualquierFeature: ["modulo_gastos", "contabilidad", "contabilidad_consolidada"],
  },
  rrhh: { soloAdmin: true, features: ["modulo_nomina"] },
  reportes: { permisos: ["reportes.ver"], features: ["reportes_avanzados"] },
  "reportes-avanzados": {
    permisos: ["reportes.avanzados"],
    features: ["reportes_avanzados"],
  },
  soporte: { features: ["soporte_chat"] },
  configuracion: { soloAdmin: true },
};

const MODULOS_LEGACY_RESTAURANTE_OCULTOS = new Set<ModuloAcceso>([
  "menu-virtual",
  "pedidos-cocina",
]);

export function tienePermiso(
  access: AccessSnapshot,
  permisos: string | string[],
): boolean {
  if (access.esAdminEmpresa) return true;
  const requeridos = Array.isArray(permisos) ? permisos : [permisos];
  const permisosActuales = new Set(access.permisos);
  return requeridos.some((permiso) => permisosActuales.has(permiso));
}

export function puedeAccederModulo(
  access: AccessSnapshot,
  modulo: ModuloAcceso,
): boolean {
  const regla = REGLAS_ACCESO[modulo];
  if (regla.siempre) return true;
  if (regla.soloAdmin && !access.esAdminEmpresa) return false;
  if (access.plan.id === "demo" && regla.soloRestaurante) return false;
  if (
    regla.soloRestaurante &&
    access.verticalEmpresa !== "restaurante" &&
    access.tipoEmpresa !== "restaurante"
  ) {
    return false;
  }

  if (regla.permisos?.length && !tienePermiso(access, regla.permisos)) {
    return false;
  }

  if (
    regla.features?.length &&
    !regla.features.every((feature) => access.plan.features[feature] === true)
  ) {
    return false;
  }

  if (
    regla.cualquierFeature?.length &&
    !regla.cualquierFeature.some((feature) => access.plan.features[feature] === true)
  ) {
    return false;
  }

  return true;
}

export function modulosPermitidos(access: AccessSnapshot): ModuloAcceso[] {
  return (Object.keys(REGLAS_ACCESO) as ModuloAcceso[]).filter((modulo) =>
    puedeAccederModulo(access, modulo) &&
      !MODULOS_LEGACY_RESTAURANTE_OCULTOS.has(modulo),
  );
}

export function moduloDesdeRuta(pathname: string): ModuloAcceso | null {
  const limpia = pathname.split("?")[0] ?? "";
  const partes = limpia.split("/").filter(Boolean);
  const base = partes[0];

  if (!base) return null;
  if (base === "dashboard") return "dashboard";
  if (base === "pos") return "pos";
  if (base === "caja") return "caja";
  if (base === "ventas" || base === "ticket") return "ventas";
  if (base === "menu-virtual") return "menu-virtual";
  if (base === "pedidos-cocina") return "pedidos-cocina";
  if (base === "restaurante") {
    const subruta = partes[1] ?? "";
    if (!subruta) return "restaurante-dashboard";
    if (subruta === "pos") return "restaurante-pos";
    if (subruta === "mesas") return "restaurante-mesas";
    if (subruta === "ordenes") return "restaurante-ordenes";
    if (subruta === "delivery") return "restaurante-ordenes";
    if (subruta === "kds") return "restaurante-kds";
    if (subruta === "menu") return "restaurante-menu";
    if (subruta === "recetas") return "restaurante-recetas";
    if (subruta === "inventario") return "restaurante-inventario";
    if (subruta === "existencias") return "restaurante-inventario";
    if (subruta === "movimientos") return "restaurante-inventario";
    if (subruta === "conteos") return "restaurante-inventario";
    if (subruta === "transferencias") return "restaurante-inventario";
    if (subruta === "mermas") return "restaurante-mermas";
    if (subruta === "compras") return "compras";
    if (subruta === "proveedores") return "compras";
    if (subruta === "cxp") return "cxp";
    if (subruta === "caja") return "caja";
    if (subruta === "facturacion") return "facturas";
    if (subruta === "gastos") return "tesoreria";
    if (subruta === "tesoreria") return "tesoreria";
    if (subruta === "contabilidad") return "contabilidad";
    if (subruta === "impuestos") return "restaurante-configuracion";
    if (subruta === "empleados") return "rrhh";
    if (subruta === "asistencia") return "rrhh";
    if (subruta === "nomina") return "rrhh";
    if (subruta === "reservaciones") return "restaurante-reservaciones";
    if (subruta === "comensales") return "restaurante-comensales";
    if (subruta === "reportes") return "restaurante-reportes";
    if (subruta === "promociones") return "restaurante-promociones";
    if (subruta === "soporte") return "restaurante-soporte";
    if (subruta === "configuracion") return "restaurante-configuracion";
    if (subruta === "auditoria") return "restaurante-configuracion";
    if (subruta === "empresa") return "restaurante-configuracion";
    if (subruta === "dispositivos") return "restaurante-configuracion";
    if (subruta === "plan") return "restaurante-plan";
    if (subruta === "mi-cuenta") return "mi-cuenta";
    return "restaurante-dashboard";
  }
  if (base === "inventario") return "inventario";
  if (base === "clientes") return "clientes";
  if (base === "compras") return "compras";
  if (base === "facturas") return "facturas";
  if (base === "cxc") return "cxc";
  if (base === "cxp") return "cxp";
  if (base === "contabilidad") return "contabilidad";
  if (base === "tesoreria") return "tesoreria";
  if (base === "rrhh") return "rrhh";
  if (base === "configuracion") return "configuracion";
  if (base === "soporte") return "soporte";
  if (base === "mi-cuenta") return "mi-cuenta";
  if (base === "reportes") {
    return partes[1] === "rentabilidad" ? "reportes-avanzados" : "reportes";
  }

  return null;
}
