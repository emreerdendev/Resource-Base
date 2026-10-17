/**
 * Usernames: 3–20 letters or digits. Case is kept as typed ("EmreErden") but
 * never makes a name distinct — "emre568" and "eMRe568" are the same name.
 * Uniqueness is enforced on lower(username) by a unique index; lookups are
 * case-insensitive too.
 */
export const USERNAME_RE = /^[A-Za-z0-9]{3,20}$/;

export const isValidUsername = (v: unknown): v is string =>
  typeof v === "string" && USERNAME_RE.test(v);

/** A public profile's URL: /@username (rewritten to /profile/[username]). */
export const profilePath = (username: string) => `/@${username}`;
