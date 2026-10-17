"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Boxes,
  BriefcaseBusiness,
  Building2,
  FileText,
  Heart,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

/** CSS-only entrance (tw-animate-css) so content is visible before hydration. */
const ENTER = "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500";

function DirectoryCard({
  href,
  icon: Icon,
  title,
  stat,
  body,
  cta,
  className,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  stat: string;
  body: string;
  cta: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "card-hover group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{stat}</p>
        </div>
      </div>
      <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        {cta}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

/** Homepage: what Resource Base is, and the way into each directory. */
export function HomeOnboarding({
  companies,
  resources,
  categories,
}: {
  companies: number;
  resources: number;
  categories: number;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();


  return (
    <div className="mx-auto max-w-4xl">
      <section className="flex flex-col items-center pt-6 pb-12 text-center">
        <span
          className={`mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground ${ENTER}`}
        >
          {t("home.onboardBadge")}
        </span>
        <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          {/* Keep the trailing dash on the lead's line. */}
          {t("home.onboardTitleLead").replace(/ (\S+)$/, "\u00a0$1")}{" "}
          <span className="text-primary">{t("home.onboardTitleHighlight")}</span>
        </h1>
        <p className="mx-auto mt-4 max-w-4xl text-balance text-muted-foreground">
          {t("home.onboardSubtitle")}
        </p>
        {user && (
          // Signed in: straight back to your own lists.
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {[
              { href: "/favorites", icon: Star, label: t("nav.favorites") },
              { href: "/applications", icon: BriefcaseBusiness, label: t("nav.applications") },
              { href: "/liked-cvs", icon: Heart, label: t("nav.likedCvs") },
            ].map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <Icon className="size-4" />
                {label}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DirectoryCard
          href="/resources"
          icon={Boxes}
          title={t("nav.resources")}
          stat={t("home.resourcesStat", { count: resources, categories })}
          body={t("home.resourcesBody")}
          cta={t("favorites.browse")}
          className={`${ENTER} delay-75`}
        />
        <DirectoryCard
          href="/companies"
          icon={Building2}
          title={t("nav.companies")}
          stat={t("home.companiesStat", { count: companies })}
          body={t("home.companiesBody")}
          cta={t("tracker.browse")}
          className={`${ENTER} delay-150`}
        />
        <DirectoryCard
          href="/cvs"
          icon={FileText}
          title={t("nav.cvs")}
          stat={t("home.cvsStat")}
          body={t("home.cvsBody")}
          cta={t("cvs.browse")}
          className={`${ENTER} delay-200 sm:col-span-2 lg:col-span-1`}
        />
      </section>
    </div>
  );
}
