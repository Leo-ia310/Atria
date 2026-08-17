import { SkeletonHeader, SkeletonKpis, SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader actions={1} />
      <SkeletonKpis count={4} />
      <SkeletonTable rows={10} cols={6} />
    </div>
  );
}
