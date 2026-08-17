import { SkeletonHeader, SkeletonList } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader actions={1} />
      <SkeletonList rows={5} />
    </div>
  );
}
