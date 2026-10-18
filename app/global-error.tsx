"use client";

import { useEffect } from "react";
import { isStaleBuildError, reloadForNewBuild } from "@/lib/stale-build";

/**
 * Last resort when the root layout itself fails. It replaces the whole
 * document, so it's plain HTML in English with inline styles (no providers).
 */
export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  // A tab left open across a deploy: reload onto the new build.
  useEffect(() => {
    if (isStaleBuildError(error)) reloadForNewBuild();
  }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 16 }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#666", marginBottom: 24 }}>Please try again in a moment.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ccc", cursor: "pointer" }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
