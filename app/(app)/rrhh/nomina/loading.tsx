import { SkeletonHeader, SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader actions={2} />
      <SkeletonTable rows={8} cols={6} />
    </div>
  );
}
