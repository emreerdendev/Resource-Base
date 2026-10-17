import { I18nProvider } from "@/components/i18n-provider";
import { NotFoundView } from "@/components/not-found-view";

/**
 * Root 404 (URLs that match no route) — renders outside the (site) layout, so
 * it brings its own i18n and logo. 404s inside the site use
 * app/(site)/not-found.tsx, with the header and footer.
 */
export default function NotFound() {
  return (
    <I18nProvider>
      <NotFoundView standalone />
    </I18nProvider>
  );
}
