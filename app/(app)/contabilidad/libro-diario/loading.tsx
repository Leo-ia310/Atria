import { SkeletonHeader, SkeletonFinanceStack } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader actions={3} />
      <SkeletonFinanceStack blocks={5} rows={3} />
    </div>
  );
}
