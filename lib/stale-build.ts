/**
 * After a deploy, a tab opened before it still runs the previous build: the
 * page and lazy-loaded scripts it asks for were removed, and its server
 * action ids no longer exist. Those failures look like this.
 */
const STALE_BUILD =
  /ChunkLoadError|Loading (?:CSS )?chunk [\w-]+ failed|dynamically imported module|Importing a module script failed|Failed to find Server Action|Server Action "?[\w-]+"? was not found/i;

export function isStaleBuildError(error: unknown): boolean {
  if (!error) return false;
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return STALE_BUILD.test(text);
}

const KEY = "rb-build-reload";

/** Whether this tab already reloaded for a new build in the last 30 seconds. */
export function reloadedRecently(): boolean {
  try {
    return Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < 30_000;
  } catch {
    return false;
  }
}

/**
 * Reload once onto the new build. Returns false (and does nothing) if this
 * tab already did in the last 30 seconds, so a real error can never become a
 * reload loop.
 */
export function reloadForNewBuild(): boolean {
  if (reloadedRecently()) return false;
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // No storage (private mode): still reload; the browser's own cache of the
    // new build makes a second failure unlikely.
  }
  window.location.reload();
  return true;
}
