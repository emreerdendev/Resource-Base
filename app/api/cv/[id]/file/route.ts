import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/authz";
import { cvBucket, isAdminEmail } from "@/lib/cv-files";
import { getDb } from "@/lib/db";
import { cvs } from "@/lib/db/schema";
import { overLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Serve a CV's PDF. Published CVs open for any signed-in user (CVs carry
 * personal data, so they stay away from anonymous crawlers); the owner can
 * always open their own; admins (ADMIN_EMAILS) can open pending ones to review.
 * Browsers render PDFs in their own viewer (not as this site's page), and
 * nosniff keeps the bytes from ever being sniffed as HTML; the site-wide CSP
 * (next.config.ts) applies on top.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const sp = req.nextUrl.searchParams;
  const user = await getSessionUser();
  if (!user) return new NextResponse("Sign in to view CVs", { status: 401 });
  // The Studio's review link: open to the site's admins only.
  const reviewer = isAdminEmail(user.email);
  // Generous for reading, but stops a signed-in script from bulk-downloading.
  if (!reviewer && (await overLimit("RL_USER", `cv-file:${user.id}`)))
    return new NextResponse("Too many requests", { status: 429 });

  const [cv] = await getDb()
    .select({ userId: cvs.userId, status: cvs.status, fileKey: cvs.fileKey, title: cvs.title })
    .from(cvs)
    .where(eq(cvs.id, id))
    .limit(1);
  const allowed = cv && (reviewer || cv.status === "published" || cv.userId === user?.id);
  if (!allowed) return new NextResponse("Not found", { status: 404 });

  const object = await cvBucket().get(cv.fileKey);
  if (!object) return new NextResponse("Not found", { status: 404 });
  const filename = `${cv.title.replace(/[^\w.-]+/g, "-").slice(0, 60) || "cv"}.pdf`;
  return new NextResponse(object.body, {
    headers: {
      "Content-Type": "application/pdf",
      // ?download=1 saves the file instead of opening it in the viewer.
      "Content-Disposition": `${sp.get("download") ? "attachment" : "inline"}; filename="${filename}"`,
      "Content-Length": String(object.size),
      "X-Content-Type-Options": "nosniff",
      // Personal data: never in shared caches, briefly in the viewer's browser.
      "Cache-Control": "private, max-age=600",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}
