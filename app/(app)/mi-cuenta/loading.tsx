import { SkeletonHeader, SkeletonForm, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SkeletonHeader />
      <div className="arca-card flex items-center gap-4 p-5 sm:p-6">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <SkeletonForm fields={4} />
    </div>
  );
}
