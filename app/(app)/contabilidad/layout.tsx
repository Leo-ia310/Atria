import { BackLink } from "@/components/layout/BackLink";

export default function ContabilidadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <BackLink
        href="/contabilidad"
        label="Volver a Contabilidad"
        hideOn="/contabilidad"
      />
      {children}
    </div>
  );
}
