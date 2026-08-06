import type { Metadata } from "next";
import { Presentacion } from "./Presentacion";

export const metadata: Metadata = {
  title: "ARCA — Tu negocio completo en un solo sistema",
  description:
    "Punto de venta, inventario y contabilidad conectados en una sola plataforma. Empieza gratis, sin tarjeta ni contrato.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PresentacionPage() {
  return <Presentacion />;
}
