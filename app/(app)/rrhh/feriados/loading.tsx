import { SkeletonHeader, SkeletonList, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <Skeleton className="mb-4 h-3.5 w-32" />
      <SkeletonHeader actions={1} />
      <SkeletonList rows={8} />
    </div>
  );
}
