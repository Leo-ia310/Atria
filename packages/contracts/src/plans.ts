export const subscriptionPlans = {
  business: {
    code: "BUSINESS",
    name: "Business",
    userLimit: 3,
    branchLimit: 1,
    features: [
      "POS omnicanal",
      "Inventario multi-almacén básico",
      "Contabilidad esencial",
      "Reportes operativos",
    ],
  },
  enterprise: {
    code: "ENTERPRISE",
    name: "Enterprise",
    userLimit: null,
    branchLimit: null,
    features: [
      "Usuarios ilimitados",
      "Multi-sucursal avanzada",
      "Analítica ejecutiva",
      "API access",
      "Permisos empresariales",
    ],
  },
} as const;

export type SubscriptionPlanKey = keyof typeof subscriptionPlans;
