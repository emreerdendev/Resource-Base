import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Personal or action pages: nothing to index, and every crawl would be
      // a wasted render.
      disallow: [
        "/api/",
        "/favorites",
        "/applications",
        "/liked-cvs",
        "/submissions",
        "/submit/",
        "/notifications",
        "/profile/edit",
        "/reset-password",
        "/verify-email",
        "/@",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
