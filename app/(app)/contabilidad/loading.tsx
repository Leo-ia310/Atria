import { SkeletonHeader, SkeletonKpis, SkeletonCardGrid } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader />
      <SkeletonKpis count={3} />
      <div className="mt-6">
        <SkeletonCardGrid count={7} cols={3} />
      </div>
    </div>
  );
}
