"use client";

import Link from "next/link";
import { Building2, Plus, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/auth/auth-provider";
import { MySubmissions } from "@/components/my-submissions";
import { Button } from "@/components/ui/button";
import type { Category } from "@/lib/types";

export function SubmissionsPageView({ categories }: { categories: Category[] }) {
  const { t } = useTranslation();
  const { user, loading, openAuth } = useAuth();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <Send className="size-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">{t("submissions.title")}</h1>
          {user && (
            <div className="ml-auto flex gap-2">
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
            </div>
          )}
        </div>
        <p className="mt-2 text-muted-foreground">{t("submissions.subtitle")}</p>
      </div>
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
