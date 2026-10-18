import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Per-step durations for a request, sent as a `Server-Timing` header (the
 * browser's Network panel shows them under "Timing") and logged. Lets slow
 * uploads be split into "the file travelling" vs "the server's steps".
 */
export function serverTiming() {
  const start = Date.now();
  let last = start;
  const parts: string[] = [];
  return {
    mark(name: string) {
      const now = Date.now();
      parts.push(`${name};dur=${now - last}`);
      last = now;
    },
    header() {
      return [...parts, `total;dur=${Date.now() - start}`].join(", ");
    },
  };
}

/** Run cleanup after the response is sent (doesn't keep the user waiting). */
export function inBackground(task: Promise<unknown>) {
  const safe = task.catch((err) => console.error("background task failed", err));
  try {
    getCloudflareContext().ctx.waitUntil(safe);
  } catch {
    void safe;
  }
}
