import { SkeletonHeader, SkeletonList, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader actions={1} />
      <div className="arca-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
      <SkeletonList rows={6} />
    </div>
  );
}
