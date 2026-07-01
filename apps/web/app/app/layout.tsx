import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { SessionProvider } from "@/components/layout/SessionProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { RealtimeBoot } from "@/components/layout/RealtimeBoot";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <ToastProvider>
        <RealtimeBoot />
        <div className="min-h-screen bg-[color:var(--color-neutral)]">
          <Sidebar />
          <div style={{ marginLeft: "var(--sidebar-width)" }}>
            <Header breadcrumb={[{ label: "Atria" }]} />
            <main className="p-6">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}
