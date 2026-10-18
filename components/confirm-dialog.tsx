"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel: string;
  /** Red confirm button, for actions that delete something. */
  destructive?: boolean;
};

/**
 * The site's replacement for window.confirm: `await confirm({...})` opens a
 * modal and resolves true on confirm, false on cancel or dismiss. Render the
 * returned `dialog` once in the component.
 */
export function useConfirm() {
  const { t } = useTranslation();
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false);
    setOptions(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpen(false);
  };

  // React events bubble out of the portal to wherever the dialog is rendered:
  // stop them so a click here doesn't also hit a clickable card behind it.
  const dialog = (
    <span className="contents" onClick={(e) => e.stopPropagation()}>
    <Dialog open={open} onOpenChange={(next) => !next && close(false)}>
      <DialogContent className="p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{options?.title}</DialogTitle>
          {options?.description && <DialogDescription>{options.description}</DialogDescription>}
        </DialogHeader>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => close(false)}>
            {t("submissions.cancel")}
          </Button>
          <Button
            type="button"
            variant={options?.destructive ? "destructive" : "default"}
            className="flex-1"
            onClick={() => close(true)}
          >
            {options?.confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </span>
  );

  return { confirm, dialog };
}
