"use client";

import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { detectLanguage, setLanguage } from "@/lib/i18n";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // After hydration (which ran in English, like the server HTML), switch to
  // the visitor's language.
  useEffect(() => {
    const lang = detectLanguage();
    if (lang !== i18n.language) void setLanguage(lang);
  }, []);
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
