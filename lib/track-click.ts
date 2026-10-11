const KEY = "rb:clicks";
const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Count an outbound resource click at most once per day per browser — the same
 * window the server dedups on, so repeat clicks don't even cost a request.
 * Returns true when the click was sent (callers bump their local count then).
 */
export function trackClick(resourceId: string): boolean {
  const now = Date.now();
  let seen: Record<string, number> = {};
  try {
    seen = JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {}
  if (now - (seen[resourceId] ?? 0) < WINDOW_MS) return false;
  // Drop expired entries so the map stays small.
  for (const id in seen) if (now - seen[id] >= WINDOW_MS) delete seen[id];
  seen[resourceId] = now;
  try {
    localStorage.setItem(KEY, JSON.stringify(seen));
  } catch {}
  fetch("/api/click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resourceId }),
    keepalive: true,
  }).catch(() => {});
  return true;
}
