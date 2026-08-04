export const ARCA_PRICING = {
  currency: "USD",
  maxUsers: 100,
  pro: {
    name: "Pro",
    monthlyPrice: 39,
    includedUsers: 7,
  },
  enterprise: {
    name: "Enterprise",
    monthlyPrice: 149,
    includedUsers: 10,
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
    label: "8 a 10 usuarios",
    detail: "Enterprise base",
  },
  {
    id: "additional",
    label: "Mas de 10",
    detail: "Usuarios adicionales",
  },
] as const;
