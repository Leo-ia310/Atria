import type { NextConfig } from "next";

// Cabeceras de seguridad aplicadas a toda respuesta. No incluimos una CSP con
// `script-src` estricta porque el App Router inyecta scripts inline de bootstrap
// que requerirían nonces por request; en su lugar fijamos las directivas de CSP
// que son seguras sin nonce (anti-clickjacking, anti base-tag, anti-plugins) y
// dejamos el resto del endurecimiento a las cabeceras dedicadas.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  images: {
    // Solo optimizamos imágenes de hosts conocidos. `hostname: "**"` convertía
    // a `/_next/image` en un proxy abierto (SSRF / amplificador de ancho de
    // banda). Añade aquí cualquier CDN propio adicional que uses.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
