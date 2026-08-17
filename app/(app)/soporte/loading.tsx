import { SkeletonHeader, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader />
      <div className="arca-card flex flex-col p-5 sm:p-6">
        <Skeleton className="h-4 w-48" />
        <div className="mt-6 flex-1 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={i % 2 === 0 ? "flex justify-start" : "flex justify-end"}>
              <Skeleton className="h-16 w-3/5 rounded-lg" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-6 h-11 w-full" />
      </div>
    </div>
  );
}
