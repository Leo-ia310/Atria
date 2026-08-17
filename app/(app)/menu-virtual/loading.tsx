import { SkeletonHeader, SkeletonCardGrid } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader actions={1} />
      <SkeletonCardGrid count={3} cols={3} />
    </div>
  );
}
