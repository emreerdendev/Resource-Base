"use client";

import { NavLink as Link } from "@/components/nav-link";
import { Boxes, Building2, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * Switch between the ways to contribute, in the site order: a resource, a
 * company, or your CV (shared from Edit Profile).
 */
export function SubmitTabs({ active }: { active: "company" | "resource" }) {
  const { t } = useTranslation();
  const tabs = [
    { key: "resource", href: "/submit/resource", label: t("nav.submit"), icon: Boxes },
    { key: "company", href: "/submit/company", label: t("nav.suggestCompany"), icon: Building2 },
    { key: "cv", href: "/profile/edit?tab=cv", label: t("cvs.share"), icon: FileText },
  ] as const;
  return (
    <div className="mb-8 grid grid-cols-1 gap-1 sm:grid-cols-3 rounded-xl border border-border bg-muted/40 p-1">
      {tabs.map(({ key, href, label, icon: Icon }) => (
        <Link
          key={key}
          href={href}
          replace
          aria-current={active === key ? "page" : undefined}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            active === key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </div>
  );
}
