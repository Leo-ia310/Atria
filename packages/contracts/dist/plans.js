"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionPlans = void 0;
exports.subscriptionPlans = {
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
};
