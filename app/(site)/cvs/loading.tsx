import { ResourceGridSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="mb-6 h-12 w-full rounded-xl" />
      <ResourceGridSkeleton count={12} />
    </div>
  );
}
