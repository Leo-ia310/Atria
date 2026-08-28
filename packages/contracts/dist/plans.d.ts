export declare const subscriptionPlans: {
    readonly business: {
        readonly code: "BUSINESS";
        readonly name: "Business";
        readonly userLimit: 3;
        readonly branchLimit: 1;
        readonly features: readonly ["POS omnicanal", "Inventario multi-almacén básico", "Contabilidad esencial", "Reportes operativos"];
    };
    readonly enterprise: {
        readonly code: "ENTERPRISE";
        readonly name: "Enterprise";
        readonly userLimit: null;
        readonly branchLimit: null;
        readonly features: readonly ["Usuarios ilimitados", "Multi-sucursal avanzada", "Analítica ejecutiva", "API access", "Permisos empresariales"];
    };
};
export type SubscriptionPlanKey = keyof typeof subscriptionPlans;
