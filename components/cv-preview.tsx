"use client";

import { Download, ExternalLink, Flag, Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCvLikes } from "@/components/cv-likes-provider";
import { useProfile } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { contactEmail } from "@/lib/site";
import type { CvListing } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * In-page CV viewer for signed-in users. Desktop browsers show the PDF in an
 * iframe; phones (whose browsers don't render PDFs in frames) get "open in a
 * new tab" and "download" instead. The iframe only loads when the dialog is
 * open, so browsing the list never downloads a CV.
 */
export function CvPreview({
  cv,
  open,
  onOpenChange,
}: {
  cv: CvListing;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const likes = useCvLikes();
  const { profile } = useProfile();
  // Your own CV can't be liked (the server refuses it too).
  const own = Boolean(profile?.username) && profile?.username === cv.owner.username;
  const liked = likes.liked(cv.id);
  const file = `/api/cv/${cv.id}/file`;
  const report = `mailto:${contactEmail}?subject=${encodeURIComponent(`Report CV ${cv.id}`)}&body=${encodeURIComponent(`CV: ${cv.title}\nReason: `)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-3 sm:max-w-4xl">
        <div className="pr-8">
          <DialogTitle className="leading-tight">{cv.title}</DialogTitle>
          <DialogDescription className="mt-1">
            {t(`cvs.field.${cv.field}`)} · {t(`cvs.seniority.${cv.seniority}`)} ·{" "}
            {t(`cvs.language.${cv.language}`)}
          </DialogDescription>
        </div>

        {open && (
          <iframe
            src={file}
            title={cv.title}
            className="hidden h-[70vh] w-full rounded-lg border border-border bg-muted md:block"
          />
        )}
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground md:hidden">
          {t("cvs.mobileHint")}
        </p>

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
      </DialogContent>
    </Dialog>
  );
}
