"use client";

import { CategoryIcon } from "@/components/category-icon";
import type { Category } from "@/lib/types";
import { ArrowUpRight } from "lucide-react";
import { NavLink as Link } from "@/components/nav-link";
import { useTranslation } from "react-i18next";

type Domain = "developer" | "designer" | "general";
const DOMAIN_ORDER: Domain[] = ["developer", "designer", "general"];

export function CategoriesClient({ categories }: { categories: Category[] }) {
  const { t } = useTranslation();

  const topLevel = categories
    .filter((c) => !c.parentSlug)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const childrenOf = (slug: string) =>
    categories
      .filter((c) => c.parentSlug === slug)
      .sort((a, b) => b.count - a.count);

  const totalFor = (cat: Category) =>
    cat.count + childrenOf(cat.slug).reduce((n, c) => n + c.count, 0);

  // Group top-level categories by domain for a clean, scalable layout.
  const byDomain = DOMAIN_ORDER.map((domain) => ({
    domain,
    cats: topLevel.filter((c) => (c.domain ?? "general") === domain),
  })).filter((g) => g.cats.length > 0);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("categories.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {t("categories.subtitle")}
        </p>
      </div>

      <div className="space-y-12">
        {byDomain.map(({ domain, cats }) => (
          <section key={domain}>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t(`categories.domain.${domain}`)}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cats.map((cat) => {
                const children = childrenOf(cat.slug);
                return (
                  <div
                    key={cat._id}
                    className="card-hover group rounded-xl border border-border bg-card p-5"
                  >
                    <Link
                      href={`/category/${cat.slug}`}
                      className="flex items-center gap-3"
                    >
                      <span className="grid size-11 place-items-center rounded-lg bg-primary/10 text-primary">
                        <CategoryIcon name={cat.icon} className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="inline-flex items-center gap-1 font-medium">
                          <span className="group-hover:underline">
                            {cat.title}
                          </span>
                          <ArrowUpRight className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {t("categories.count", { count: totalFor(cat) })}
                        </p>
                      </div>
                    </Link>
                    {children.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {children.map((c) => (
                          <Link
                            key={c._id}
                            href={`/category/${c.slug}`}
                            className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                          >
                            {c.title}
                            <span className="ml-1 opacity-60">{c.count}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
