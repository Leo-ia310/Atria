import { SkeletonHeader, SkeletonDetail } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader actions={2} />
      <SkeletonDetail />
    </div>
  );
}
