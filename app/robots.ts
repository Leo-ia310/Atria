import type { MetadataRoute } from "next";
import { SITE_URL, urlAbsoluta } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/precios",
          "/soluciones",
          "/soluciones/",
          "/alternativas",
          "/alternativas/",
          "/legal",
          "/legal/",
          "/llms.txt",
        ],
        disallow: [
          "/api/",
          "/dashboard",
          "/pos",
          "/restaurante",
          "/superadmin",
          "/login",
          "/registro",
          "/recuperar",
          "/mi-cuenta",
          "/ticket/",
        ],
      },
    ],
    sitemap: urlAbsoluta("/sitemap.xml"),
    host: SITE_URL,
  };
}
