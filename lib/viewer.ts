import { getViewerState } from "@/lib/viewer-actions";

export type ViewerState = Awaited<ReturnType<typeof getViewerState>>;

let current: { userId: string; state: Promise<ViewerState> } | null = null;

/**
 * The signed-in user's initial data, fetched once per user and shared by the
 * profile, favorites, tracker, submissions and notifications providers. Later
 * refreshes go through each provider's own action.
 */
export function loadViewer(userId: string): Promise<ViewerState> {
  if (current?.userId !== userId) {
    const state = getViewerState().catch((err) => {
      if (current?.state === state) current = null;
      throw err;
    });
    current = { userId, state };
  }
  return current.state;
}
