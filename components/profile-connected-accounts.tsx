"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { GoogleIcon, GithubIcon, GitlabIcon } from "@/components/brand-icons";
import { authClient } from "@/lib/auth-client";
import { loadLinkedAccounts } from "@/lib/linked-accounts";

type Provider = "google" | "github" | "gitlab";

const PROVIDERS: { id: Provider; label: string; Icon: typeof GoogleIcon }[] = [
  { id: "google", label: "Google", Icon: GoogleIcon },
  { id: "github", label: "GitHub", Icon: GithubIcon },
  { id: "gitlab", label: "GitLab", Icon: GitlabIcon },
];

/**
 * Connected accounts section for the profile editor. Lists which OAuth
 * providers are linked to the current user and lets them link/unlink. Linking
 * an OAuth provider is the supported fix for the "account_not_linked" case.
 */
export function ProfileConnectedAccounts() {
  const { t } = useTranslation();
  const [linked, setLinked] = useState<Set<string> | null>(null);
  const [credential, setCredential] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async (fresh = false) => {
    const ids = await loadLinkedAccounts(fresh).catch(() => null);
    if (!ids) return;
    setLinked(new Set(ids));
    setCredential(ids.includes("credential"));
  }, []);

  useEffect(() => {
    // Loads from the auth API (an external system); state is set when it answers.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (linked === null) return null;

  // Total sign-in methods = linked OAuth providers + (credential ? 1 : 0).
  const totalMethods =
    PROVIDERS.filter((p) => linked.has(p.id)).length + (credential ? 1 : 0);

  async function link(provider: Provider) {
    setPending(provider);
    const { error } = await authClient.linkSocial({
      provider,
      callbackURL: "/profile/edit",
      // Plain path only — a query string here throws "Invalid errorCallbackURL".
      // If the provider's email differs from the account email, Better Auth
      // blocks the link and redirects to this path with its own appended
      // ?error=email_doesn't_match, which AuthProvider catches to show
      // linkEmailMismatch.
      errorCallbackURL: "/profile/edit",
    });
    if (error) {
      toast.error(t("auth.linkFailed"));
      setPending(null);
    }
    // success → OAuth redirect happens; on return the list reloads
  }

  async function unlink(provider: Provider) {
    if (totalMethods <= 1) {
      toast.error(t("auth.cannotUnlinkLast"));
      return;
    }
    setPending(provider);
    const { error } = await authClient.unlinkAccount({ providerId: provider });
    setPending(null);
    if (error) {
      toast.error(t("auth.unlinkFailed"));
      return;
    }
    await load(true);
  }

  return (
    <section className="rounded-xl border border-border p-4">
      <h2 className="text-sm font-semibold">{t("auth.connectedAccounts")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("auth.connectedAccountsHint")}
      </p>
      <ul className="mt-3 grid gap-2">
        {PROVIDERS.map(({ id, label, Icon }) => {
          const isLinked = linked.has(id);
          const busy = pending === id;
          return (
            <li
              key={id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <span className="flex items-center gap-2 text-sm">
                <Icon className="size-4" />
                {label}
                {isLinked && (
                  <span className="text-xs text-primary">
                    · {t("auth.linked")}
                  </span>
                )}
              </span>
              <Button
                type="button"
                size="sm"
                variant={isLinked ? "outline" : "default"}
                disabled={busy}
                onClick={() => (isLinked ? unlink(id) : link(id))}
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {isLinked ? t("auth.unlink") : t("auth.link")}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
