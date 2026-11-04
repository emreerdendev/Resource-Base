"use client";

import { DiscordIcon, GithubIcon } from "@/components/brand-icons";
import { Separator } from "@/components/ui/separator";
import { Boxes, CircleDot, Globe, Heart, Mail, Users } from "lucide-react";
import { NavLink } from "@/components/nav-link";
import { useTranslation } from "react-i18next";

const REPO_URL = "https://github.com/emreerdendev/Resource-Base";
const ISSUES_URL = "https://github.com/emreerdendev/Resource-Base/issues";
const SITE_URL = "https://emreerden.dev";
const SPONSOR_URL = "https://github.com/sponsors/emreerdendev";
const COFFEE_URL = "https://www.buymeacoffee.com/emreerdendev";
// PSIBS: Product, Startup, Indie, Build, Software — the server's name.
const DISCORD_URL = "https://discord.gg/2C8pYMVAw5";
const CONTACT_EMAIL = "emreerden@pm.me";

function Dot() {
  return (
    // Only between items on one line: the rows stack on phones.
    <span aria-hidden="true" className="hidden text-border sm:inline">
      •
    </span>
  );
}

// Stacked on phones (no dots), one line from sm up.
const rowClass = "flex flex-col items-center justify-center gap-1 sm:flex-row sm:flex-wrap sm:gap-x-2";

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
        <div className={rowClass}>
          <NavLink href="/privacy" className={`${linkClass} text-xs`}>
            {t("footer.privacy")}
          </NavLink>
          <Dot />
          <NavLink href="/terms" className={`${linkClass} text-xs`}>
            {t("footer.terms")}
          </NavLink>
        </div>

        {/* Project links */}
        <div className={rowClass}>
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
        </div>

        <Separator className="my-2 max-w-md" />

        {/* Personal site + contact */}
        <div className={rowClass}>
          <a
            href={SITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            <Globe className="size-4" aria-hidden="true" />
            <span>emreerden.dev</span>
          </a>
          <Dot />
          <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
            <Mail className="size-4" aria-hidden="true" />
            <span>{CONTACT_EMAIL}</span>
          </a>
        </div>

        {/* Community */}
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-3 rounded-xl bg-[#5865F2] px-4 py-2.5 text-left text-white shadow-sm outline-none transition-colors hover:bg-[#4752C4] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <DiscordIcon className="size-6 shrink-0" />
          <span className="flex flex-col leading-tight">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/75">
              PSIBS!
            </span>
            <span className="font-semibold">{t("footer.discord")}</span>
          </span>
        </a>

        {/* Support */}
        <div className={`${rowClass} mt-1`}>
          <a
            href={SPONSOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-medium text-primary outline-none transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Heart className="size-4 fill-current" aria-hidden="true" />
            <span>{t("footer.sponsor")}</span>
          </a>
          <Dot />
          <a
            href={COFFEE_URL}
            target="_blank"
            rel="noopener noreferrer"
            title={t("footer.coffee")}
            className="rounded-lg outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Buy Me a Coffee's own button image */}
            <img
              src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
              alt="Buy Me a Coffee"
              width={130}
              height={36}
              loading="lazy"
              className="h-9 w-auto"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
