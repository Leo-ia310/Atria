import { SkeletonHeader, SkeletonKpis, SkeletonCardGrid } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader />
      <div className="mb-6">
        <SkeletonKpis count={4} />
      </div>
      <SkeletonCardGrid count={7} cols={3} />
    </div>
  );
}
