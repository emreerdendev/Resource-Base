"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { ProviderBadge } from "@/components/auth/provider-badge";
import {
  DribbbleIcon,
  GithubIcon,
  InstagramIcon,
  XIcon,
} from "@/components/brand-icons";
import { ApplicationsTracker } from "@/components/applications-tracker";
import { MySubmissions } from "@/components/my-submissions";
import { ResourceGrid } from "@/components/resource-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { contributorTier } from "@/lib/contributor-tier";
import { initial } from "@/lib/initial";
import { fetchPublicEmail } from "@/lib/profile";
import type { Category, Company, PublicProfile, Resource } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Award,
  BriefcaseBusiness,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Mail,
  Pencil,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="grid size-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
    >
      {children}
    </a>
  );
}

export function PublicProfileView({
  profile,
  resources,
  categories,
  companies,
}: {
  profile: PublicProfile;
  resources: Resource[];
  categories: Category[];
  companies: Company[];
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isOwner = user?.id === profile.id;
  const name = profile.full_name || `@${profile.username}`;
  // Gamification: tier badge based on accepted contributions.
  const tier = contributorTier(resources.length);

  // Email display: the owner always sees their own (from the session) with an
  // eye/eye-off marking whether it's public; other visitors see it only if the
  // owner opted in (fetched via the public_email RPC, never the raw column).
  const [publicEmail, setPublicEmail] = useState<string | null>(null);
  useEffect(() => {
    if (!isOwner && profile.show_email) {
      fetchPublicEmail(profile.id).then(setPublicEmail);
    }
  }, [isOwner, profile.show_email, profile.id]);
  const email = isOwner ? (user?.email ?? null) : publicEmail;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="relative grid size-20 place-items-center rounded-full text-2xl font-semibold text-foreground">
          <span className="grid size-full place-items-center overflow-hidden rounded-full border border-border bg-muted">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={profile.username} className="size-full object-cover" />
            ) : (
              initial(name)
            )}
          </span>
          {/* Provider badge is private — only the profile owner sees their own
              sign-in method, never visitors. */}
          {/* Provider badge: Better Auth keeps the sign-in provider in the
              account table, not on the session user. Omitted for now. */}
          {isOwner && (
            <ProviderBadge
              provider={undefined}
              className="size-6 ring-[3px]"
              iconClassName="size-3.5"
            />
          )}
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
          <p className="text-muted-foreground">@{profile.username}</p>
          {email && (
            <p className="mt-1 inline-flex items-start gap-1.5 text-sm text-muted-foreground">
              {!isOwner && <Mail className="mt-0.5 size-3.5" />}
              <span className="relative">
                {email}
                {/* Owner-only visibility marker, pinned to the top-right. */}
                {isOwner && (
                  <span
                    className="absolute -top-1 right-[-18px] text-muted-foreground"
                    title={
                      profile.show_email
                        ? t("profile.emailPublic")
                        : t("profile.emailHidden")
                    }
                  >
                    {profile.show_email ? (
                      <Eye className="size-4" />
                    ) : (
                      <EyeOff className="size-4" />
                    )}
                  </span>
                )}
              </span>
            </p>
          )}
          {tier && (
            <div className="mt-2 flex items-center justify-center">
              <Badge variant="outline" className={cn("gap-1", tier.className)}>
                <Award className="size-3" />
                {t(tier.labelKey)} · {t("contributor.count", { count: resources.length })}
              </Badge>
            </div>
          )}
        </div>
        {isOwner && (
          <Button asChild size="sm" variant="outline">
            <Link href="/profile/edit">
              <Pencil className="size-3.5" /> {t("profile.editTitle")}
            </Link>
          </Button>
        )}
        {profile.bio && (
          <p className="max-w-md text-balance text-sm text-muted-foreground">
            {profile.bio}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {profile.portfolio_url && (
            <SocialLink href={profile.portfolio_url} label="Portfolio">
              <Globe className="size-4" />
            </SocialLink>
          )}
          {profile.github_url && (
            <SocialLink href={profile.github_url} label="GitHub">
              <GithubIcon />
            </SocialLink>
          )}
          {profile.twitter_url && (
            <SocialLink href={profile.twitter_url} label="X">
              <XIcon />
            </SocialLink>
          )}
          {profile.instagram_url && (
            <SocialLink href={profile.instagram_url} label="Instagram">
              <InstagramIcon />
            </SocialLink>
          )}
          {profile.dribbble_url && (
            <SocialLink href={profile.dribbble_url} label="Dribbble">
              <DribbbleIcon />
            </SocialLink>
          )}
        </div>
      </div>

      {/* Application tracker — owner only (statuses and notes are private). */}
      {isOwner && (
        <div className="mt-12">
          <div className="mb-4 flex items-center gap-2">
            <BriefcaseBusiness className="size-5 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("tracker.title")}
            </h2>
            <span
              className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground"
              title={t("tracker.privateHint")}
            >
              <Lock className="size-3" /> {t("tracker.private")}
            </span>
          </div>
          <ApplicationsTracker companies={companies} compact />
        </div>
      )}

      {/* Contributions */}
      <div className="mt-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("profile.contributions", { count: resources.length })}
        </h2>
        {resources.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">
            {t("profile.noContributions")}
          </p>
        ) : (
          <ResourceGrid resources={resources} />
        )}
      </div>

      {/* My submissions — owner only, so users can track pending/rejected
          items and resubmit, right where they look for their own activity. */}
      {isOwner && (
        <div className="mt-12">
          <div className="mb-4 flex items-center gap-2">
            <Send className="size-5 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("submissions.title")}
            </h2>
          </div>
          <MySubmissions categories={categories} />
        </div>
      )}
    </div>
  );
}
