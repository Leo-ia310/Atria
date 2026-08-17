import { SkeletonHeader, SkeletonKpis, SkeletonList, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader actions={1} />
      <SkeletonKpis count={4} />
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3.5 w-20" />
      </div>
      <SkeletonList rows={6} title={false} />
    </div>
  );
}
