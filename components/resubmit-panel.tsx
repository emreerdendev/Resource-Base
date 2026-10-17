"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CompanyEditEditor } from "@/components/company-edit-editor";
import { TaxonomyFixEditor } from "@/components/taxonomy-fix-editor";
import { Button } from "@/components/ui/button";
import { IconInput } from "@/components/ui/icon-input";
import { normalizeWebUrl } from "@/lib/company-input";
import { getResubmitContext, type ResubmitContext } from "@/lib/data-actions";
import type { Submission } from "@/lib/types";

/**
 * Edit a rejected edit suggestion and send it again: the same editor used on
 * the resource / company, starting from what was proposed. The new suggestion
 * replaces the rejected one (see `replaces` in /api/submit).
 */
export function ResubmitPanel({
  submission,
  onCancel,
  onDone,
}: {
  submission: Submission;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const id = submission.sanity_submission_id ?? "";
  const [ctx, setCtx] = useState<ResubmitContext | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    getResubmitContext(id)
      .then((c) => active && setCtx(c))
      .catch(() => active && setCtx(null));
    return () => {
      active = false;
    };
  }, [id]);

  if (ctx === undefined)
    return (
      <div className="grid place-items-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  if (!ctx || ctx.kind === "gone" || ctx.kind === "company")
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t("submissions.resubmitGone")}</p>
        <Button variant="outline" onClick={onCancel}>
          {t("submissions.cancel")}
        </Button>
      </div>
    );
  if (ctx.kind === "taxonomy")
    return (
      <TaxonomyFixEditor
        resource={ctx.resource}
        onCancel={onCancel}
        onDone={onDone}
        resubmit={{ replaces: id, ...ctx.proposal }}
      />
    );
  if (ctx.kind === "companyEdit")
    return (
      <CompanyEditEditor
        company={ctx.company}
        onCancel={onCancel}
        onDone={onDone}
        resubmit={{ replaces: id, proposed: ctx.proposed, removal: ctx.removal, note: ctx.note }}
      />
    );
  return <FixResubmit resource={ctx.resource} url={ctx.url ?? ""} replaces={id} onCancel={onCancel} onDone={onDone} />;
}

/** A broken-link fix: just the corrected URL. */
function FixResubmit({
  resource,
  url: initial,
  replaces,
  onCancel,
  onDone,
}: {
  resource: { _id: string; name: string; url: string };
  url: string;
  replaces: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState(initial);
  const [pending, setPending] = useState(false);
  const normalized = normalizeWebUrl(url);
  const error = !normalized ? t("validation.url") : normalized === normalizeWebUrl(resource.url) ? t("modal.fixSame") : null;

  async function submit() {
    if (error || !normalized || pending) return;
    setPending(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "fix", targetResourceId: resource._id, name: resource.name, url: normalized, replaces }),
      });
      if (res.status === 403) {
        toast.error(t("verifyBanner.verifyFirst"));
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("modal.fixSuccess"));
      onDone();
    } catch {
      toast.error(t("modal.fixError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="resubmit-fix-url" className="text-xs font-medium text-foreground">
        {t("modal.fixLabel")}
      </label>
      <IconInput
        id="resubmit-fix-url"
        inputMode="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        aria-invalid={Boolean(error)}
        placeholder="https://…"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          {t("submissions.cancel")}
        </Button>
        <Button type="button" className="flex-1" disabled={Boolean(error) || pending} onClick={submit}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {t("submissions.resubmit")}
        </Button>
      </div>
    </div>
  );
}
