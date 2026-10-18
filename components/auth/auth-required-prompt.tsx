"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth/auth-provider";

/**
 * When the middleware bounces a signed-out user off a protected page it adds
 * ?auth=required. This opens the sign-in modal and cleans the URL so the
 * redirect is explained rather than silent.
 *
 * The effect is driven by the param itself (not a one-shot ref): this
 * component lives in the persistent (site) layout and never remounts, so a ref
 * guard would swallow every bounce after the first. Stripping the param via
 * history.replaceState is what prevents re-firing.
 */
export function AuthRequiredPrompt() {
  const { t } = useTranslation();
  const { openAuth, loading, user } = useAuth();
  const params = useSearchParams();
  const pathname = usePathname();

  const needsAuth = params.get("auth") === "required";

  useEffect(() => {
    // Wait until auth has resolved so we don't prompt a user who's actually
    // signed in (e.g. a stale link).
    if (!needsAuth || loading) return;
    if (!user) {
      toast.info(t("auth.requiredBody"));
      openAuth();
    }
    // Strip the param so refresh/back doesn't re-trigger. history.replaceState
    // updates useSearchParams without asking the server for the page again.
    window.history.replaceState(null, "", pathname);
  }, [needsAuth, loading, user, openAuth, pathname, t]);

  return null;
}
