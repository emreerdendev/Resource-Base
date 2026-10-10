"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { FileUp, Loader2, ShieldCheck, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { StatusPill } from "@/components/company-status-menu";
import { useCompanyTracker } from "@/components/company-tracker-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { importTrackedCompanies } from "@/lib/company-actions";
import { APPLICATION_STATUSES } from "@/lib/company-taxonomy";
import { readTrackerCsv, type TrackerImportResult } from "@/lib/tracker-import";
import type { Company } from "@/lib/types";

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Bring an existing tracker (e.g. a Notion export with "Şirket Adı" + "Durum"
 * columns) into the application tracker. The file is parsed in the browser;
 * only the matched company ids and statuses are sent to the server.
 */
export function TrackerImportDialog({ companies }: { companies: Company[] }) {
  const { t } = useTranslation();
  const { reload } = useCompanyTracker();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<TrackerImportResult | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setResult(null);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) return toast.error(t("tracker.import.tooLarge"));
    const parsed = readTrackerCsv(await file.text(), companies);
    if ("error" in parsed) {
      toast.error(
        parsed.error === "no-name-column" ? t("tracker.import.noNameColumn") : t("tracker.import.empty"),
      );
      return;
    }
    setResult(parsed);
  }

  async function confirm() {
    if (!result?.matched.length) return;
    setPending(true);
    try {
      const res = await importTrackedCompanies(
        result.matched.slice(0, 500).map((m) => ({ companyId: m.company._id, status: m.status })),
      );
      if (!res.ok) {
        toast.error(
          res.error === "rate_limited" ? t("card.favoriteRateLimited") : t("tracker.error"),
        );
        return;
      }
      await reload();
      toast.success(t("tracker.import.done", { count: res.imported }));
      onOpenChange(false);
    } catch {
      toast.error(t("tracker.error"));
    } finally {
      setPending(false);
    }
  }

  const counts = APPLICATION_STATUSES.map((s) => ({
    status: s,
    count: result?.matched.filter((m) => m.status === s).length ?? 0,
  })).filter((c) => c.count > 0);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="size-3.5" />
        {t("tracker.import.button")}
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("tracker.import.title")}</DialogTitle>
            <DialogDescription>{t("tracker.import.description")}</DialogDescription>
          </DialogHeader>

          <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-px size-3.5 shrink-0 text-primary" />
            {t("tracker.import.privacy")}
          </p>

          {!result ? (
            <>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={onFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                <FileUp className="size-6 text-primary" />
                {t("tracker.import.choose")}
                <span className="text-xs">{t("tracker.import.format")}</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-medium">
                  {t("tracker.import.matched", { count: result.matched.length })}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {counts.map(({ status, count }) => (
                    <span key={status} className="inline-flex items-center gap-1">
                      <StatusPill status={status} />
                      <span className="text-xs text-muted-foreground">×{count}</span>
                    </span>
                  ))}
                </div>
              </div>

              {result.unmatched.length > 0 && (
                <div>
                  <p className="text-sm font-medium">
                    {t("tracker.import.unmatched", { count: result.unmatched.length })}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("tracker.import.unmatchedHint")}
                  </p>
                  <ul className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                    {result.unmatched.map((name) => (
                      <li key={name}>
                        <Link
                          href={`/submit?type=company&name=${encodeURIComponent(name)}`}
                          className="inline-flex rounded-full border border-border px-2.5 py-0.5 text-xs transition-colors hover:border-primary/40 hover:text-primary"
                        >
                          + {name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setResult(null)}>
                  {t("tracker.import.another")}
                </Button>
                <Button
                  className="flex-1"
                  disabled={!result.matched.length || pending}
                  onClick={confirm}
                >
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  {t("tracker.import.confirm", { count: result.matched.length })}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
