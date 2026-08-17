import { SkeletonHeader, SkeletonDetail } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader actions={1} />
      <SkeletonDetail />
    </div>
  );
}
