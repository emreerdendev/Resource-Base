import { Suspense } from "react";
import type { Metadata } from "next";
import { ProfileSettings } from "@/components/profile-settings";
import { FormSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

export const metadata: Metadata = {
  title: "Edit Profile",
  robots: { index: false, follow: false },
};

// Auth enforced in middleware (PROTECTED_PAGES); the view gates on the client
// too. Suspense: the active tab is read from ?tab= on the client.
export default function ProfileEditPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Suspense
        fallback={
          <>
            <PageHeaderSkeleton actions={1} />
            <FormSkeleton fields={9} tall={[3]} />
          </>
        }
      >
        <ProfileSettings />
      </Suspense>
    </div>
  );
}
