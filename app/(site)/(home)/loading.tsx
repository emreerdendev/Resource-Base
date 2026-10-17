import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors HomeOnboarding: badge, headline, directory cards, three steps. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-col items-center gap-4 pt-6 pb-12">
        <Skeleton className="h-6 w-44 rounded-full" />
        <Skeleton className="h-11 w-full max-w-xl" />
        <Skeleton className="h-11 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mx-auto mt-14 mb-5 h-4 w-32" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
