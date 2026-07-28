import { requireSession } from "@/lib/actions/session-helpers";
import { requireModulo } from "@/lib/server-access";
import { SessionProvider } from "@/components/layout/SessionProvider";
import { ToastProvider } from "@/components/ui/Toast";

export default async function POSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession();
  await requireModulo(user, "pos");
  return (
    <SessionProvider>
      <ToastProvider>
        <div className="min-h-screen bg-[color:var(--color-neutral)]">{children}</div>
      </ToastProvider>
    </SessionProvider>
  );
}
