"use client";

import { useEffect } from "react";
import { MessageSquareQuote } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useContributors } from "@/components/contributors-provider";
import { NavLink as Link } from "@/components/nav-link";
import { profilePath } from "@/lib/username";

/**
 * What the contributor wrote when suggesting this resource or company — on
 * its detail page only. Plain text (no links), credited to them when their
 * profile is known.
 */
export function ContributorNote({ note, userId }: { note: string; userId?: string | null }) {
  const { t } = useTranslation();
  const { register, get } = useContributors();
  useEffect(() => {
    if (userId) register(userId);
  }, [register, userId]);
  const who = userId ? get(userId) : undefined;
  return (
    <figure className="rounded-xl border border-border bg-muted/30 p-4">
      <figcaption className="mb-2 flex flex-wrap items-center gap-x-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <MessageSquareQuote className="size-3.5" aria-hidden="true" />
        {t("contributorNote.title")}
        {who?.username && (
          <>
            <span aria-hidden="true">·</span>
            <Link
              href={profilePath(who.username)}
              className="normal-case tracking-normal transition-colors hover:text-foreground"
            >
              @{who.username}
            </Link>
          </>
        )}
      </figcaption>
      <blockquote className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">{note}</blockquote>
    </figure>
  );
}
