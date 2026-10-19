"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { authClient, useSession } from "@/lib/auth-client";
import { clearAuthHint, hasAuthHint, subscribeAuthHint } from "@/lib/auth-hint";
import { AuthDialog, isSafePath } from "@/components/auth/auth-dialog";
import { isProtectedPage } from "@/lib/protected-routes";

export type AuthUser = NonNullable<
  ReturnType<typeof useSession>["data"]
>["user"];
export type AuthSession = ReturnType<typeof useSession>["data"];

type AuthContextValue = {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  /** Open the sign-in dialog; pass a path to navigate there after success. */
  openAuth: (redirectTo?: string) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Set right before an interactive sign-in (email submit or OAuth redirect) so
// the provider can tell a real login from a passive session restore (page
// reload / tab refocus). Without this, the user-id transition fires on every
// reload and spams "welcome back". sessionStorage so it survives the OAuth
// full-page redirect.
const SIGNIN_INTENT_KEY = "auth:signin-intent";
export function markSignInIntent() {
  try {
    sessionStorage.setItem(SIGNIN_INTENT_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

type SessionState = { session: AuthSession | null; isPending: boolean };

/**
 * Mounts Better Auth's session hook (which fetches /api/auth/get-session) and
 * reports it upward. Only rendered when the "signed in" hint cookie is set, so
 * signed-out visitors make no session request at all.
 */
function SessionBridge({ onChange }: { onChange: (s: SessionState) => void }) {
  const { data, isPending, error, refetch } = useSession();
  // A failed read (429, network, redeploy) isn't "signed out": Better Auth
  // would report no session and never ask again. Retry a couple of times and
  // stay pending meanwhile; only a 401 or a real empty session signs out.
  const [retries, setRetries] = useState(0);
  const failed = !!error && error.status !== 401;
  const retrying = failed && retries < 2;
  useEffect(() => {
    if (!retrying) return;
    const timer = setTimeout(() => {
      setRetries((n) => n + 1);
      void refetch();
    }, 1000 * (retries + 1));
    return () => clearTimeout(timer);
  }, [retrying, retries, refetch]);
  useEffect(() => {
    onChange({ session: data ?? null, isPending: isPending || retrying });
  }, [data, isPending, retrying, onChange]);
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  // false on the server and during hydration, then the real cookie.
  const hinted = useSyncExternalStore(subscribeAuthHint, hasAuthHint, () => false);
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [bridged, setBridged] = useState<SessionState>({ session: null, isPending: true });
  const session = hinted ? bridged.session : null;
  // Pending until hydrated; then only while a hinted session is loading.
  const isPending = !hydrated || (hinted && bridged.isPending);
  const user = session?.user ?? null;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const redirectAfterAuth = useRef<string | null>(null);

  // Catch OAuth/auth redirects landing on the page with a query flag:
  //  - ?error=account_not_linked → open the dialog with a helpful notice
  //  - ?error=email_doesn't_match → linking an OAuth provider whose email differs
  //    from the account email (Better Auth blocks it for security); explain why
  //  - ?auth=required | ?auth=signin → open the dialog (e.g. bounced from a
  //    protected page, or returning from a password reset)
  // Read from window.location (in an effect, client-only) rather than
  // useSearchParams() so static pages don't need a Suspense bailout.
  //
  // Wait for the session to settle (isPending) before acting: a signed-in user
  // must NOT be shown the sign-in dialog just because a stale ?auth=signin is in
  // the URL. We always strip the flag via history.replaceState (router.replace
  // didn't reliably clear the search string on OpenNext, so the flag stuck and
  // the dialog kept reopening on every navigation back to that URL).
  const flagHandled = useRef(false);
  useEffect(() => {
    if (isPending) return;
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const auth = params.get("auth");
    // Bounced from a protected page: ?next= is where they were going.
    const next = params.get("next");
    const hasFlag = error || auth === "required" || auth === "signin";
    if (!hasFlag) {
      flagHandled.current = false;
      return;
    }
    if (flagHandled.current) return;
    flagHandled.current = true;

    // Strip the flag from the URL immediately so it can't linger and retrigger.
    window.history.replaceState(null, "", window.location.pathname);

    if (error === "email_doesn't_match") {
      toast.error(t("auth.linkEmailMismatch"));
      return;
    }
    // Don't prompt sign-in if the user is already authenticated. A signed-in
    // user can only land here with an error from a failed linkSocial attempt —
    // surface it rather than swallowing it silently.
    if (user) {
      if (error)
        toast.error(
          t(
            error === "account_already_linked_to_different_user"
              ? "auth.linkTaken"
              : error === "unable_to_link_account"
                ? "auth.linkUnverified"
                : "auth.linkFailed",
          ),
        );
      return;
    }
    if (error === "account_not_linked") {
      // Responds to the URL the page was opened with (an external event).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotice(t("auth.accountNotLinked"));
      setDialogOpen(true);
    } else if (auth === "required" || auth === "signin") {
      redirectAfterAuth.current = next && isSafePath(next) ? next : null;
      setDialogOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isPending, user]);

  // Reproduce the old onAuthStateChange side effects by watching the user id
  // transition (null -> id = signed in, id -> null = signed out).
  const prevUserId = useRef<string | null>(user?.id ?? null);
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const currentId = user?.id ?? null;
    const previousId = prevUserId.current;
    if (currentId === previousId) return;
    prevUserId.current = currentId;

    if (currentId && !previousId) {
      setDialogOpen(false);
      // Only greet on an INTERACTIVE sign-in, never on a passive session
      // restore (reload / tab refocus). markSignInIntent() sets this flag right
      // before the email submit or OAuth redirect; if it's absent this
      // null→id transition is just the session loading, so stay silent.
      let intentional = false;
      try {
        intentional = sessionStorage.getItem(SIGNIN_INTENT_KEY) === "1";
        if (intentional) sessionStorage.removeItem(SIGNIN_INTENT_KEY);
      } catch {
        /* ignore */
      }
      if (intentional) {
        // New vs returning: account created ≤60s ago = brand-new signup.
        const createdAt = session?.user?.createdAt
          ? new Date(session.user.createdAt).getTime()
          : 0;
        const isNew = createdAt > 0 && Date.now() - createdAt <= 60_000;
        toast.success(t(isNew ? "auth.welcomeNew" : "auth.welcomeBack"));
      }

      if (redirectAfterAuth.current) {
        const to = redirectAfterAuth.current;
        redirectAfterAuth.current = null;
        router.push(to);
      }
    }
    if (!currentId && previousId && isProtectedPage(pathnameRef.current)) {
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, router]);

  const openAuth = useCallback((redirectTo?: string) => {
    redirectAfterAuth.current = redirectTo ?? null;
    setNotice(null);
    setDialogOpen(true);
  }, []);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    clearAuthHint();
    setBridged({ session: null, isPending: true });
    router.refresh();
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      session: session ?? null,
      loading: isPending,
      openAuth,
      signOut,
    }),
    [user, session, isPending, openAuth, signOut],
  );

  return (
    <AuthContext.Provider value={value}>
      {hinted && <SessionBridge onChange={setBridged} />}
      {children}
      <AuthDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setNotice(null);
        }}
        getRedirect={() => redirectAfterAuth.current}
        notice={notice}
      />
    </AuthContext.Provider>
  );
}
