import { authClient } from "@/lib/auth-client";

let pending: Promise<string[]> | null = null;

/**
 * Provider ids of the signed-in user's sign-in methods ("credential" for a
 * password, "google", "github"…). Shared by the Account tab's sections, so
 * opening it sends one request instead of one per section; `fresh` after a
 * change. A failure isn't cached.
 */
export function loadLinkedAccounts(fresh = false): Promise<string[]> {
  if (fresh || !pending) {
    const next = authClient.listAccounts().then((res) => {
      if (res?.error || !res?.data) throw new Error(res?.error?.message ?? "list_accounts_failed");
      return (res.data as { providerId?: string }[]).map((a) => a.providerId ?? "").filter(Boolean);
    });
    pending = next;
    next.catch(() => {
      if (pending === next) pending = null;
    });
  }
  return pending;
}
