import { toast } from "sonner";
import i18n from "@/lib/i18n";
import { getViewerState } from "@/lib/viewer-actions";

export type ViewerState = Awaited<ReturnType<typeof getViewerState>>;

let current: { userId: string; state: Promise<ViewerState> } | null = null;

/** Waits between attempts: a blip (a 429, a redeploy, a D1 hiccup) passes. */
const RETRY_DELAYS = [1000, 3000];

async function fetchWithRetry(): Promise<ViewerState> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await getViewerState();
    } catch (err) {
      const wait = RETRY_DELAYS[attempt];
      if (wait === undefined) throw err;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

/**
 * The signed-in user's initial data, fetched once per user and shared by the
 * profile, favorites, tracker, submissions and notifications providers. Later
 * refreshes go through each provider's own action. A failed load is retried;
 * if it still fails the user is told and offered a reload, rather than shown
 * empty lists as if they had nothing saved.
 */
export function loadViewer(userId: string): Promise<ViewerState> {
  if (current?.userId !== userId) {
    const state = fetchWithRetry().catch((err) => {
      if (current?.state === state) current = null;
      toast.error(i18n.t("viewer.loadError"), {
        id: "viewer-load-error",
        duration: Infinity,
        action: { label: i18n.t("notFound.retry"), onClick: () => window.location.reload() },
      });
      throw err;
    });
    current = { userId, state };
  }
  return current.state;
}
