import { createClient } from "@sanity/client";

// Standalone Cloudflare Worker: daily link-health check over Sanity resources,
// a cleanup of rows nothing reads anymore in the app database, and pruning of
// old decided submissions from Sanity.
// Runs on a Cron Trigger (scheduled handler) — kept separate from the main
// OpenNext app so that app stays a clean fetch-only worker. Writes results
// (linkStatus / lastCheckedAt / httpStatus) back to Sanity. No user auth.

interface Env {
  DB: D1Database;
  SANITY_PROJECT_ID: string;
  SANITY_DATASET: string;
  SANITY_API_VERSION: string;
  SANITY_API_WRITE_TOKEN: string;
}

const BATCH = 80;
/** Consecutive failed checks before a link counts as broken. */
const BROKEN_AFTER = 2;
const CONCURRENCY = 10;
const TIMEOUT_MS = 9000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const BOT_HOSTILE_HOSTS = [
  "marketplace.visualstudio.com",
  "chromewebstore.google.com",
  "chrome.google.com",
  "addons.mozilla.org",
];

function isBotHostile(url: string): boolean {
  try {
    return BOT_HOSTILE_HOSTS.some((h) => new URL(url).hostname.endsWith(h));
  } catch {
    return false;
  }
}

type Status = "ok" | "broken" | "redirect" | "suspect";

async function check(url: string): Promise<{ status: Status; httpStatus?: number }> {
  const opts: RequestInit = {
    redirect: "manual",
    headers: { "user-agent": UA },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  };
  const hostile = isBotHostile(url);
  try {
    let res = await fetch(url, { ...opts, method: "HEAD" });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { ...opts, method: "GET" });
    }
    const code = res.status;
    if (code >= 200 && code < 300) return { status: "ok", httpStatus: code };
    if (code >= 300 && code < 400) return { status: "redirect", httpStatus: code };
    if (code === 403 || code === 429) return { status: "suspect", httpStatus: code };
    if (hostile) return { status: "suspect", httpStatus: code };
    return { status: "broken", httpStatus: code };
  } catch {
    return { status: hostile ? "suspect" : "broken" };
  }
}

async function runLinkCheck(env: Env): Promise<void> {
  const client = createClient({
    projectId: env.SANITY_PROJECT_ID,
    dataset: env.SANITY_DATASET,
    apiVersion: env.SANITY_API_VERSION,
    token: env.SANITY_API_WRITE_TOKEN,
    useCdn: false,
  });

  const resources = await client.fetch<
    { _id: string; url: string; linkStatus?: string; linkFailures?: number }[]
  >(
    `*[_type == "resource" && manualOverride != true]
       | order(coalesce(lastCheckedAt, "1970-01-01") asc)[0...$batch]{ _id, url, linkStatus, linkFailures }`,
    { batch: BATCH },
  );

  const now = new Date().toISOString();
  const tx = client.transaction();

  // Simple concurrency limiter (no p-limit dependency).
  let i = 0;
  async function worker() {
    while (i < resources.length) {
      const r = resources[i++];
      const { status, httpStatus } = await check(r.url);
      // A single failed check is often a timeout or a site having a bad
      // moment. Only the second failure in a row marks a link broken (which
      // the site shows, and which refreshes the cached pages); until then it
      // keeps its previous status.
      const failures = status === "broken" ? (r.linkFailures ?? 0) + 1 : 0;
      const shown: Status =
        status === "broken" && failures < BROKEN_AFTER
          ? r.linkStatus === "broken"
            ? "broken"
            : "suspect"
          : status;
      tx.patch(r._id, {
        set: {
          linkStatus: shown,
          linkFailures: failures,
          lastCheckedAt: now,
          ...(httpStatus ? { httpStatus } : {}),
        },
      });
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, resources.length) }, () => worker()),
  );

  if (resources.length > 0) await tx.commit({ visibility: "async" });
  console.log(`link-check: processed ${resources.length} resources`);
}

const DAY_SEC = 24 * 60 * 60;
/** Read notifications are kept this long, then deleted. */
const NOTIFICATION_RETENTION_DAYS = 180;

/**
 * Keeps D1 storage flat: expired sessions and verification tokens are never
 * deleted by Better Auth on its own, rate-limit counters older than their
 * longest window (1h) are dead, and read notifications age out.
 * Timestamps: Better Auth / Drizzle "timestamp" columns are unix seconds,
 * rateLimit.last_request is milliseconds.
 */
async function cleanupDatabase(env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const results = await env.DB.batch([
    env.DB.prepare("DELETE FROM session WHERE expires_at < ?").bind(now),
    env.DB.prepare("DELETE FROM verification WHERE expires_at < ?").bind(now),
    env.DB.prepare("DELETE FROM rateLimit WHERE last_request < ?").bind((now - 2 * 3600) * 1000),
    env.DB.prepare(
      "DELETE FROM notifications WHERE read_at IS NOT NULL AND created_at < ?",
    ).bind(now - NOTIFICATION_RETENTION_DAYS * DAY_SEC),
    // Expired abuse-limit windows (lib/rate-limit.ts).
    env.DB.prepare("DELETE FROM usage_counters WHERE expires_at < ?").bind(now),
  ]);
  console.log(`cleanup: deleted ${results.map((r) => r.meta.changes).join("/")} rows`);
}

/** Decided submissions are removed from Sanity after this many days. */
const SUBMISSION_RETENTION_DAYS = 30;

/**
 * Keeps the Sanity dataset under the free plan's document limit: approved and
 * rejected submissions are only history once decided (the app keeps its own
 * copy in D1 for "My Submissions"), so old ones are deleted. A few dozen per
 * run is plenty.
 */
async function pruneSubmissions(env: Env): Promise<void> {
  const client = createClient({
    projectId: env.SANITY_PROJECT_ID,
    dataset: env.SANITY_DATASET,
    apiVersion: env.SANITY_API_VERSION,
    token: env.SANITY_API_WRITE_TOKEN,
    useCdn: false,
  });
  const cutoff = new Date(Date.now() - SUBMISSION_RETENTION_DAYS * DAY_SEC * 1000).toISOString();
  const ids = await client.fetch<string[]>(
    `*[_type == "submission" && status in ["approved", "rejected"] && _updatedAt < $cutoff][0...50]._id`,
    { cutoff },
  );
  if (!ids.length) return;
  const tx = client.transaction();
  for (const id of ids) tx.delete(id);
  await tx.commit({ visibility: "async" });
  console.log(`prune: deleted ${ids.length} old submissions`);
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runLinkCheck(env).catch((err) => console.error("link-check failed", err)),
    );
    ctx.waitUntil(
      cleanupDatabase(env).catch((err) => console.error("cleanup failed", err)),
    );
    ctx.waitUntil(
      pruneSubmissions(env).catch((err) => console.error("prune failed", err)),
    );
  },
} satisfies ExportedHandler<Env>;
