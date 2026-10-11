"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/auth/auth-provider";

/**
 * GDPR/KVKK self-service: export a copy of your data, or permanently delete
 * your account. Deletion is irreversible and gated behind a confirmation modal.
 */
export function AccountDangerZone() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Fetch the export, then trigger a download — gives us a loading state
  // instead of leaving the button inert while the file is prepared.
  async function exportData() {
    setExporting(true);
    try {
      const res = await fetch("/api/user/export");
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resource-base-data.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("account.exportError"));
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      const res = await fetch("/api/user/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (res.status === 403) {
        toast.error(t("account.reauthRequired"));
        setDeleting(false);
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("account.deleted"));
      // Clear local session and go home.
      await signOut();
      window.location.href = "/";
    } catch {
      toast.error(t("account.deleteError"));
      setDeleting(false);
    }
  }

  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {t("account.title")}
      </h2>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="sm:w-auto"
          disabled={exporting}
          onClick={exportData}
        >
          {exporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          {t("account.export")}
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setConfirmOpen(true)}
          className="sm:w-auto"
        >
          <Trash2 className="size-4" />
          {t("account.delete")}
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("account.deleteTitle")}</DialogTitle>
            <DialogDescription>{t("account.deleteWarning")}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmOpen(false)}
            >
              {t("submissions.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              disabled={deleting}
              onClick={deleteAccount}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {t("account.deleteConfirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
