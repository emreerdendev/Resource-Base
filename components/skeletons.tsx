import { Skeleton } from "@/components/ui/skeleton";

/** A single resource-card placeholder. */
function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="mt-4 flex gap-1.5">
        <Skeleton className="h-4 w-12 rounded-full" />
        <Skeleton className="h-4 w-10 rounded-full" />
      </div>
    </div>
  );
}

/** A responsive grid of card skeletons. */
export function ResourceGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Header + grid placeholder for list-style pages. */
export function ListPageSkeleton({ actions = 0 }: { actions?: number }) {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeaderSkeleton actions={actions} />
      <ResourceGridSkeleton count={6} />
    </div>
  );
}

/** Mirrors PageHeader: icon + title, a description line, optional actions. */
export function PageHeaderSkeleton({ actions = 0 }: { actions?: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3">
        <Skeleton className="size-6 rounded-md" />
        <Skeleton className="h-8 w-48" />
        {actions > 0 && (
          <div className="ml-auto flex gap-2">
            {Array.from({ length: actions }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-28 rounded-md" />
            ))}
          </div>
        )}
      </div>
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
    </div>
  );
}

/** Stacked list rows (notifications, tracker entries). */
export function RowListSkeleton({ count = 5, logo = false }: { count?: number; logo?: boolean }) {
  return (
    <ul className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          {logo && <Skeleton className="size-10 shrink-0 rounded-lg" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          {logo && <Skeleton className="h-8 w-24 rounded-md" />}
        </li>
      ))}
    </ul>
  );
}

/** Mirrors ApplicationsTracker: status tiles, toolbar, rows. */
export function TrackerSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1 rounded-md" />
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>
      <RowListSkeleton count={6} logo />
    </div>
  );
}

/** Labelled form fields; `tall` marks textarea indexes. */
export function FormSkeleton({ fields = 6, tall = [] }: { fields?: number; tall?: number[] }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className={`w-full rounded-md ${tall.includes(i) ? "h-20" : "h-9"}`} />
        </div>
      ))}
      <Skeleton className="h-9 w-32 rounded-lg" />
    </div>
  );
}

/** Mirrors the resource/company detail pages: breadcrumb, header, body, related. */
export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-4xl">
      <Skeleton className="mb-6 h-4 w-40" />
      <div className="flex items-start gap-4">
        <Skeleton className="size-14 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-64 max-w-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <div className="mt-8 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-24 rounded-full" />
        ))}
      </div>
      <Skeleton className="mt-12 mb-4 h-4 w-36" />
      <ResourceGridSkeleton count={3} />
    </div>
  );
}

/** Mirrors the tag/category pages: breadcrumb, icon + title + count, grid. */
export function CollectionSkeleton() {
  return (
    <div className="mx-auto max-w-4xl">
      <Skeleton className="mb-6 h-4 w-40" />
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="size-14 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <ResourceGridSkeleton />
    </div>
  );
}

/** Mirrors PublicProfileView: centered avatar, name, links, contributions. */
export function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="size-20 rounded-full" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-64" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="size-9 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="mt-12">
        <Skeleton className="mb-4 h-4 w-32" />
        <ResourceGridSkeleton count={6} />
      </div>
    </div>
  );
}

/** Long-form text page (privacy, terms). */
export function ProseSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mb-8 h-4 w-40" />
      {Array.from({ length: 4 }).map((_, s) => (
        <div key={s} className="space-y-2 pb-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

/** Small centered card (password reset, email verification). */
export function AuthCardSkeleton() {
  return (
    <div className="mx-auto max-w-sm space-y-4 py-10">
      <Skeleton className="mx-auto h-7 w-48" />
      <Skeleton className="mx-auto h-4 w-64 max-w-full" />
      <Skeleton className="h-9 w-full rounded-md" />
      <Skeleton className="h-9 w-full rounded-md" />
      <Skeleton className="h-9 w-full rounded-lg" />
    </div>
  );
}
