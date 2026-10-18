import { siteName } from "@/lib/site";

/**
 * The site's share image (app/opengraph-image.png, a screenshot of the home
 * page). Pages that set their own openGraph/twitter metadata replace the
 * inherited image, so they list it again. Bump `v` when the image changes so
 * X and LinkedIn fetch it again instead of their cached copy.
 */
export const OG_IMAGE = {
  url: "/opengraph-image.png?v=2",
  width: 1200,
  height: 630,
  alt: `${siteName} — Resources, Companies and CVs in one directory`,
};

/** Page-level share metadata: own title, description and URL, plus the image. */
export function shareMeta(title: string, description: string, path: string) {
  return {
    alternates: { canonical: path },
    openGraph: { title, description, url: path, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image" as const, title, description, images: [OG_IMAGE.url] },
  };
}
