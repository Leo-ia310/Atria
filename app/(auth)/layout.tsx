import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[color:var(--color-neutral)]">
      <header className="flex items-center justify-between px-8 py-5">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[color:var(--color-primary)] text-white">
            <span className="text-base font-bold">A</span>
          </div>
          <span className="text-base font-semibold text-[color:var(--color-text-primary)]">
            ATRIA
          </span>
        </Link>
        <Link
          href="/precios"
          className="text-small text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)]"
        >
          Ver planes
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        {children}
      </main>
    </div>
  );
}
