import type { CvListing } from "@/lib/types";

/**
 * CVs close to `cv`, from the listing the page already has (no extra request).
 * A match needs the same field or a shared technology; it's ranked by shared
 * technologies (2 each), same field (3), seniority (1) and language (1), then
 * by likes. Nothing unrelated is added to fill the list.
 */
export function similarCvs(cv: CvListing, pool: CvListing[], limit = 4): CvListing[] {
  const tech = new Set(cv.technologies.map((x) => x.toLowerCase()));
  return pool
    .filter((o) => o.id !== cv.id)
    .map((o) => {
      const shared = o.technologies.filter((x) => tech.has(x.toLowerCase())).length;
      const sameField = o.field === cv.field;
      const score =
        shared * 2 +
        (sameField ? 3 : 0) +
        (o.seniority === cv.seniority ? 1 : 0) +
        (o.language === cv.language ? 1 : 0);
      return { o, score, match: sameField || shared > 0 };
    })
    .filter((x) => x.match)
    .sort((a, b) => b.score - a.score || b.o.likeCount - a.o.likeCount)
    .slice(0, limit)
    .map((x) => x.o);
}
