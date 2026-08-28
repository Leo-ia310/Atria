import type { MetadataRoute } from "next";
import { urlAbsoluta } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const ahora = new Date();

  const publicas: {
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/precios", priority: 0.9, changeFrequency: "weekly" },
    { path: "/legal", priority: 0.3, changeFrequency: "yearly" },
    { path: "/legal/terminos", priority: 0.3, changeFrequency: "yearly" },
    { path: "/legal/privacidad", priority: 0.3, changeFrequency: "yearly" },
    { path: "/legal/cookies", priority: 0.3, changeFrequency: "yearly" },
    { path: "/legal/tratamiento-datos", priority: 0.3, changeFrequency: "yearly" },
    { path: "/legal/uso-aceptable", priority: 0.3, changeFrequency: "yearly" },
    { path: "/legal/inteligencia-artificial", priority: 0.3, changeFrequency: "yearly" },
  ];

  return publicas.map(({ path, priority, changeFrequency }) => ({
    url: urlAbsoluta(path),
    lastModified: ahora,
    changeFrequency,
    priority,
  }));
}
