import { SkeletonHeader, SkeletonKpis, SkeletonList } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <SkeletonHeader actions={1} />
      <SkeletonKpis count={4} />
      <SkeletonList rows={5} />
    </div>
  );
}
