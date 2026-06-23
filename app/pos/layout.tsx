import { requireSession } from "@/lib/actions/session-helpers";
import { SessionProvider } from "@/components/layout/SessionProvider";
import { ToastProvider } from "@/components/ui/Toast";

export default async function POSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();
  return (
    <SessionProvider>
      <ToastProvider>
        <div className="min-h-screen bg-[color:var(--color-neutral)]">{children}</div>
      </ToastProvider>
    </SessionProvider>
  );
}
