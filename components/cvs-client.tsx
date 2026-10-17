"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Heart, Search, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth/auth-provider";
import { CvCard } from "@/components/cv-card";
import { useCvLikes } from "@/components/cv-likes-provider";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { ResourceGridSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CV_FIELDS, CV_LANGUAGES, CV_SENIORITIES } from "@/lib/cv-taxonomy";
import { loadCvListing } from "@/lib/cv-listing";
import { createSearch } from "@/lib/search";
import type { CvListing } from "@/lib/types";
import { cn } from "@/lib/utils";

type Sort = "newest" | "popular";
const PAGE_SIZE = 30;
const TOP_TECH = 12;

/**
 * The CV directory (`mode="all"`) and the signed-in user's liked CVs
 * (`mode="liked"`). The listing comes from the edge-cached /api/cvs, so the
 * page itself stays static.
 */
export function CvsClient({ mode }: { mode: "all" | "liked" }) {
  const { t } = useTranslation();
  const { user, loading: authLoading, openAuth } = useAuth();
  const likes = useCvLikes();
  const [all, setAll] = useState<CvListing[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [field, setField] = useState("");
  const [seniority, setSeniority] = useState("");
  const [language, setLanguage] = useState("");
  const [tech, setTech] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    loadCvListing()
      .then((rows) => active && setAll(rows))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  const base = useMemo(() => {
    if (!all) return [];
    return mode === "liked" ? all.filter((cv) => likes.liked(cv.id)) : all;
  }, [all, mode, likes]);

  const search = useMemo(
    () =>
      createSearch(base, (cv) => cv.title, [
        { get: (cv) => cv.technologies },
        { get: (cv) => [t(`cvs.field.${cv.field}`)] },
        { get: (cv) => (cv.summary ? [cv.summary] : []), match: "words" },
      ]),
    [base, t],
  );

  // The most common technologies become quick-filter chips.
  const topTech = useMemo(() => {
    const n = new Map<string, number>();
    for (const cv of base) for (const x of cv.technologies) n.set(x, (n.get(x) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1]).slice(0, TOP_TECH).map(([x]) => x);
  }, [base]);

  const visible = useMemo(() => {
    const list = (q.trim() ? search(q) : base).filter(
      (cv) =>
        (!field || cv.field === field) &&
        (!seniority || cv.seniority === seniority) &&
        (!language || cv.language === language) &&
        (!tech || cv.technologies.includes(tech)),
    );
    if (sort === "popular" && !q.trim())
      return [...list].sort((a, b) => likes.count(b.id, b.likeCount) - likes.count(a.id, a.likeCount));
    return list;
  }, [base, q, search, field, seniority, language, tech, sort, likes]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const shown = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const header =
    mode === "liked" ? (
      <PageHeader icon={Heart} title={t("cvs.liked.title")} description={t("cvs.liked.subtitle")} />
    ) : (
      <PageHeader
        icon={FileText}
        title={t("cvs.title")}
        description={t("cvs.subtitle")}
        actions={
          <Button asChild size="sm">
            <Link href="/profile/edit?tab=cv">
              <Upload className="size-3.5" /> {t("cvs.share")}
            </Link>
          </Button>
        }
      />
    );

  if (mode === "liked" && !authLoading && !user) {
    return (
      <div className="mx-auto max-w-4xl">
        {header}
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-muted-foreground">{t("cvs.liked.signInPrompt")}</p>
          <Button className="mt-4" onClick={() => openAuth()}>
            {t("header.signIn")}
          </Button>
        </div>
      </div>
    );
  }

  const loading = !all || (mode === "liked" && likes.loading);
  const disclaimer = (
    <p className="mx-auto mt-10 max-w-2xl text-balance text-center text-xs leading-relaxed text-muted-foreground">
      {t("cvs.disclaimer")}
    </p>
  );

  return (
    <div className="mx-auto max-w-4xl">
      {header}

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => reset(() => setQ(e.target.value))}
            placeholder={t("cvs.searchPlaceholder")}
            aria-label={t("cvs.searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <FilterSelect label={t("cvs.filter.field")} value={field} onChange={(v) => reset(() => setField(v))}
          options={CV_FIELDS.map((v) => [v, t(`cvs.field.${v}`)])} />
        <FilterSelect label={t("cvs.filter.seniority")} value={seniority} onChange={(v) => reset(() => setSeniority(v))}
          options={CV_SENIORITIES.map((v) => [v, t(`cvs.seniority.${v}`)])} />
        <FilterSelect label={t("cvs.filter.language")} value={language} onChange={(v) => reset(() => setLanguage(v))}
          options={CV_LANGUAGES.map((v) => [v, t(`cvs.language.${v}`)])} />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label={t("cvs.sort.label")}
          className="h-9 cursor-pointer rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="newest">{t("cvs.sort.newest")}</option>
          <option value="popular">{t("cvs.sort.popular")}</option>
        </select>
      </div>

      {topTech.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-1.5" role="group" aria-label={t("cvs.filter.technology")}>
          {topTech.map((x) => (
            <button
              key={x}
              type="button"
              aria-pressed={tech === x}
              onClick={() => reset(() => setTech(tech === x ? "" : x))}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 text-xs transition-colors",
                tech === x
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {x}
            </button>
          ))}
        </div>
      )}

      {failed ? (
        <p className="py-16 text-center text-muted-foreground">{t("cvs.loadError")}</p>
      ) : loading ? (
        <ResourceGridSkeleton count={9} />
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-muted-foreground">
            {base.length === 0 ? t(mode === "liked" ? "cvs.liked.empty" : "cvs.emptyAll") : t("cvs.empty")}
          </p>
          <Button asChild className="mt-4">
            <Link href={mode === "liked" || base.length > 0 ? "/cvs" : "/profile/edit?tab=cv"}>
              {t(mode === "liked" ? "cvs.browse" : base.length === 0 ? "cvs.share" : "cvs.browse")}
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((cv) => (
              <CvCard key={cv.id} cv={cv} />
            ))}
          </div>
          {totalPages > 1 && (
            <Pagination
              page={current}
              totalPages={totalPages}
              onChange={setPage}
              prevLabel={t("browse.prev")}
              nextLabel={t("browse.next")}
              firstLabel={t("browse.first")}
              pageLabel={t("browse.page", { page: current, total: totalPages })}
            />
          )}
        </>
      )}
      {disclaimer}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={cn(
        "h-9 cursor-pointer rounded-md border bg-background px-2 text-sm",
        value ? "border-primary text-primary" : "border-border",
      )}
    >
      <option value="">{label}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
