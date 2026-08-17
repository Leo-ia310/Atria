import { SkeletonHeader, SkeletonKpis, SkeletonCardGrid } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader />
      <SkeletonKpis count={3} />
      <div className="mt-6">
        <SkeletonCardGrid count={2} cols={2} />
      </div>
    </div>
  );
}
