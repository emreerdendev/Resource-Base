import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { parseBody } from "next-sanity/webhook";
import { isFreshWebhook } from "@/lib/webhook-age";
import { forgetLists, type ListName } from "@/sanity/lib/slugs";

type Body = { _type?: string; slug?: string | null; skip?: boolean };

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
 *   { _type, "slug": slug.current, "skip": delta::changedOnly((lastCheckedAt, httpStatus, linkStatus))
 *       && (before().linkStatus == "broken") == (after().linkStatus == "broken") }
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

    const slug = typeof body.slug === "string" && body.slug.length <= 120 ? body.slug : null;
    const tags: string[] = [];
    const lists: ListName[] = [];
    switch (body._type) {
      case "resource":
        tags.push("resource-list");
        if (slug) tags.push(`resource:${slug}`);
        lists.push("resource", "resourceIds");
        break;
      case "company":
        tags.push("company-list");
        if (slug) tags.push(`company:${slug}`);
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
