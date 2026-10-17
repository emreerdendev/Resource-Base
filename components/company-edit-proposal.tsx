"use client";

import { useTranslation } from "react-i18next";
import { COMPANY_EDIT_KEYS, type CompanyEditFields } from "@/lib/company-edit";

const LABEL_KEY: Record<(typeof COMPANY_EDIT_KEYS)[number], string> = {
  name: "suggest.name",
  website: "suggest.website",
  careerUrl: "suggest.career",
  linkedin: "LinkedIn",
  emails: "suggest.emails",
};

/**
 * Read-only view of a company edit suggestion: each changed field as the old
 * value struck through above the new one (an emptied field shows as removed),
 * or the removal report on its own. Used by the company modal's pending view
 * and the "My Submissions" detail.
 */
export function CompanyEditProposal({
  proposed,
  original,
  proposeRemoval = false,
  note,
}: {
  proposed: CompanyEditFields | null;
  original: CompanyEditFields | null;
  proposeRemoval?: boolean;
  note?: string | null;
}) {
  const { t } = useTranslation();

  if (proposeRemoval) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
        <p className="font-medium">{t("companyEdit.removalProposed")}</p>
        {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      </div>
    );
  }

  const show = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(", ") : (v ?? ""));
  const rows = COMPANY_EDIT_KEYS.filter((k) => proposed && k in proposed);

  return (
    <div className="flex flex-col gap-3">
      {rows.map((k) => {
        const from = show(original?.[k]);
        const to = show(proposed?.[k]);
        return (
          <div key={k} className="flex flex-col gap-1.5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {k === "linkedin" ? LABEL_KEY[k] : t(LABEL_KEY[k])}
            </p>
            {from && (
              <p className="break-all rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-xs text-muted-foreground line-through">
                {from}
              </p>
            )}
            {to ? (
              <p className="break-all rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-foreground">
                {to}
              </p>
            ) : (
              <p className="text-[11px] text-destructive">{t("companyEdit.cleared")}</p>
            )}
          </div>
        );
      })}
      {note && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("submit.note")}
          </p>
          <p className="text-xs text-muted-foreground">{note}</p>
        </div>
      )}
    </div>
  );
}
