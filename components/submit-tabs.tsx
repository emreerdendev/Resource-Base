"use client";

import Link from "next/link";
import { Boxes, Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/** Switch between suggesting a company and adding a resource. */
export function SubmitTabs({ active }: { active: "company" | "resource" }) {
  const { t } = useTranslation();
  const tabs = [
    { key: "company", href: "/submit?type=company", label: t("nav.suggestCompany"), icon: Building2 },
    { key: "resource", href: "/submit", label: t("nav.submit"), icon: Boxes },
  ] as const;
  return (
    <div className="mb-8 grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/40 p-1">
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
