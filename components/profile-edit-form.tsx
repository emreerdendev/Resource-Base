"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { AtSign, Eye, EyeOff, Globe, Loader2, Mail, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LinkedinIcon } from "@/components/brand-icons";
import { IconInput } from "@/components/ui/icon-input";
import { FormField } from "@/components/form-field";
import { normalizeWebUrl } from "@/lib/company-input";
import { fieldProps, useFormErrors } from "@/lib/use-form-errors";
import { FormSkeleton } from "@/components/skeletons";
import { cn } from "@/lib/utils";
import { useProfile } from "@/lib/profile";

type Fields = {
  username: string;
  full_name: string;
  bio: string;
  portfolio_url: string;
  github_url: string;
  twitter_url: string;
  instagram_url: string;
  dribbble_url: string;
  linkedin_url: string;
  show_email: boolean;
};

function fieldsFromProfile(p: {
  username?: string | null;
  full_name?: string | null;
  bio?: string | null;
  portfolio_url?: string | null;
  github_url?: string | null;
  twitter_url?: string | null;
  instagram_url?: string | null;
  dribbble_url?: string | null;
  linkedin_url?: string | null;
  show_email?: boolean | null;
}): Fields {
  return {
    username: p.username ?? "",
    full_name: p.full_name ?? "",
    bio: p.bio ?? "",
    portfolio_url: p.portfolio_url ?? "",
    github_url: p.github_url ?? "",
    twitter_url: p.twitter_url ?? "",
    instagram_url: p.instagram_url ?? "",
    dribbble_url: p.dribbble_url ?? "",
    linkedin_url: p.linkedin_url ?? "",
    show_email: !!p.show_email,
  };
}

type UrlKey = "portfolio_url" | "linkedin_url" | "github_url" | "twitter_url" | "instagram_url" | "dribbble_url";

/** [field, label (or "portfolio" → translated), icon, placeholder] */
const URL_FIELDS: [UrlKey, string, React.ComponentType<{ className?: string }>, string][] = [
  ["portfolio_url", "portfolio", Globe, "https://…"],
  ["linkedin_url", "LinkedIn", LinkedinIcon, "https://linkedin.com/in/…"],
  ["github_url", "GitHub", Globe, "https://github.com/…"],
  ["twitter_url", "X (Twitter)", Globe, "https://x.com/…"],
  ["instagram_url", "Instagram", Globe, "https://instagram.com/…"],
  ["dribbble_url", "Dribbble", Globe, "https://dribbble.com/…"],
];

export function ProfileEditForm() {
  const { t } = useTranslation();
  const id = useId();
  const { profile, loading, update, setUsername } = useProfile();
  const [pending, setPending] = useState(false);
  // Snapshot of the profile as last loaded — the baseline we diff against to
  // know whether anything actually changed.
  const [baseline, setBaseline] = useState<Fields | null>(null);
  const [fields, setFields] = useState<Fields | null>(null);

  // Re-seed the form whenever a (re)loaded profile arrives — adjusted during
  // render rather than in an effect, so there's no extra pass.
  const [seededFrom, setSeededFrom] = useState<typeof profile>(null);
  if (profile && profile !== seededFrom) {
    setSeededFrom(profile);
    const next = fieldsFromProfile(profile);
    setBaseline(next);
    setFields(next);
  }

  const setField = <K extends keyof Fields>(key: K, value: Fields[K]) =>
    setFields((f) => (f ? { ...f, [key]: value } : f));

  // Same rules lib/profile-actions.ts enforces.
  const urlErr = (v = "") => (v.trim() && !normalizeWebUrl(v) ? t("validation.url") : null);
  const errors = {
    username: !fields?.username.trim()
      ? t("validation.required")
      : /^[a-zA-Z0-9_-]{3,20}$/.test(fields.username.trim())
        ? null
        : t("validation.username"),
    ...Object.fromEntries(URL_FIELDS.map(([k]) => [k, urlErr(fields?.[k])])),
  } as Record<"username" | UrlKey, string | null>;
  const form = useFormErrors(errors);

  if (loading || !profile || !fields || !baseline) {
    return <FormSkeleton fields={9} tall={[3]} />;
  }

  // Dirty when any field differs from the loaded baseline; valid when the
  // (required) username clears the same constraints the input enforces.
  const dirty = (Object.keys(fields) as (keyof Fields)[]).some(
    (k) => fields[k] !== baseline[k],
  );
  const canSave = dirty && !pending;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!fields || !canSave || !form.check(e.currentTarget)) return;
    setPending(true);
    try {
      // Username goes through the validated RPC if it changed.
      const nextUsername = fields.username.trim().toLowerCase();
      if (nextUsername && nextUsername !== profile!.username) {
        const { error } = await setUsername(nextUsername);
        if (error) {
          toast.error(
            error === "username_taken"
              ? t("profile.usernameTaken")
              : error === "invalid_username"
                ? t("auth.usernameInvalid")
                : error === "rate_limited"
                  ? t("profile.usernameRateLimited")
                  : error,
          );
          setPending(false);
          return;
        }
      }
      const { error } = await update({
        full_name: fields.full_name || null,
        bio: fields.bio || null,
        portfolio_url: fields.portfolio_url || null,
        github_url: fields.github_url || null,
        twitter_url: fields.twitter_url || null,
        instagram_url: fields.instagram_url || null,
        dribbble_url: fields.dribbble_url || null,
        linkedin_url: fields.linkedin_url || null,
        show_email: fields.show_email,
      });
      if (error)
        throw new Error(
          error === "invalid_url"
            ? t("profile.invalidUrl")
            : error === "too_long"
              ? t("profile.tooLong")
              : error === "rate_limited"
                ? t("card.favoriteRateLimited")
                : t("profile.saveError"),
        );
      toast.success(t("profile.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("profile.saveError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">

      {/* Email is read-only (managed by auth) with a public-visibility toggle. */}
      <Field label={t("profile.email")}>
        <div className="flex items-center gap-2">
          <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground">
            <Mail className="size-4 shrink-0" />
            <span className="truncate">{profile.email}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setField("show_email", !fields.show_email)}
            className={cn(
              "h-9 w-28 shrink-0 justify-center",
              fields.show_email && "border-primary text-primary",
            )}
            aria-pressed={fields.show_email}
          >
            {fields.show_email ? (
              <Eye className="size-4" />
            ) : (
              <EyeOff className="size-4" />
            )}
            {fields.show_email ? t("profile.emailPublic") : t("profile.emailHidden")}
          </Button>
        </div>
      </Field>

      <FormField id={`${id}-username`} label={t("profile.username")} required error={form.show("username")}>
        <IconInput
          {...fieldProps(`${id}-username`, form.show("username"))}
          icon={AtSign}
          value={fields.username}
          onChange={(e) => setField("username", e.target.value)}
          onBlur={() => form.touch("username")}
          maxLength={20}
          autoCapitalize="none"
          placeholder={t("auth.usernamePlaceholder")}
        />
      </FormField>
      <FormField id={`${id}-name`} label={t("profile.fullName")} counter={`${fields.full_name.length}/60`}>
        <IconInput id={`${id}-name`} icon={User} maxLength={60} value={fields.full_name} onChange={(e) => setField("full_name", e.target.value)} />
      </FormField>
      <FormField id={`${id}-bio`} label={t("profile.bio")} counter={`${fields.bio.length}/280`}>
        <Textarea id={`${id}-bio`} rows={3} value={fields.bio} onChange={(e) => setField("bio", e.target.value)} maxLength={280} />
      </FormField>
      {URL_FIELDS.map(([key, label, icon, placeholder]) => (
        <FormField key={key} id={`${id}-${key}`} label={label === "portfolio" ? t("profile.portfolio") : label} error={form.show(key)}>
          <IconInput
            {...fieldProps(`${id}-${key}`, form.show(key))}
            icon={icon}
            inputMode="url"
            maxLength={200}
            value={fields[key]}
            onChange={(e) => setField(key, e.target.value)}
            onBlur={() => {
              form.touch(key);
              const n = fields[key].trim() && normalizeWebUrl(fields[key]);
              if (n) setField(key, n);
            }}
            placeholder={placeholder}
          />
        </FormField>
      ))}

      <Button type="submit" disabled={!canSave} size="lg" className="w-full">
        {pending && <Loader2 className="size-4 animate-spin" />}
        {t("profile.save")}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
