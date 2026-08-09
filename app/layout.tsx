import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ReferralTracker } from "@/components/referrals/ReferralTracker";
import { Analytics } from "@vercel/analytics/next";
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
  title: {
    default: "ARCA — Sistema operativo para el comercio",
    template: "%s · ARCA",
  },
  description:
    "Punto de venta, inventario y contabilidad en un solo motor. Para negocios reales de Latinoamérica.",
  icons: {
    icon: "/Favicon.ico",
    shortcut: "/Favicon.ico",
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
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
