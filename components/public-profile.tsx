"use client";

import { useAuth } from "@/components/auth/auth-provider";
import {
  DribbbleIcon,
  GithubIcon,
  InstagramIcon,
  LinkedinIcon,
  XIcon,
} from "@/components/brand-icons";
import { useCompanyTracker } from "@/components/company-tracker-provider";
import { ResourceGrid } from "@/components/resource-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { contributorTier } from "@/lib/contributor-tier";
import { initial } from "@/lib/initial";
import { fetchPublicEmail } from "@/lib/profile";
import { useSubmissions } from "@/lib/submissions";
import type { PublicProfile, Resource } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Award,
  Building2,
  BriefcaseBusiness,
  Eye,
  EyeOff,
  Globe,
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
  companiesAdded,
}: {
  profile: PublicProfile;
  resources: Resource[];
  /** Approved company suggestions — contributions without a resource card. */
  companiesAdded: number;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isOwner = user?.id === profile.id;
  const name = profile.full_name || `@${profile.username}`;
  // Gamification: tier badge based on accepted contributions of any kind.
  const contributions = resources.length + companiesAdded;
  const tier = contributorTier(contributions);

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
              initial(profile.full_name || profile.username)
            )}
          </span>
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
                {t(tier.labelKey)} · {t("contributor.count", { count: contributions })}
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
          {profile.linkedin_url && (
            <SocialLink href={profile.linkedin_url} label="LinkedIn">
              <LinkedinIcon />
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

      {/* Owner shortcuts to their private activity. */}
      {isOwner && <OwnerActivity />}

      {/* Contributions */}
      <div className="mt-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("profile.contributions", { count: contributions })}
        </h2>
        {companiesAdded > 0 && (
          <p className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Building2 className="size-4" />
            {t("profile.companiesAdded", { count: companiesAdded })}
          </p>
        )}
        {contributions === 0 ? (
          <p className="py-10 text-center text-muted-foreground">
            {t("profile.noContributions")}
          </p>
        ) : (
          resources.length > 0 && <ResourceGrid resources={resources} />
        )}
      </div>

    </div>
  );
}

/** Links to the owner's applications and submissions, with live counts. */
function OwnerActivity() {
  const { t } = useTranslation();
  const { items: tracked } = useCompanyTracker();
  const { items: submitted } = useSubmissions();
  const cards = [
    { href: "/applications", icon: BriefcaseBusiness, label: t("nav.applications"), count: tracked.length },
    { href: "/submissions", icon: Send, label: t("nav.submissions"), count: submitted.length },
  ];
  return (
    <div className="mt-10 grid gap-3 sm:grid-cols-2">
      {cards.map(({ href, icon: Icon, label, count }) => (
        <Link
          key={href}
          href={href}
          className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
        >
          <Icon className="size-5 text-primary" />
          <span className="flex-1 font-medium">{label}</span>
          <span className="text-lg font-semibold tabular-nums">{count}</span>
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      ))}
    </div>
  );
}
