/**
 * Contribution tiers based on how many contributions of any kind a user has
 * had accepted (lib/contributions.ts). Drives the badge on profiles. Kept low:
 * the site is small, so a handful of contributions already stands out. The `labelKey` maps to
 * an i18n key under `contributor.tier.*`.
 */
export type ContributorTier = {
  key: "none" | "newcomer" | "contributor" | "star" | "legend";
  labelKey: string;
  /** Tailwind classes for the badge (border + bg + text). */
  className: string;
  /** Minimum contributions to reach this tier. */
  min: number;
};

const TIERS: ContributorTier[] = [
  {
    key: "legend",
    labelKey: "contributor.tier.legend",
    className:
      "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    min: 10,
  },
  {
    key: "star",
    labelKey: "contributor.tier.star",
    className: "border-primary/40 bg-primary/10 text-primary",
    min: 5,
  },
  {
    key: "contributor",
    labelKey: "contributor.tier.contributor",
    className:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    min: 3,
  },
  {
    key: "newcomer",
    labelKey: "contributor.tier.newcomer",
    className: "border-border bg-muted text-muted-foreground",
    min: 1,
  },
];

/** Returns the tier for a given contribution count, or null below the floor. */
export function contributorTier(count: number): ContributorTier | null {
  return TIERS.find((tier) => count >= tier.min) ?? null;
}
