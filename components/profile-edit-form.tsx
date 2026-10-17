"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AtSign, Eye, EyeOff, Globe, Loader2, Mail, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LinkedinIcon } from "@/components/brand-icons";
import { IconInput } from "@/components/ui/icon-input";
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

export function ProfileEditForm() {
  const { t } = useTranslation();
  const { profile, loading, update, setUsername } = useProfile();
  const [pending, setPending] = useState(false);
  // Snapshot of the profile as last loaded — the baseline we diff against to
  // know whether anything actually changed.
  const [baseline, setBaseline] = useState<Fields | null>(null);
  const [fields, setFields] = useState<Fields | null>(null);

  useEffect(() => {
    if (profile) {
      const next = fieldsFromProfile(profile);
      setBaseline(next);
      setFields(next);
    }
  }, [profile]);

  const setField = <K extends keyof Fields>(key: K, value: Fields[K]) =>
    setFields((f) => (f ? { ...f, [key]: value } : f));

  if (loading || !profile || !fields || !baseline) {
    return <FormSkeleton fields={9} tall={[3]} />;
  }

  // Dirty when any field differs from the loaded baseline; valid when the
  // (required) username clears the same constraints the input enforces.
  const usernameValid = /^[a-zA-Z0-9_-]{3,20}$/.test(fields.username.trim());
  const dirty = (Object.keys(fields) as (keyof Fields)[]).some(
    (k) => fields[k] !== baseline[k],
  );
  const canSave = dirty && usernameValid && !pending;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!fields || !canSave) return;
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
    <form onSubmit={onSubmit} className="space-y-4">

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

      <Field label={t("profile.username")}>
        <IconInput
          icon={AtSign}
          value={fields.username}
          onChange={(e) => setField("username", e.target.value)}
          required
          minLength={3}
          maxLength={20}
          pattern="[a-zA-Z0-9_\-]{3,20}"
          placeholder={t("auth.usernamePlaceholder")}
        />
      </Field>
      <Field label={t("profile.fullName")}>
        <IconInput icon={User} maxLength={60} value={fields.full_name} onChange={(e) => setField("full_name", e.target.value)} />
      </Field>
      <Field label={t("profile.bio")}>
        <Textarea rows={3} value={fields.bio} onChange={(e) => setField("bio", e.target.value)} maxLength={280} />
      </Field>
      <Field label={t("profile.portfolio")}>
        <IconInput icon={Globe} type="url" maxLength={200} value={fields.portfolio_url} onChange={(e) => setField("portfolio_url", e.target.value)} placeholder="https://…" />
      </Field>
      <Field label="LinkedIn">
        <IconInput icon={LinkedinIcon} type="url" maxLength={200} value={fields.linkedin_url} onChange={(e) => setField("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/…" />
      </Field>
      <Field label="GitHub">
        <IconInput icon={Globe} type="url" maxLength={200} value={fields.github_url} onChange={(e) => setField("github_url", e.target.value)} placeholder="https://github.com/…" />
      </Field>
      <Field label="X (Twitter)">
        <IconInput icon={Globe} type="url" maxLength={200} value={fields.twitter_url} onChange={(e) => setField("twitter_url", e.target.value)} placeholder="https://x.com/…" />
      </Field>
      <Field label="Instagram">
        <IconInput icon={Globe} type="url" maxLength={200} value={fields.instagram_url} onChange={(e) => setField("instagram_url", e.target.value)} placeholder="https://instagram.com/…" />
      </Field>
      <Field label="Dribbble">
        <IconInput icon={Globe} type="url" maxLength={200} value={fields.dribbble_url} onChange={(e) => setField("dribbble_url", e.target.value)} placeholder="https://dribbble.com/…" />
      </Field>

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
