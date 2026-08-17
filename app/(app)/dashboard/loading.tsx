import { SkeletonHeader, SkeletonKpis, SkeletonList, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader actions={2} />
      <SkeletonKpis count={4} />
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SkeletonList rows={6} />
        </div>
        <div className="arca-card p-5">
          <Skeleton className="h-4 w-24" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3.5 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
