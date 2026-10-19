"use client";

import { GithubIcon } from "@/components/brand-icons";
import { Separator } from "@/components/ui/separator";
import { Boxes, CircleDot, Globe, Heart, Mail, Users } from "lucide-react";
import { NavLink } from "@/components/nav-link";
import { useTranslation } from "react-i18next";

const REPO_URL = "https://github.com/emreerdendev/Resource-Base";
const ISSUES_URL = "https://github.com/emreerdendev/Resource-Base/issues";
const SITE_URL = "https://emreerden.dev";
const SPONSOR_URL = "https://github.com/sponsors/emreerdendev";
const CONTACT_EMAIL = "emreerden@pm.me";

function Dot() {
  return (
    <span aria-hidden="true" className="text-border">
      •
    </span>
  );
}

const linkClass =
  "inline-flex items-center gap-2 rounded-md px-2 py-1 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

export function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="px-4 pb-12 flex flex-col gap-12">
      <Separator className="mx-auto max-w-4xl" />
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-3 rounded-xl border border-border/60 bg-card/40 px-4 py-8 text-sm text-muted-foreground backdrop-blur-sm sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-2 text-foreground">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="size-4" />
          </span>
          <span className="font-semibold">Resource Base</span>
        </div>
        <p className="max-w-md text-center text-xs text-muted-foreground/80">
          {t("footer.tagline")}
        </p>

        {/* Everyone who contributed */}
        <NavLink href="/contributions" className={`${linkClass} text-primary`}>
          <Users className="size-4" aria-hidden="true" />
          <span>{t("footer.contributions")}</span>
        </NavLink>

        {/* Legal */}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs">
          <NavLink href="/privacy" className={linkClass}>
            {t("footer.privacy")}
          </NavLink>
          <Dot />
          <NavLink href="/terms" className={linkClass}>
            {t("footer.terms")}
          </NavLink>
        </div>

        <Separator className="my-2 max-w-md" />

        {/* Contact + personal site */}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
            <Mail className="size-4" aria-hidden="true" />
            <span>{CONTACT_EMAIL}</span>
          </a>
          <Dot />
          <a
            href={SITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            <Globe className="size-4" aria-hidden="true" />
            <span>emreerden.dev</span>
          </a>
        </div>

        {/* Project links + sponsor */}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${linkClass} text-primary`}
          >
            <GithubIcon />
            <span>{t("footer.source")}</span>
          </a>
          <Dot />
          <a
            href={ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            <CircleDot className="size-4" aria-hidden="true" />
            <span>{t("footer.reportIssue")}</span>
          </a>
          <Dot />
          <a
            href={SPONSOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-medium text-primary outline-none transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Heart className="size-4 fill-current" aria-hidden="true" />
            <span>{t("footer.sponsor")}</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
