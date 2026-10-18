import { getMyCv, type MyCv } from "@/lib/cv-actions";

let current: { userId: string; cv: Promise<MyCv | null> } | null = null;

/**
 * The signed-in user's own CV, shared by the profile, My Submissions and the
 * CV tab so they don't each ask for it; `fresh` after changing it. A failure
 * isn't cached.
 */
export function loadMyCv(userId: string, fresh = false): Promise<MyCv | null> {
  if (fresh || current?.userId !== userId) {
    const cv = getMyCv();
    const entry = { userId, cv };
    current = entry;
    cv.catch(() => {
      if (current === entry) current = null;
    });
  }
  return current!.cv;
}
