import { SkeletonHeader, SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader actions={2} />
      <SkeletonTable rows={10} cols={5} />
    </div>
  );
}
