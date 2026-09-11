import Link from "next/link";
import { ArcaLogo } from "@/components/marketing/ArcaLogo";

export function SeoSimpleHeader() {
  return (
    <header className="border-b border-white/10">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <ArcaLogo className="h-9 w-auto" eager />
          <span className="text-base font-semibold">ARCA</span>
        </Link>
        <Link href="/registro" className="arca-btn arca-btn-sm bg-white text-[#160827]">
          Probar gratis
        </Link>
      </div>
    </header>
  );
}
