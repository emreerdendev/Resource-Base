import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { parseBody } from "next-sanity/webhook";
import { isFreshWebhook } from "@/lib/webhook-age";
import { forgetLists, type ListName } from "@/sanity/lib/slugs";

type Body = { _type?: string; slug?: string | null; oldSlug?: string | null; skip?: boolean };

/**
 * Sanity webhook → on-demand revalidation, scoped to what actually changed.
 * A content edit in the Studio refreshes the live site within seconds:
 *  - resource / company → that document's own page, plus the lists showing it
 *  - category / tag     → taxonomy pages and the resource lists (cards show
 *                         category names)
 * Detail pages of other documents are left alone, so one edit costs a handful
 * of re-renders, not hundreds.
 *
 * Configure in sanity.io/manage: filter
 *   _type in ["resource","company","category","tag"]
 * drafts off, and projection
 *   { _type, "slug": slug.current, "oldSlug": before().slug.current,
 *     "skip": delta::changedOnly((lastCheckedAt, httpStatus, linkStatus, linkFailures))
 *       && (before().linkStatus == "broken") == (after().linkStatus == "broken") }
 * `oldSlug` lets a renamed or deleted document's old page be refreshed too.
 * `skip` marks the daily link checker's bookkeeping patches; only a change
 * into or out of "broken" (which the site shows) refreshes anything.
 */
export async function POST(req: NextRequest) {
  try {
    const { isValidSignature, body } = await parseBody<Body>(req, process.env.SANITY_REVALIDATE_SECRET);
    if (!isValidSignature) return new NextResponse("Invalid signature", { status: 401 });
    if (!isFreshWebhook(req)) return new NextResponse("Stale webhook", { status: 401 });
    if (!body?._type) return new NextResponse("Bad request", { status: 400 });
    if (body.skip === true) return NextResponse.json({ revalidated: false, type: body._type });

    const clean = (v: unknown) => (typeof v === "string" && v.length > 0 && v.length <= 120 ? v : null);
    // The current slug and, after a rename or delete, the old one.
    const slugs = [...new Set([clean(body.slug), clean(body.oldSlug)].filter((s): s is string => !!s))];
    const tags: string[] = [];
    const lists: ListName[] = [];
    switch (body._type) {
      case "resource":
        tags.push("resource-list");
        for (const s of slugs) tags.push(`resource:${s}`);
        lists.push("resource", "resourceIds");
        break;
      case "company":
        tags.push("company-list");
        for (const s of slugs) tags.push(`company:${s}`);
        lists.push("company", "companyIds");
        break;
      case "category":
      case "tag":
        tags.push("taxonomy", "resource-list");
        lists.push(body._type);
        break;
      default:
        return NextResponse.json({ revalidated: false, type: body._type });
    }
    // Next 16 requires a cache profile; "max" expires the tagged entries on
    // the next request.
    for (const tag of tags) revalidateTag(tag, "max");
    await forgetLists(lists);
    return NextResponse.json({ revalidated: true, tags });
  } catch (err) {
    console.error(err);
    return new NextResponse("Error", { status: 500 });
  }
}
