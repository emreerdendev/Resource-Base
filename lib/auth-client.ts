"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { getAuth } from "@/lib/auth";

/**
 * Browser auth client. Same-origin.
 * inferAdditionalFields keeps the folded-in profile fields typed on the session.
 */
export const authClient = createAuthClient({
  // No refetch on every tab focus: each one was a Worker request. The session
  // still loads on page load and updates on sign-in/out.
  sessionOptions: { refetchOnWindowFocus: false },
  plugins: [inferAdditionalFields<Awaited<ReturnType<typeof getAuth>>>()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
