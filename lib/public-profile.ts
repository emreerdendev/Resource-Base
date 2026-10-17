import "server-only";

import { cache } from "react";
import { fetchPublicProfile } from "@/lib/profile-actions";
import type { PublicProfile } from "@/lib/types";

/** One D1 read per request, shared by the profile layout and page. */
export const getPublicProfile = cache(
  async (username: string) => (await fetchPublicProfile(username)) as PublicProfile | null,
);
