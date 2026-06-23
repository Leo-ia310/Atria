import Link from "next/link";
import { requireSession } from "@/lib/actions/session-helpers";
import { redirect } from "next/navigation";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession();
  if (!user.esSuperAdmin) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[color:var(--color-dark-bg)] text-[color:var(--color-text-on-dark)]">
      <header className="border-b border-white/10 px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-base font-semibold">
              ATRIA
            </Link>
            <span className="atria-badge atria-badge-warning">SuperAdmin</span>
          </div>
          <Link
            href="/dashboard"
            className="text-small text-white/60 hover:text-white"
          >
            ← Volver al dashboard
          </Link>
        </div>
      </header>
      <main className="p-8">{children}</main>
    </div>
  );
}
