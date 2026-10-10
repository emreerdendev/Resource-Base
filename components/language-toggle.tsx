"use client";

import { Check, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const current = i18n.resolvedLanguage ?? i18n.language ?? "en";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t("language.label")}
          title={t("language.label")}
          className="inline-flex h-full cursor-pointer items-center gap-1.5 rounded-l-lg px-2.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Languages className="size-4" />
          <span className="uppercase">{current.slice(0, 2)}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {SUPPORTED_LANGUAGES.map(({ code, label }) => {
          const active = current === code;
          return (
            <DropdownMenuItem
              key={code}
              onClick={() => i18n.changeLanguage(code)}
              className={cn("justify-between", !active && "text-muted-foreground")}
            >
              {label}
              {active && <Check className="size-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
