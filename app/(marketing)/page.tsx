import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";
import { Landing } from "./Landing";

export const metadata: Metadata = {
  title: "ARCA — Punto de venta, inventario y contabilidad en un solo sistema",
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "ARCA — El sistema operativo de tu negocio",
    description: SITE_DESCRIPTION,
    url: "/",
    type: "website",
    siteName: SITE_NAME,
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: "ARCA — El sistema operativo de tu negocio",
    description: SITE_DESCRIPTION,
  },
};

export default function LandingPage() {
  return <Landing />;
}
