"use client";

import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SOCIAL_ICONS } from "@/components/social-icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconInput } from "@/components/ui/icon-input";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_URL_MAX,
  insertAtDefault,
  normalizeSocialLink,
  socialPlatform,
  type SocialPlatformId,
} from "@/lib/social-links";

export type LinkRow = { id: SocialPlatformId; value: string };

/** The error for a row, or null when it's valid (or still empty). */
export function linkError(row: LinkRow, t: (k: string) => string) {
  if (!row.value.trim()) return null;
  return normalizeSocialLink(row.id, row.value) ? null : t(row.id === "website" ? "validation.url" : "profile.linkInvalid");
}

/**
 * Profile links: only the platforms the user added are shown, each as one
 * input; "Add Link" lists the rest. A username works as well as a full URL
 * for profile platforms (it's expanded on blur). The rows' order is the order
 * on the public profile: new ones take their default spot, and the arrows
 * move a link up or down.
 */
export function ProfileLinksField({
  rows,
  onChange,
  showErrors,
  onTouch,
}: {
  rows: LinkRow[];
  onChange: (rows: LinkRow[]) => void;
  showErrors: (id: SocialPlatformId) => boolean;
  onTouch: (id: SocialPlatformId) => void;
}) {
  const { t } = useTranslation();
  const added = new Set(rows.map((r) => r.id));
  const available = SOCIAL_PLATFORMS.filter((p) => !added.has(p.id));
  // Focus the input of a platform right after it's added.
  const focusNext = useRef<SocialPlatformId | null>(null);
  const inputs = useRef(new Map<SocialPlatformId, HTMLInputElement>());
  useEffect(() => {
    if (!focusNext.current) return;
    inputs.current.get(focusNext.current)?.focus();
    focusNext.current = null;
  });

  const label = (id: SocialPlatformId) => (id === "website" ? t("profile.website") : socialPlatform(id).label);
  const set = (id: SocialPlatformId, value: string) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, value } : r)));
  const move = (from: number, to: number) => {
    const next = [...rows];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };
  const arrow =
    "grid h-4 w-6 cursor-pointer place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30";

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{t("profile.links")}</p>
      {rows.length === 0 && <p className="text-xs text-muted-foreground">{t("profile.linksEmpty")}</p>}
      {rows.map((row, i) => {
        const p = socialPlatform(row.id);
        const error = showErrors(row.id) ? linkError(row, t) : null;
        const errorId = `link-${row.id}-error`;
        return (
          <div key={row.id}>
            <div className="flex items-center gap-2">
              {rows.length > 1 && (
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => move(i, i - 1)}
                    aria-label={t("profile.linkUp", { platform: label(row.id) })}
                    title={t("profile.linkUp", { platform: label(row.id) })}
                    className={arrow}
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={i === rows.length - 1}
                    onClick={() => move(i, i + 1)}
                    aria-label={t("profile.linkDown", { platform: label(row.id) })}
                    title={t("profile.linkDown", { platform: label(row.id) })}
                    className={arrow}
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <IconInput
                  ref={(el) => {
                    if (el) inputs.current.set(row.id, el);
                    else inputs.current.delete(row.id);
                  }}
                  icon={SOCIAL_ICONS[row.id]}
                  inputMode="url"
                  maxLength={SOCIAL_URL_MAX}
                  value={row.value}
                  aria-label={label(row.id)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : undefined}
                  onChange={(e) => set(row.id, e.target.value)}
                  onBlur={() => {
                    onTouch(row.id);
                    const n = normalizeSocialLink(row.id, row.value);
                    if (n && n !== row.value) set(row.id, n);
                  }}
                  placeholder={p.profile ? t("profile.linkPlaceholder", { url: p.profile.replace("{}", "…") }) : "https://…"}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                aria-label={t("profile.linkRemove", { platform: label(row.id) })}
                title={t("profile.linkRemove", { platform: label(row.id) })}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <X />
              </Button>
            </div>
            {error && (
              <p id={errorId} role="alert" className="mt-1 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
        );
      })}
      {available.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="lg" className="self-start">
              <Plus />
              {t("profile.addLink")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
            {available.map((p) => {
              const Icon = SOCIAL_ICONS[p.id];
              return (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => {
                    focusNext.current = p.id;
                    onChange(insertAtDefault(rows, { id: p.id, value: "" }));
                  }}
                >
                  <Icon className="size-4" />
                  {label(p.id)}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
