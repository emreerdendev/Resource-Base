"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "tr", label: "Türkçe" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

const STORAGE_KEY = "lang";
const CODES = SUPPORTED_LANGUAGES.map((l) => l.code) as readonly string[];
const isCode = (v: unknown): v is LanguageCode => typeof v === "string" && CODES.includes(v);

/** Other languages load on demand, so English-only visitors never download them. */
const LOADERS: Record<Exclude<LanguageCode, "en">, () => Promise<Record<string, unknown>>> = {
  de: () => import("./locales/de").then((m) => m.de),
  fr: () => import("./locales/fr").then((m) => m.fr),
  es: () => import("./locales/es").then((m) => m.es),
  tr: () => import("./locales/tr").then((m) => m.tr),
};

// Always starts in English — the language the static pages are rendered in —
// so the first client render matches the server HTML (no hydration mismatch).
// The visitor's language is applied right after hydration (I18nProvider).
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    lng: "en",
    resources: { en: { translation: en } },
    fallbackLng: "en",
    supportedLngs: CODES as string[],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

  // Keep <html lang> in sync for accessibility / SEO.
  i18n.on("languageChanged", (lng) => {
    if (typeof document !== "undefined") document.documentElement.lang = lng;
  });
}

/** Switch language, loading its strings first. Remembered on this device. */
export async function setLanguage(code: LanguageCode) {
  if (code !== "en" && !i18n.hasResourceBundle(code, "translation")) {
    i18n.addResourceBundle(code, "translation", await LOADERS[code]());
  }
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* private mode */
  }
  await i18n.changeLanguage(code);
}

/** The saved choice, else the first supported browser language, else English. */
export function detectLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isCode(saved)) return saved;
  } catch {
    /* private mode */
  }
  for (const l of navigator.languages ?? [navigator.language]) {
    const base = l?.slice(0, 2).toLowerCase();
    if (isCode(base)) return base;
  }
  return "en";
}

export default i18n;
