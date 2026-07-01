import { SessionProvider } from "@/components/layout/SessionProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { ServiceWorkerBoot } from "@/components/pos/ServiceWorkerBoot";

export default function POSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <ToastProvider>
        <ServiceWorkerBoot />
        <div className="min-h-screen bg-[color:var(--color-neutral)]">{children}</div>
      </ToastProvider>
    </SessionProvider>
  );
}
