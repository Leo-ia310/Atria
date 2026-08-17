import { SkeletonHeader, SkeletonKpis, SkeletonCardGrid, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader />
      <SkeletonKpis count={4} />
      <Skeleton className="mb-3 mt-8 h-5 w-44" />
      <SkeletonCardGrid count={3} cols={3} />
    </div>
  );
}
