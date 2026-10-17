"use client";

import Link from "next/link";
import { Building2, Plus, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth/auth-provider";
import { MySubmissions } from "@/components/my-submissions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import type { Category } from "@/lib/types";

export function SubmissionsPageView({ categories }: { categories: Category[] }) {
  const { t } = useTranslation();
  const { user, loading, openAuth } = useAuth();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        icon={Send}
        title={t("submissions.title")}
        description={t("submissions.subtitle")}
        actions={
          user && (
            <>
              <Button asChild size="sm" variant="outline">
                <Link href="/submit?type=company">
                  <Building2 className="size-3.5" /> {t("nav.suggestCompany")}
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/submit">
                  <Plus className="size-3.5" /> {t("nav.submit")}
                </Link>
              </Button>
            </>
          )
        }
      />
      {!loading && !user ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <Button onClick={() => openAuth()}>{t("header.signIn")}</Button>
        </div>
      ) : (
        <MySubmissions categories={categories} />
      )}
    </div>
  );
}
