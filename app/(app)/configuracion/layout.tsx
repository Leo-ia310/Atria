import { BackLink } from "@/components/layout/BackLink";

export default function ConfiguracionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <BackLink
        href="/configuracion"
        label="Volver a Configuración"
        hideOn="/configuracion"
      />
      {children}
    </div>
  );
}
