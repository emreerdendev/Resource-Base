"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getMyProfile,
  updateProfile,
  setUsername as setUsernameAction,
} from "@/lib/profile-actions";
import { useAuth } from "@/components/auth/auth-provider";
import type { Profile } from "@/lib/types";
import { loadViewer } from "@/lib/viewer";

export type EditableProfile = Pick<
  Profile,
  | "full_name"
  | "bio"
  | "social_links"
  | "show_email"
>;

type DbProfile = NonNullable<Awaited<ReturnType<typeof getMyProfile>>>;

// Map a camelCase Drizzle user row to the app's snake_case Profile shape.
function toProfile(row: DbProfile, email: string | null): Profile {
  return {
    id: row.id,
    email,
    username: row.username,
    full_name: row.fullName,
    avatar_url: row.image,
    bio: row.bio,
    social_links: row.socialLinks,
    show_email: row.showEmail,
  } as Profile;
}

// Map snake_case editable fields to the camelCase server-action shape.
const KEY_MAP: Record<keyof EditableProfile, string> = {
  full_name: "fullName",
  bio: "bio",
  social_links: "socialLinks",
  show_email: "showEmail",
};

type ProfileValue = {
  profile: Profile | null;
  loading: boolean;
  update: (
    fields: Partial<EditableProfile>,
  ) => Promise<{ error: string | null }>;
  /** `reload: false` when a profile update (which reloads) follows. */
  setUsername: (next: string, opts?: { reload?: boolean }) => Promise<{ error: string | null }>;
  reload: () => Promise<void>;
};

const ProfileContext = createContext<ProfileValue | null>(null);

/**
 * Loads the signed-in user's own profile ONCE and shares it via context. A
 * single source of truth is essential: the profile editor and the header user
 * menu both read it, so editing the username/name must update everywhere
 * instantly. Previously each `useProfile()` call had its own state, so the menu
 * kept showing the old username until a full page reload.
 */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const row = await getMyProfile();
    setProfile(row ? toProfile(row, user.email ?? null) : null);
    setLoading(false);
  }, [user]);

  // Initial load comes from the shared viewer request; reloads use `load`.
  const userId = user?.id;
  const email = user?.email ?? null;
  useEffect(() => {
    let active = true;
    if (!userId) {
      Promise.resolve().then(() => {
        if (!active) return;
        setProfile(null);
        setLoading(false);
      });
    } else {
      loadViewer(userId)
        .then(({ profile: row }) => active && setProfile(row ? toProfile(row, email) : null))
        .catch(() => {})
        .finally(() => active && setLoading(false));
    }
    return () => {
      active = false;
    };
  }, [userId, email]);

  const update = useCallback(
    async (fields: Partial<EditableProfile>) => {
      if (!user) return { error: "not authenticated" };
      const patch: Record<string, unknown> = {};
      for (const k of Object.keys(fields) as (keyof EditableProfile)[]) {
        patch[KEY_MAP[k]] = fields[k];
      }
      const { error } = await updateProfile(patch);
      if (!error) await load();
      return { error };
    },
    [user, load],
  );

  const setUsername = useCallback(
    async (next: string, opts?: { reload?: boolean }): Promise<{ error: string | null }> => {
      const res = await setUsernameAction(next);
      if (!res.error && opts?.reload !== false) await load();
      return res;
    },
    [load],
  );

  const value = useMemo<ProfileValue>(
    () => ({ profile, loading, update, setUsername, reload: load }),
    [profile, loading, update, setUsername, load],
  );

  return createElement(ProfileContext.Provider, { value }, children);
}

/** Read the shared profile state (own only). Must be under ProfileProvider. */
export function useProfile(): ProfileValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within <ProfileProvider>");
  return ctx;
}
