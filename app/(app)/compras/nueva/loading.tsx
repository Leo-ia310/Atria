import { SkeletonHeader, SkeletonForm, SkeletonTable } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl">
      <SkeletonHeader />
      <SkeletonForm fields={4} />
      <div className="mt-4">
        <SkeletonTable rows={4} cols={5} />
      </div>
    </div>
  );
}
