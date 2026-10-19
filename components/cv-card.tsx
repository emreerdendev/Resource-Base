"use client";

import { useState } from "react";
import { NavLink as Link } from "@/components/nav-link";
import { FileText, Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth/auth-provider";
import { useCvLikes } from "@/components/cv-likes-provider";
import { useProfile } from "@/lib/profile";
import { CvPreview } from "@/components/cv-preview";
import { Button } from "@/components/ui/button";
import { initial } from "@/lib/initial";
import type { CvListing } from "@/lib/types";
import { cn } from "@/lib/utils";
import { profilePath } from "@/lib/username";

const MAX_TECH = 5;

/** One CV in the directory: what it's for, who shared it, likes, and a link to the PDF. */
export function CvCard({ cv, pool }: { cv: CvListing; pool?: CvListing[] }) {
  const { t } = useTranslation();
  const { user, openAuth } = useAuth();
  const likes = useCvLikes();
  const { profile } = useProfile();
  // Your own CV can't be liked (the server refuses it too).
  const own = Boolean(profile?.username) && profile?.username === cv.owner.username;
  const liked = likes.liked(cv.id);
  const count = likes.count(cv.id, cv.likeCount);
  const owner = cv.owner.name || (cv.owner.username ? `@${cv.owner.username}` : "");
  const extra = cv.technologies.length - MAX_TECH;
  const [open, setOpen] = useState(false);
  // Viewing a CV needs an account: guests get the sign-in dialog instead.
  const preview = () => (user ? setOpen(true) : openAuth());

  return (
    <article className="card-hover flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <FileText className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-medium leading-tight">
            <button type="button" onClick={preview} className="cursor-pointer text-left hover:underline">
              {cv.title}
            </button>
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(`cvs.field.${cv.field}`)} · {t(`cvs.seniority.${cv.seniority}`)} ·{" "}
            {t(`cvs.language.${cv.language}`)}
          </p>
        </div>
      </div>

      {cv.summary && <p className="line-clamp-2 text-sm text-muted-foreground">{cv.summary}</p>}

      {cv.technologies.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {cv.technologies.slice(0, MAX_TECH).map((tech) => (
            <li key={tech} className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
              {tech}
            </li>
          ))}
          {extra > 0 && <li className="px-1 py-0.5 text-xs text-muted-foreground">+{extra}</li>}
        </ul>
      )}

      <div className="mt-auto flex items-center gap-2 pt-1">
        {owner &&
          (cv.owner.username ? (
            <Link
              href={profilePath(cv.owner.username)}
              className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Avatar src={cv.owner.avatar} name={owner} />
              <span className="truncate">{owner}</span>
            </Link>
          ) : (
            <span className="truncate text-xs text-muted-foreground">{owner}</span>
          ))}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={liked}
            disabled={own}
            aria-label={t(liked ? "cvs.unlike" : "cvs.like")}
            onClick={() => (user ? likes.toggle(cv.id) : openAuth())}
            className={cn("gap-1 tabular-nums", liked && "text-rose-500 hover:text-rose-500")}
          >
            <Heart className={cn("size-4", liked && "fill-current")} />
            {/* No "0": the count appears with the first like. */}
            {count > 0 && count}
          </Button>
          <Button variant="outline" size="sm" onClick={preview}>
            {t(user ? "cvs.preview" : "cvs.signInToOpen")}
          </Button>
        </div>
      </div>
      {user && <CvPreview cv={cv} pool={pool} open={open} onOpenChange={setOpen} />}
    </article>
  );
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  return (
    <span className="grid size-5 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-[10px] font-medium">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
      ) : (
        initial(name)
      )}
    </span>
  );
}
