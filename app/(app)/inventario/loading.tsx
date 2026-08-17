import { SkeletonHeader, SkeletonTable, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader actions={4} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-32" />
      </div>
      <SkeletonTable rows={10} cols={6} />
    </div>
  );
}
