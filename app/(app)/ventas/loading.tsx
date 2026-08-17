import { SkeletonHeader, SkeletonFilterBar, SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader actions={3} />
      <div className="mb-4">
        <SkeletonFilterBar fields={5} />
      </div>
      <SkeletonTable rows={10} cols={7} />
    </div>
  );
}
