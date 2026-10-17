import { normalizeWebUrl } from "@/lib/company-input";

/**
 * Profile link platforms. Adding one is a single entry here (plus an icon in
 * components/social-icons.tsx): links are stored as one JSON object on the
 * user row, so a new platform needs no migration.
 */
export const SOCIAL_PLATFORMS = [
  { id: "website", label: "Website", hosts: null, profile: null },
  { id: "linkedin", label: "LinkedIn", hosts: ["linkedin.com"], profile: "https://www.linkedin.com/in/{}" },
  { id: "github", label: "GitHub", hosts: ["github.com"], profile: "https://github.com/{}" },
  { id: "gitlab", label: "GitLab", hosts: ["gitlab.com"], profile: "https://gitlab.com/{}" },
  { id: "codepen", label: "CodePen", hosts: ["codepen.io"], profile: "https://codepen.io/{}" },
  { id: "x", label: "X (Twitter)", hosts: ["x.com", "twitter.com"], profile: "https://x.com/{}" },
  { id: "instagram", label: "Instagram", hosts: ["instagram.com"], profile: "https://www.instagram.com/{}" },
  { id: "dribbble", label: "Dribbble", hosts: ["dribbble.com"], profile: "https://dribbble.com/{}" },
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type SocialPlatformId = SocialPlatform["id"];
export type SocialLinks = Partial<Record<SocialPlatformId, string>>;

export const SOCIAL_URL_MAX = 200;

export const isSocialPlatformId = (v: unknown): v is SocialPlatformId =>
  SOCIAL_PLATFORMS.some((p) => p.id === v);

export const socialPlatform = (id: SocialPlatformId): SocialPlatform =>
  SOCIAL_PLATFORMS.find((p) => p.id === id)!;

const HANDLE = /^@?([A-Za-z0-9][A-Za-z0-9._-]{0,59})$/;

/**
 * A link for `id` from what the user typed: a full URL on the platform's own
 * domain, or — for profile platforms — just the username ("octocat",
 * "@octocat"). Returns null when it isn't a valid link for that platform.
 */
export function normalizeSocialLink(id: SocialPlatformId, raw: string): string | null {
  const value = raw.trim();
  if (!value || value.length > SOCIAL_URL_MAX) return null;
  const p = socialPlatform(id);
  const onPlatform = (url: string) => {
    const host = new URL(url).hostname.toLowerCase();
    return !p.hosts || p.hosts.some((h) => host === h || host.endsWith(`.${h}`));
  };
  const url = normalizeWebUrl(value);
  if (url && url.length <= SOCIAL_URL_MAX && onPlatform(url)) return url;
  // Not a link to the platform: a bare username ("octocat", "@emre.erden").
  const handle = p.profile && !value.includes("/") ? HANDLE.exec(value) : null;
  return handle && p.profile ? p.profile.replace("{}", handle[1]) : null;
}

/** Keep only known platforms with valid links, in display order. */
export function cleanSocialLinks(input: unknown): SocialLinks | "invalid" {
  if (input === null || input === undefined) return {};
  if (typeof input !== "object" || Array.isArray(input)) return "invalid";
  const out: SocialLinks = {};
  for (const p of SOCIAL_PLATFORMS) {
    const raw = (input as Record<string, unknown>)[p.id];
    if (raw === undefined || raw === null || raw === "") continue;
    if (typeof raw !== "string") return "invalid";
    const link = normalizeSocialLink(p.id, raw);
    if (!link) return "invalid";
    out[p.id] = link;
  }
  return out;
}

/** The user's links as [platform, url] pairs, in display order. */
export const socialEntries = (links: SocialLinks | null | undefined) =>
  SOCIAL_PLATFORMS.filter((p) => links?.[p.id]).map((p) => [p, links![p.id]!] as const);
