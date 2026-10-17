"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { Download, ExternalLink, FileText, Flag, Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCvLikes } from "@/components/cv-likes-provider";
import { useProfile } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { contactEmail } from "@/lib/site";
import { similarCvs } from "@/lib/cv-similar";
import type { CvListing } from "@/lib/types";
import { cn } from "@/lib/utils";

// PDF.js (~450 KB with its worker) is loaded only when a phone opens a preview.
const PdfViewer = dynamic(() => import("@/components/pdf-viewer").then((m) => m.PdfViewer), {
  ssr: false,
});

const SMALL = "(max-width: 767px)";
function useSmallScreen() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(SMALL);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(SMALL).matches,
    () => false,
  );
}

/**
 * In-page CV viewer for signed-in users. Desktop browsers show the PDF in their
 * own viewer inside an iframe; phones (whose browsers can't render a PDF in a
 * frame) get it drawn by PDF.js. Nothing loads until the dialog opens, so
 * browsing the list never downloads a CV.
 */
export function CvPreview({
  cv: initialCv,
  pool = [],
  open,
  onOpenChange,
}: {
  cv: CvListing;
  /** The loaded listing, for "Similar CVs" (computed here, no extra request). */
  pool?: CvListing[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  // A similar CV opens in place; closing returns to the one this was opened for.
  const [shownId, setShownId] = useState(initialCv.id);
  const cv = pool.find((x) => x.id === shownId) ?? initialCv;
  const similar = useMemo(() => similarCvs(cv, pool), [cv, pool]);
  const change = (o: boolean) => {
    if (!o) setShownId(initialCv.id);
    onOpenChange(o);
  };
  const likes = useCvLikes();
  const { profile } = useProfile();
  // Your own CV can't be liked (the server refuses it too).
  const own = Boolean(profile?.username) && profile?.username === cv.owner.username;
  const liked = likes.liked(cv.id);
  const small = useSmallScreen();
  const file = `/api/cv/${cv.id}/file`;
  const report = `mailto:${contactEmail}?subject=${encodeURIComponent(`Report CV ${cv.id}`)}&body=${encodeURIComponent(`CV: ${cv.title}\nReason: `)}`;

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-3 sm:max-w-4xl">
        <div className="pr-8">
          <DialogTitle className="leading-tight">{cv.title}</DialogTitle>
          <DialogDescription className="mt-1">
            {t(`cvs.field.${cv.field}`)} · {t(`cvs.seniority.${cv.seniority}`)} ·{" "}
            {t(`cvs.language.${cv.language}`)}
          </DialogDescription>
        </div>

        {open &&
          (small ? (
            <PdfViewer key={cv.id} url={file} title={cv.title} errorText={t("cvs.previewError")} />
          ) : (
            <iframe
              key={cv.id}
              src={file}
              title={cv.title}
              className="h-[70vh] w-full rounded-lg border border-border bg-muted"
            />
          ))}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-pressed={liked}
            disabled={own}
            aria-label={t(liked ? "cvs.unlike" : "cvs.like")}
            onClick={() => likes.toggle(cv.id)}
            className={cn("tabular-nums", liked && "text-rose-500 hover:text-rose-500")}
          >
            <Heart className={cn("size-4", liked && "fill-current")} />
            {likes.count(cv.id, cv.likeCount)}
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={file} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" /> {t("cvs.newTab")}
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`${file}?download=1`}>
              <Download className="size-4" /> {t("cvs.download")}
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm" className="ml-auto text-muted-foreground">
            <a href={report}>
              <Flag className="size-4" /> {t("cvs.report")}
            </a>
          </Button>
        </div>

        {similar.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t("cvs.similar")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {similar.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setShownId(o.id)}
                  className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40"
                >
                  <FileText className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{o.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t(`cvs.field.${o.field}`)} · {t(`cvs.seniority.${o.seniority}`)}
                      {o.technologies.length > 0 && ` · ${o.technologies.slice(0, 3).join(", ")}`}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
