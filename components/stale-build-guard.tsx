"use client";

import { useEffect } from "react";
import { isStaleBuildError, reloadForNewBuild } from "@/lib/stale-build";

/**
 * Catches stale-build failures that never reach an error boundary (a script
 * loaded on demand from an event handler, a server action) and reloads the
 * tab onto the new build. See lib/stale-build.ts.
 */
export function StaleBuildGuard() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (isStaleBuildError(e.error ?? e.message)) reloadForNewBuild();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isStaleBuildError(e.reason)) reloadForNewBuild();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
