"use client";

import { Button } from "@/components/ui/button";
import { NavLink as Link } from "@/components/nav-link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const KEY = "analytics-consent"; // "granted" | "denied"

// Push a gtag command onto the dataLayer. The Consent Mode v2 default
// (analytics_storage: denied) and gtag.js itself are set up by an inline <head>
// script in the root layout, so this only sends `update`s after the user's
// choice. Safe even before gtag.js loads — commands buffer in dataLayer.
function gtag(...args: unknown[]) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push(args);
}

function readStoredConsent(): "granted" | "denied" | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(KEY);
  return stored === "granted" || stored === "denied" ? stored : null;
}

/**
 * Cookie/analytics consent banner — Google Consent Mode v2.
 *
 * GA loads on every page (root layout) but starts with analytics_storage
 * DENIED: before the user chooses, nothing is stored in cookies and only
 * cookieless, anonymous pings are sent (Google models aggregate traffic from
 * these). Accepting flips consent to granted for full measurement; declining
 * keeps it denied. Google's recommended GDPR/KVKK-aligned setup — more signal
 * than blocking GA entirely, with no personal data collected until consent.
 * Choice persists in localStorage. Banner shows until a choice is made.
 *
 * `gaId` only gates the banner: if GA isn't configured there is nothing to
 * consent to, so no banner is shown.
 */
export function ConsentGate({ gaId }: { gaId?: string }) {
  const { t } = useTranslation();
  // Read the persisted choice synchronously on first render (client only).
  // null = not yet read / undecided.
  const [consent, setConsent] = useState<"granted" | "denied" | null>(
    readStoredConsent,
  );
  // Gates the banner so it never flashes during SSR / before hydration.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Replay a previously granted choice to Consent Mode once mounted.
    if (readStoredConsent() === "granted") {
      gtag("consent", "update", { analytics_storage: "granted" });
    }
    // Mounted flag: keeps the banner from flashing before hydration. The
    // setState here is the standard mounted-guard pattern, run once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, []);

  const choose = (value: "granted" | "denied") => {
    localStorage.setItem(KEY, value);
    setConsent(value);
    gtag("consent", "update", {
      analytics_storage: value === "granted" ? "granted" : "denied",
    });
  };

  if (!gaId) return null;

  // Banner: only once the stored choice is read AND none was made.
  if (!ready || consent !== null) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 rounded-xl border border-border bg-background/95 p-4 shadow-lg ring-1 ring-black/5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t("consent.message")}{" "}
          <Link
            href="/privacy"
            className="text-primary underline-offset-2 hover:underline"
          >
            {t("footer.privacy")}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => choose("denied")}>
            {t("consent.decline")}
          </Button>
          <Button size="sm" onClick={() => choose("granted")}>
            {t("consent.accept")}
          </Button>
        </div>
      </div>
    </div>
  );
}
