"use client";

import { useEffect, useId, useRef } from "react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";

// Public site key. When unset (local dev or before keys are provisioned) the
// widget renders nothing and reports no token — callers treat captcha as
// "disabled" so the auth flow still works. The server only enforces captcha
// when TURNSTILE_SECRET_KEY is set, so the two stay in sync.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Cloudflare's official always-pass test site key. The real widget only allows
 * the production hostnames, so on localhost it fails with "Unable to connect
 * to website"; there we swap in the test key (paired with the test secret in
 * lib/auth.ts). Production is unaffected.
 */
const LOCAL_TEST_SITE_KEY = "1x00000000000000000000AA";
const isLocalHost = () =>
  typeof window !== "undefined" &&
  /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

/** True when Turnstile is configured (a site key exists). */
export const turnstileEnabled = Boolean(SITE_KEY);

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_ID = "cf-turnstile-script";

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      language?: string;
      action?: string;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Load the Turnstile script once; resolve when window.turnstile is ready. */
function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (window.turnstile) return resolve();
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("turnstile")));
      return;
    }
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => reject(new Error("turnstile")));
    document.head.appendChild(s);
  });
}

/**
 * Cloudflare Turnstile widget. Calls `onToken(token)` when the challenge is
 * solved, `onToken("")` when it expires or errors (so callers disable submit).
 * `action` namespaces the token (e.g. "signup") so a token minted for one form
 * can't be replayed against another. Resets itself whenever `resetKey` changes
 * — bump it after a failed submit to force a fresh challenge.
 */
export function Turnstile({
  onToken,
  action,
  resetKey,
}: {
  onToken: (token: string) => void;
  action?: string;
  resetKey?: number;
}) {
  const { resolvedTheme } = useTheme();
  const { i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  // Keep the latest onToken in a ref so the render effect can stay mount-only
  // (it must not re-run when the parent passes a new callback identity).
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);
  const reactId = useId();

  // Render the widget once on mount (when configured).
  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: isLocalHost() ? LOCAL_TEST_SITE_KEY : SITE_KEY,
          action,
          theme: resolvedTheme === "dark" ? "dark" : "light",
          language: i18n.resolvedLanguage ?? i18n.language ?? "auto",
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(""),
          "error-callback": () => onTokenRef.current(""),
        });
      })
      .catch(() => onTokenRef.current(""));
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* already gone */
        }
        widgetIdRef.current = null;
      }
    };
    // Re-render if theme/language change so the widget matches the UI.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme, i18n.resolvedLanguage, reactId]);

  // Reset the challenge when the caller bumps resetKey (e.g. after a failed
  // submit) — a Turnstile token is single-use.
  useEffect(() => {
    if (!SITE_KEY || resetKey === undefined) return;
    if (widgetIdRef.current && window.turnstile) {
      onTokenRef.current("");
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetKey]);

  if (!SITE_KEY) return null;
  return <div ref={containerRef} className="flex justify-center" />;
}
