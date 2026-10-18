"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth/auth-provider";

/**
 * When the middleware bounces a signed-out user off a protected page it adds
 * ?auth=required&next=…. AuthProvider opens the sign-in modal, remembers
 * `next` (to continue there after signing in) and strips the URL; this only
 * adds the explanation, so the redirect isn't silent.
 *
 * It must not touch the URL itself: child effects run before the provider's,
 * so stripping here erased `next` before the provider could read it, and
 * signing in no longer returned to the page.
 */
export function AuthRequiredPrompt() {
  const { t } = useTranslation();
  const { loading, user } = useAuth();
  const params = useSearchParams();

  const needsAuth = params.get("auth") === "required";

  useEffect(() => {
    // Wait until auth has resolved so we don't prompt a user who's actually
    // signed in (e.g. a stale link).
    if (!needsAuth || loading || user) return;
    toast.info(t("auth.requiredBody"), { id: "auth-required" });
  }, [needsAuth, loading, user, t]);

  return null;
}
