export const RESTAURANTE_FEATURES = {
  delivery: process.env.NEXT_PUBLIC_RESTAURANTE_DELIVERY === "true",
  menuQr: process.env.NEXT_PUBLIC_RESTAURANTE_MENU_QR === "true",
  impuestosPage: process.env.NEXT_PUBLIC_RESTAURANTE_IMPUESTOS_PAGE === "true",
  personalSidebar: process.env.NEXT_PUBLIC_RESTAURANTE_PERSONAL_SIDEBAR === "true",
} as const;
