import { SkeletonHeader, SkeletonFinanceTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader actions={2} />
      <SkeletonFinanceTable rows={14} />
    </div>
  );
}
