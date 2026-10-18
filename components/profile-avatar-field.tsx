"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Trash2, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { initial } from "@/lib/initial";
import { squareAvatar } from "@/lib/resize-image";

const MAX_INPUT_BYTES = 10 * 1024 * 1024;

/** A photo change waiting for "Save Profile". */
export type AvatarChange = { kind: "upload"; blob: Blob; preview: string } | { kind: "remove" } | null;

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/**
 * Profile photo, part of the profile form: picking an image only crops,
 * resizes and previews it here; it's uploaded (or removed) together with the
 * rest of the profile when "Save Profile" is pressed. Undo drops the change.
 */
export function ProfileAvatarField({
  current,
  name,
  value,
  onChange,
  disabled,
}: {
  /** The saved photo, if any. */
  current: string | null;
  /** For the initial shown when there's no photo. */
  name: string;
  value: AvatarChange;
  onChange: (change: AvatarChange) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const shown = value?.kind === "upload" ? value.preview : value?.kind === "remove" ? null : current;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > MAX_INPUT_BYTES) {
      toast.error(t("profile.photoInvalid"));
      return;
    }
    setPreparing(true);
    try {
      const blob = await squareAvatar(file);
      onChange({ kind: "upload", blob, preview: await toDataUrl(blob) });
    } catch {
      toast.error(t("profile.photoInvalid"));
    } finally {
      setPreparing(false);
    }
  }

  const busy = disabled || preparing;
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={t("profile.photoUpload")}
        className="group relative grid size-20 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border border-border bg-muted text-2xl font-semibold"
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
        ) : (
          initial(name)
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {preparing ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
        </span>
      </button>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => input.current?.click()}>
            {preparing ? <Loader2 className="animate-spin" /> : <Camera />}
            {t("profile.photoUpload")}
          </Button>
          {value ? (
            <Button type="button" variant="ghost" size="lg" disabled={busy} onClick={() => onChange(null)}>
              <Undo2 />
              {t("profile.photoUndo")}
            </Button>
          ) : (
            current && (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                disabled={busy}
                onClick={() => onChange({ kind: "remove" })}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 />
                {t("profile.photoRemove")}
              </Button>
            )
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("profile.photoHint")}</p>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={onPick} />
    </div>
  );
}
