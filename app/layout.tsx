import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ReferralTracker } from "@/components/referrals/ReferralTracker";
import { Analytics } from "@vercel/analytics/next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const themeScript = `
(() => {
  try {
    const stored = localStorage.getItem("arca:theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored === "light" || stored === "dark" ? stored : prefersDark ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = "light";
  }
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ARCA — Sistema operativo para el comercio",
    template: "%s · ARCA",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "punto de venta",
    "sistema POS",
    "inventario",
    "contabilidad",
    "facturación",
    "software para negocios",
    "pymes Latinoamérica",
    "Honduras",
    "Nicaragua",
    "Guatemala",
    "Costa Rica",
    "El Salvador",
    "Estados Unidos",
    "México",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "business",
  icons: {
    icon: "/Favicon.ico",
    shortcut: "/Favicon.ico",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "es_ES",
    url: SITE_URL,
    title: "ARCA — Sistema operativo para el comercio",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "ARCA — Sistema operativo para el comercio",
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ReferralTracker />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
