import { SkeletonHeader, SkeletonKpis, SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonHeader actions={1} />
      <SkeletonKpis count={3} />
      <SkeletonTable rows={10} cols={7} />
    </div>
  );
}
