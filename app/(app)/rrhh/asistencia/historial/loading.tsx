import { SkeletonHeader, SkeletonFilterBar, SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader actions={1} />
      <div className="mb-4">
        <SkeletonFilterBar fields={3} />
      </div>
      <SkeletonTable rows={10} cols={6} />
    </div>
  );
}
