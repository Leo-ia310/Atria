import type { ReactNode } from "react";
import { ConfiguracionBackLink } from "@/components/restaurante/ConfiguracionBackLink";

export default function RestauranteConfiguracionLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ConfiguracionBackLink />
      {children}
    </>
  );
}
