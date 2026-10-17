import { FormSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

/** Mirrors ProfileEditForm: header, then labelled fields (bio is taller). */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeaderSkeleton />
      <FormSkeleton fields={9} tall={[3]} />
    </div>
  );
}
