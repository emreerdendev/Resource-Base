"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * Segmented switch between the two directories (companies ↔ resources). Shown
 * in both heroes so either side is always one click away, on every screen size.
 */
export function SectionSwitch({ className }: { className?: string }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const items = [
    {
      href: "/companies",
      label: t("nav.companies"),
      icon: Building2,
      active: pathname.startsWith("/compan"),
    },
    {
      href: "/resources",
      label: t("nav.resources"),
      icon: Boxes,
      active: pathname.startsWith("/resources"),
    },
  ];

  return (
    <nav
      aria-label={t("sections.label")}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-card/60 p-1 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      {items.map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
            active
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
