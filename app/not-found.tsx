import { NotFoundView } from "@/components/not-found-view";
import { SiteChrome } from "@/components/site-chrome";

/**
 * 404 for URLs that match no route. It renders outside the (site) layout, so
 * it brings the same chrome itself — header, footer, search — like every page.
 */
export default function NotFound() {
  return (
    <SiteChrome>
      <NotFoundView />
    </SiteChrome>
  );
}
