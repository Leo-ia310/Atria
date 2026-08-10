import type { Plan, PlanFeatures } from "@/lib/pricing";

export type ModuloAcceso =
  | "dashboard"
  | "pos"
  | "caja"
  | "ventas"
  | "menu-virtual"
  | "pedidos-cocina"
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

export function tienePermiso(
  access: AccessSnapshot,
  permisos: string | string[],
): boolean {
  if (access.esAdminEmpresa) return true;
  const requeridos = Array.isArray(permisos) ? permisos : [permisos];
  return requeridos.some((permiso) => access.permisos.includes(permiso));
}

export function puedeAccederModulo(
  access: AccessSnapshot,
  modulo: ModuloAcceso,
): boolean {
  const regla = REGLAS_ACCESO[modulo];
  if (regla.siempre) return true;
  if (regla.soloAdmin && !access.esAdminEmpresa) return false;
  if (regla.soloRestaurante && access.tipoEmpresa !== "restaurante") return false;

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
    puedeAccederModulo(access, modulo),
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
