import { SkeletonHeader, SkeletonForm } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl">
      <SkeletonHeader actions={1} />
      <SkeletonForm fields={8} />
    </div>
  );
}
