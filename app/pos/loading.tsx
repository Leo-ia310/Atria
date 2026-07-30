import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex h-screen flex-col bg-[color:var(--color-neutral)]">
      <div className="flex items-center justify-between border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="grid flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
          <Skeleton className="mb-3 h-10 w-full" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
        <div className="lg:col-span-5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
          <Skeleton className="mb-3 h-8 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
