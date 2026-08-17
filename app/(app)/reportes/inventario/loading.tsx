import { SkeletonHeader, SkeletonKpis, SkeletonChartRow } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader actions={1} />
      <SkeletonKpis count={4} />
      <div className="mt-6">
        <SkeletonChartRow />
      </div>
    </div>
  );
}
