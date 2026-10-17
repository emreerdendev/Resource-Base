"use client";

import { useTranslation } from "react-i18next";

/**
 * A translated string inside a server component (which can't call
 * useTranslation itself), e.g. <T k="category.resources" values={{ count }} />.
 */
export function T({ k, values }: { k: string; values?: Record<string, unknown> }) {
  const { t } = useTranslation();
  return <>{t(k, values)}</>;
}
