"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { initial } from "@/lib/initial";
import { useProfile } from "@/lib/profile";
import { squareAvatar } from "@/lib/resize-image";

const MAX_INPUT_BYTES = 10 * 1024 * 1024;

/**
 * Profile photo: pick an image, it's cropped and resized here and saved right
 * away (separately from "Save Profile"). Remove falls back to the initial.
 */
export function ProfileAvatarField() {
  const { t } = useTranslation();
  const { profile, reload } = useProfile();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<"upload" | "remove" | null>(null);
  if (!profile) return null;
  const name = profile.full_name || profile.username;

  async function send(method: "POST" | "DELETE", body?: Blob) {
    const res = await fetch("/api/avatar", {
      method,
      body,
      headers: body ? { "Content-Type": body.type } : undefined,
    });
    if (res.status === 429) throw new Error(t("card.favoriteRateLimited"));
    if (res.status === 403) throw new Error(t("verifyBanner.verifyFirst"));
    if (!res.ok) throw new Error(t("profile.photoError"));
    await reload();
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > MAX_INPUT_BYTES) {
      toast.error(t("profile.photoInvalid"));
      return;
    }
    setPending("upload");
    try {
      const blob = await squareAvatar(file).catch(() => {
        throw new Error(t("profile.photoInvalid"));
      });
      await send("POST", blob);
      toast.success(t("profile.photoSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("profile.photoError"));
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    setPending("remove");
    try {
      await send("DELETE");
      toast.success(t("profile.photoRemoved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("profile.photoError"));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={pending !== null}
        aria-label={t("profile.photoUpload")}
        className="group relative grid size-20 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border border-border bg-muted text-2xl font-semibold"
      >
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
        ) : (
          initial(name)
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {pending === "upload" ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
        </span>
      </button>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="lg" disabled={pending !== null} onClick={() => input.current?.click()}>
            {pending === "upload" ? <Loader2 className="animate-spin" /> : <Camera />}
            {t("profile.photoUpload")}
          </Button>
          {profile.avatar_url && (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              disabled={pending !== null}
              onClick={remove}
              className="text-muted-foreground hover:text-destructive"
            >
              {pending === "remove" ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {t("profile.photoRemove")}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("profile.photoHint")}</p>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={onPick} />
    </div>
  );
}
