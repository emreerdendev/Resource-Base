"use client";

/**
 * A readable "signed in" hint cookie, so signed-out visitors never request
 * /api/auth/get-session (one Worker request per page load saved). The real
 * session cookie is httpOnly; middleware keeps this hint in step with it on
 * every request, and the client sets/clears it on sign-in/out within a page.
 * It only decides whether to ask the server — the server stays the authority.
 */
export const AUTH_HINT_COOKIE = "rb_auth";
const MAX_AGE = 60 * 60 * 24 * 30;

// "secure" cookies are ignored on http://localhost.
const secure = () => (location.protocol === "https:" ? "; secure" : "");

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function subscribeAuthHint(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function hasAuthHint(): boolean {
  return document.cookie.split("; ").some((c) => c === `${AUTH_HINT_COOKIE}=1`);
}

export function setAuthHint() {
  document.cookie = `${AUTH_HINT_COOKIE}=1; path=/; max-age=${MAX_AGE}; samesite=lax${secure()}`;
  emit();
}

export function clearAuthHint() {
  document.cookie = `${AUTH_HINT_COOKIE}=; path=/; max-age=0; samesite=lax${secure()}`;
  emit();
}
