export const ARCA_PRICING = {
  currency: "USD",
  maxUsers: 100,
  pro: {
    name: "Pro",
    monthlyPrice: 20,
    includedUsers: 7,
  },
  enterprise: {
    name: "Enterprise",
    monthlyPrice: 99,
    includedUsers: 20,
    additionalUserPrice: 5,
  },
} as const;

export const USER_QUANTITY_MARKS = [
  {
    id: "pro",
    label: "1 a 7 usuarios",
    detail: "Plan Pro",
  },
  {
    id: "enterprise",
    label: "8 a 20 usuarios",
    detail: "Enterprise base",
  },
  {
    id: "additional",
    label: "Mas de 20",
    detail: "Usuarios adicionales",
  },
] as const;
