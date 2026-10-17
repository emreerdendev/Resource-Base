/**
 * Usernames: 3–20 letters or digits. Case is kept as typed ("EmreErden") but
 * never makes a name distinct — "emre568" and "eMRe568" are the same name.
 * Uniqueness is enforced on lower(username) by a unique index; lookups are
 * case-insensitive too.
 */
export const USERNAME_RE = /^[A-Za-z0-9]{3,20}$/;

export const isValidUsername = (v: unknown): v is string =>
  typeof v === "string" && USERNAME_RE.test(v);

/**
 * Names nobody can take. Exact matches only (any case): "admin" and "Admin"
 * are blocked, "adminemre" is not.
 */
const RESERVED = new Set([
  // Official-looking names
  "admin", "administrator", "root", "sysadmin", "superuser", "owner", "staff", "team",
  "official", "verified", "moderator", "mod", "support", "help", "helpdesk", "security",
  "abuse", "trustandsafety", "legal", "privacy", "contact", "info", "noreply", "mailer",
  "postmaster", "webmaster", "hostmaster", "system", "bot", "resourcebase", "resourcebaseteam", "rbteam",
  // Site pages and features
  "api", "app", "auth", "login", "logout", "signin", "signup", "register",
  "account", "accounts", "profile", "profiles", "settings", "edit", "dashboard", "notifications",
  "submissions", "submit", "applications", "favorites", "studio", "resources", "resource", "companies",
  "company", "cvs", "cv", "categories", "category", "tags", "tag", "search",
  "about", "terms", "cookies", "status", "blog", "docs", "home", "www",
  "mail", "email",
  // Vague or misleading names
  "null", "undefined", "anonymous", "anon", "unknown", "deleted", "deleteduser", "guest",
  "user", "test", "demo", "example", "everyone", "all", "here", "me",
  "you", "self",
  // Brands and platforms
  "google", "github", "gitlab", "linkedin", "microsoft", "apple", "cloudflare", "sanity",
  "vercel", "openai", "anthropic", "claude",
].map((w) => w.toLowerCase()));

export const isReservedUsername = (v: string) => RESERVED.has(v.trim().toLowerCase());

/** A public profile's URL: /@username (rewritten to /profile/[username]). */
export const profilePath = (username: string) => `/@${username}`;
