"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { AtSign, Eye, EyeOff, Loader2, Mail, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ProfileAvatarField } from "@/components/profile-avatar-field";
import { ProfileLinksField, linkError, type LinkRow } from "@/components/profile-links-field";
import { IconInput } from "@/components/ui/icon-input";
import { FormField } from "@/components/form-field";
import { normalizeSocialLink, socialEntries, type SocialLinks, type SocialPlatformId } from "@/lib/social-links";
import type { Profile } from "@/lib/types";
import { fieldProps, useFormErrors } from "@/lib/use-form-errors";
import { FormSkeleton } from "@/components/skeletons";
import { cn } from "@/lib/utils";
import { useProfile } from "@/lib/profile";

type Fields = {
  username: string;
  full_name: string;
  bio: string;
  links: LinkRow[];
  show_email: boolean;
};

function fieldsFromProfile(p: Profile): Fields {
  return {
    username: p.username ?? "",
    full_name: p.full_name ?? "",
    bio: p.bio ?? "",
    links: socialEntries(p.social_links).map(([platform, url]) => ({ id: platform.id, value: url })),
    show_email: !!p.show_email,
  };
}

/** Links as saved: valid ones by platform, empty rows dropped. */
function linksObject(rows: LinkRow[]): SocialLinks {
  const out: SocialLinks = {};
  for (const r of rows) {
    const v = r.value.trim() && normalizeSocialLink(r.id, r.value);
    if (v) out[r.id] = v;
  }
  return out;
}

const sameLinks = (a: LinkRow[], b: LinkRow[]) => {
  const x = linksObject(a);
  const y = linksObject(b);
  const keys = new Set([...Object.keys(x), ...Object.keys(y)]) as Set<keyof SocialLinks>;
  return [...keys].every((k) => x[k] === y[k]) && a.length === b.length;
};

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
  const errors = {
    username: !fields?.username.trim()
      ? t("validation.required")
      : /^[a-zA-Z0-9_-]{3,20}$/.test(fields.username.trim())
        ? null
        : t("validation.username"),
  };
  const form = useFormErrors(errors);
  // Link rows show their error once left (or after a save attempt).
  const [touchedLinks, setTouchedLinks] = useState<Set<SocialPlatformId>>(new Set());
  const [attempted, setAttempted] = useState(false);
  const linksInvalid = (fields?.links ?? []).some((r) => linkError(r, t));

  if (loading || !profile || !fields || !baseline) {
    return <FormSkeleton fields={6} tall={[3]} />;
  }

  // Dirty when any field differs from the loaded baseline; valid when the
  // (required) username clears the same constraints the input enforces.
  const dirty =
    fields.username !== baseline.username ||
    fields.full_name !== baseline.full_name ||
    fields.bio !== baseline.bio ||
    fields.show_email !== baseline.show_email ||
    !sameLinks(fields.links, baseline.links);
  const canSave = dirty && !pending;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAttempted(true);
    if (!fields || !canSave || !form.check(e.currentTarget) || linksInvalid) return;
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
        social_links: linksObject(fields.links),
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
      <ProfileAvatarField />

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
      <ProfileLinksField
        rows={fields.links}
        onChange={(links) => setField("links", links)}
        showErrors={(pid) => attempted || touchedLinks.has(pid)}
        onTouch={(pid) => setTouchedLinks((s) => new Set(s).add(pid))}
      />

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
