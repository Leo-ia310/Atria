import { BackLink } from "@/components/layout/BackLink";

export default function ReportesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <BackLink href="/reportes" label="Volver a Reportes" hideOn="/reportes" />
      {children}
    </div>
  );
}
