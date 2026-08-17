import { SkeletonHeader, SkeletonCardGrid } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader />
      <SkeletonCardGrid count={10} cols={4} />
    </div>
  );
}
