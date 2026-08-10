import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Building2, ReceiptText, Tags } from "lucide-react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/actions/session-helpers";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession();
  if (!user.esSuperAdmin) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[color:var(--color-dark-bg)] text-[color:var(--color-text-on-dark)]">
      <header className="border-b border-white/10 px-4 py-4 sm:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-base font-semibold">
              ARCA
            </Link>
            <span className="arca-badge arca-badge-warning">SuperAdmin</span>
          </div>
          <nav className="flex flex-wrap gap-2 text-small">
            <AdminLink href="/superadmin" icon={BarChart3} label="Dashboard" />
            <AdminLink href="/superadmin/tenants" icon={Building2} label="Clientes" />
            <AdminLink href="/superadmin/gastos" icon={ReceiptText} label="Gastos" />
            <AdminLink href="/superadmin/planes" icon={Tags} label="Planes" />
          </nav>
          <Link href="/dashboard" className="text-small text-white/60 hover:text-white">
            Volver al dashboard
          </Link>
        </div>
      </header>
      <main className="p-4 sm:p-8">{children}</main>
    </div>
  );
}

function AdminLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-white/65 transition hover:bg-white/10 hover:text-white"
    >
      <Icon size={14} />
      {label}
    </Link>
  );
}
