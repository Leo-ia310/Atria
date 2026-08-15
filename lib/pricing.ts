/**
 * Planes, precios y feature flags de ARCA.
 * Estos valores son la fuente de verdad para pricing, limites y acceso runtime.
 * `asegurarPlanes` los sincroniza con la tabla `planes`.
 */

export type PlanId = "demo" | "pro" | "enterprise";

export const DESCUENTO_ANUAL_PORCENTAJE = 30;
export const DIAS_TRIAL_PLAN_PAGO = 15;
export const DIAS_GRACIA_PAGO = 7;
export const DIAS_VIGENCIA_DEMO = 36500;

export type PlanFeatures = {
  pos: boolean;
  inventario_basico: boolean;
  inventario_avanzado: boolean;
  facturacion: boolean;
  contabilidad: boolean;
  contabilidad_consolidada: boolean;
  multi_sucursal: boolean;
  transferencia_inventario: boolean;
  cotizaciones: boolean;
  gestion_proveedores: boolean;
  modulo_gastos: boolean;
  cuentas_por_cobrar: boolean;
  reportes_avanzados: boolean;
  reportes_comparativos: boolean;
  permisos_granulares: boolean;
  auditoria_completa: boolean;
  api_acceso: boolean;
  api_rest_completa: boolean;
  webhooks: boolean;
  ia_asistente: boolean;
  ia_reportes: boolean;
  ia_predicciones: boolean;
  modulo_nomina: boolean;
  rol_auditor: boolean;
  soporte_chat: boolean;
  soporte_247: boolean;
  gerente_cuenta: boolean;
  onboarding_1a1: boolean;
  sla_999: boolean;
  exportacion_datos: boolean;
  white_label: boolean;
};

export type Plan = {
  id: PlanId;
  nombre: string;
  descripcionCorta: string;
  precioMensual: number;
  precioAnual: number;
  precioAnualMensualizado: number;
  ahorroAnualPorcentaje: number;
  maxSucursales: number | null;
  maxUsuarios: number | null;
  maxProductos: number | null;
  maxTransaccionesMes: number | null;
  maxClientes: number | null;
  maxFacturasMes: number | null;
  precioUsuarioExtra: number | null;
  precioSucursalExtra: number | null;
  features: PlanFeatures;
  destacado?: boolean;
};

const FEATURES_VACIAS: PlanFeatures = {
  pos: false,
  inventario_basico: false,
  inventario_avanzado: false,
  facturacion: false,
  contabilidad: false,
  contabilidad_consolidada: false,
  multi_sucursal: false,
  transferencia_inventario: false,
  cotizaciones: false,
  gestion_proveedores: false,
  modulo_gastos: false,
  cuentas_por_cobrar: false,
  reportes_avanzados: false,
  reportes_comparativos: false,
  permisos_granulares: false,
  auditoria_completa: false,
  api_acceso: false,
  api_rest_completa: false,
  webhooks: false,
  ia_asistente: false,
  ia_reportes: false,
  ia_predicciones: false,
  modulo_nomina: false,
  rol_auditor: false,
  soporte_chat: false,
  soporte_247: false,
  gerente_cuenta: false,
  onboarding_1a1: false,
  sla_999: false,
  exportacion_datos: false,
  white_label: false,
};

export const PLANES: Record<PlanId, Plan> = {
  demo: {
    id: "demo",
    nombre: "Demo",
    descripcionCorta: "Gratis para explorar ARCA con punto de venta completo y limites claros.",
    precioMensual: 0,
    precioAnual: 0,
    precioAnualMensualizado: 0,
    ahorroAnualPorcentaje: 0,
    maxSucursales: 1,
    maxUsuarios: 1,
    maxProductos: 25,
    maxTransaccionesMes: 50,
    maxClientes: 20,
    maxFacturasMes: 10,
    precioUsuarioExtra: null,
    precioSucursalExtra: null,
    features: {
      ...FEATURES_VACIAS,
      pos: true,
      inventario_basico: true,
      inventario_avanzado: true,
      facturacion: true,
      contabilidad: true,
      cotizaciones: true,
      gestion_proveedores: true,
      modulo_gastos: true,
      cuentas_por_cobrar: true,
      reportes_avanzados: true,
      permisos_granulares: true,
      ia_asistente: true,
      modulo_nomina: true,
      soporte_chat: true,
      exportacion_datos: true,
    },
  },
  pro: {
    id: "pro",
    nombre: "Pro",
    descripcionCorta: "Operacion completa para una sucursal: ventas, finanzas y nomina.",
    precioMensual: 20,
    precioAnual: 168,
    precioAnualMensualizado: 14,
    ahorroAnualPorcentaje: DESCUENTO_ANUAL_PORCENTAJE,
    maxSucursales: 1,
    maxUsuarios: 7,
    maxProductos: null,
    maxTransaccionesMes: null,
    maxClientes: null,
    maxFacturasMes: null,
    precioUsuarioExtra: 5,
    precioSucursalExtra: null,
    destacado: true,
    features: {
      ...FEATURES_VACIAS,
      pos: true,
      inventario_basico: true,
      inventario_avanzado: true,
      facturacion: true,
      contabilidad: true,
      cotizaciones: true,
      gestion_proveedores: true,
      modulo_gastos: true,
      cuentas_por_cobrar: true,
      reportes_avanzados: true,
      permisos_granulares: true,
      ia_asistente: true,
      modulo_nomina: true,
      soporte_chat: true,
      exportacion_datos: true,
    },
  },
  enterprise: {
    id: "enterprise",
    nombre: "Enterprise",
    descripcionCorta: "Multi-sucursal, IA integrada, API y control corporativo.",
    precioMensual: 99,
    precioAnual: 831.6,
    precioAnualMensualizado: 69.3,
    ahorroAnualPorcentaje: DESCUENTO_ANUAL_PORCENTAJE,
    maxSucursales: 5,
    maxUsuarios: 20,
    maxProductos: null,
    maxTransaccionesMes: null,
    maxClientes: null,
    maxFacturasMes: null,
    precioUsuarioExtra: 5,
    precioSucursalExtra: 30,
    features: {
      ...FEATURES_VACIAS,
      pos: true,
      inventario_basico: true,
      inventario_avanzado: true,
      facturacion: true,
      contabilidad: true,
      contabilidad_consolidada: true,
      multi_sucursal: true,
      transferencia_inventario: true,
      cotizaciones: true,
      gestion_proveedores: true,
      modulo_gastos: true,
      cuentas_por_cobrar: true,
      reportes_avanzados: true,
      reportes_comparativos: true,
      permisos_granulares: true,
      auditoria_completa: true,
      api_acceso: true,
      api_rest_completa: true,
      webhooks: true,
      ia_asistente: true,
      ia_reportes: true,
      ia_predicciones: true,
      modulo_nomina: true,
      rol_auditor: true,
      soporte_chat: true,
      soporte_247: true,
      gerente_cuenta: true,
      onboarding_1a1: true,
      sla_999: true,
      exportacion_datos: true,
      white_label: true,
    },
  },
};

export const PLANES_ARRAY: Plan[] = [PLANES.demo, PLANES.pro, PLANES.enterprise];

export type PlanAiLimits = {
  preguntasDiarias: number | null;
  palabrasPorPregunta: number | null;
  respuestaMaxTokens: number;
};

export const LIMITES_IA_POR_PLAN: Record<PlanId, PlanAiLimits> = {
  demo: {
    preguntasDiarias: 5,
    palabrasPorPregunta: 35,
    respuestaMaxTokens: 180,
  },
  pro: {
    preguntasDiarias: null,
    palabrasPorPregunta: 150,
    respuestaMaxTokens: 420,
  },
  enterprise: {
    preguntasDiarias: null,
    palabrasPorPregunta: 500,
    respuestaMaxTokens: 700,
  },
};

export function getLimitesIA(planId: PlanId): PlanAiLimits {
  return LIMITES_IA_POR_PLAN[planId] ?? LIMITES_IA_POR_PLAN.demo;
}

export function descripcionLimiteIA(planId: PlanId): string {
  const limites = getLimitesIA(planId);
  if (planId === "demo") {
    return `IA: ${limites.preguntasDiarias} preguntas cortas al dia`;
  }
  if (planId === "pro") {
    return `IA sin limite diario, ${limites.palabrasPorPregunta} palabras/pregunta`;
  }
  return `IA avanzada, ${limites.palabrasPorPregunta} palabras/pregunta`;
}

export function getPlan(id: string): Plan {
  return PLANES[id as PlanId] ?? PLANES.demo;
}

export function puedeUsar(plan: Plan, feature: keyof PlanFeatures): boolean {
  return plan.features[feature] === true;
}

export function dentroDeLimite(
  plan: Plan,
  recurso:
    | "sucursales"
    | "usuarios"
    | "productos"
    | "transacciones_mes"
    | "clientes"
    | "facturas_mes",
  cantidadActual: number,
  extras = 0,
): { permitido: boolean; limite: number | null; usado: number } {
  const limites = {
    sucursales: plan.maxSucursales,
    usuarios: plan.maxUsuarios,
    productos: plan.maxProductos,
    transacciones_mes: plan.maxTransaccionesMes,
    clientes: plan.maxClientes,
    facturas_mes: plan.maxFacturasMes,
  };
  const limite = limites[recurso];
  if (limite === null) return { permitido: true, limite: null, usado: cantidadActual };
  return {
    permitido: cantidadActual < limite + extras,
    limite: limite + extras,
    usado: cantidadActual,
  };
}
