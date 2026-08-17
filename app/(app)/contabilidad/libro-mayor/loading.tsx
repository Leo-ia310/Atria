import { SkeletonHeader, SkeletonFinanceStack } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader actions={2} />
      <SkeletonFinanceStack blocks={4} rows={4} />
    </div>
  );
}
