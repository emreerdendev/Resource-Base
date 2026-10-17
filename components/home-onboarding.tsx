"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookmarkCheck,
  Boxes,
  BriefcaseBusiness,
  Building2,
  FileText,
  Search,
  Send,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";

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

  const steps = [
    { icon: Search, title: t("home.steps.find.title"), body: t("home.steps.find.body") },
    { icon: BookmarkCheck, title: t("home.steps.track.title"), body: t("home.steps.track.body") },
    { icon: Send, title: t("home.steps.apply.title"), body: t("home.steps.apply.body") },
  ];

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
        <p className="mx-auto mt-4 max-w-2xl text-balance text-muted-foreground">
          {t("home.onboardSubtitle")}
        </p>
        {user && (
          <Link
            href="/applications"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <BriefcaseBusiness className="size-4" />
            {t("home.continueTracking")}
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DirectoryCard
          href="/companies"
          icon={Building2}
          title={t("nav.companies")}
          stat={t("home.companiesStat", { count: companies })}
          body={t("home.companiesBody")}
          cta={t("tracker.browse")}
          className={`${ENTER} delay-75`}
        />
        <DirectoryCard
          href="/resources"
          icon={Boxes}
          title={t("nav.resources")}
          stat={t("home.resourcesStat", { count: resources, categories })}
          body={t("home.resourcesBody")}
          cta={t("favorites.browse")}
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

      <section className="mt-14">
        <h2 className="mb-5 text-center text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {t("home.howItWorks")}
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }, i) => (
            <li
              key={title}
              className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card/40 p-5"
            >
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <Icon className="size-4 text-primary" />
                <h3 className="text-sm font-semibold">{title}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
