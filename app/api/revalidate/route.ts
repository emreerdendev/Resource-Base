import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { parseBody } from "next-sanity/webhook";

/**
 * Sanity webhook → on-demand revalidation. A content edit in the Studio
 * (including a broken-link fix) refreshes the live site within seconds,
 * no redeploy. Configure the webhook in sanity.io/manage to POST here with
 * the secret below and projection:
 *   { _type, "skip": delta::changedOnly((lastCheckedAt, httpStatus)) }
 * `skip` marks the daily link checker's bookkeeping patches, which change
 * nothing on the site — revalidating for those would re-render every page.
 */
export async function POST(req: NextRequest) {
  try {
    const { isValidSignature, body } = await parseBody<{ _type: string; skip?: boolean }>(
      req,
      process.env.SANITY_REVALIDATE_SECRET,
    );

    if (!isValidSignature) {
      return new NextResponse("Invalid signature", { status: 401 });
    }
    if (!body?._type) {
      return new NextResponse("Bad request", { status: 400 });
    }

    if (body.skip === true) {
      return NextResponse.json({ revalidated: false, type: body._type });
    }

    // Every fetch is tagged with its document type(s), so the type's tag
    // refreshes both detail and list pages. Next 16 requires a cache profile;
    // "max" expires the tagged fetch entries on the next request.
    revalidateTag(body._type, "max");

    return NextResponse.json({ revalidated: true, type: body._type });
  } catch (err) {
    console.error(err);
    return new NextResponse("Error", { status: 500 });
  }
}
