import { PageHeaderSkeleton, TrackerSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeaderSkeleton actions={1} />
      <TrackerSkeleton />
    </div>
  );
}
