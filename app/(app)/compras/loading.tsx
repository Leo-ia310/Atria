import { SkeletonHeader, SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader actions={3} />
      <SkeletonTable rows={10} cols={6} />
    </div>
  );
}
