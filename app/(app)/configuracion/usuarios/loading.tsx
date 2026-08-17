import { SkeletonHeader, SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader actions={1} />
      <SkeletonTable rows={7} cols={5} />
    </div>
  );
}
