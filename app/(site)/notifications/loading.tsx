import { PageHeaderSkeleton, RowListSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeaderSkeleton />
      <RowListSkeleton />
    </div>
  );
}
