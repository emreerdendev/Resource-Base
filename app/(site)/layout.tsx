import { AuthProvider } from "@/components/auth/auth-provider";
import { AuthRequiredPrompt } from "@/components/auth/auth-required-prompt";
import { ClickCountsProvider } from "@/components/click-counts-provider";
import { CommandPalette } from "@/components/command-palette";
import { CompanyTrackerProvider } from "@/components/company-tracker-provider";
import { CvLikesProvider } from "@/components/cv-likes-provider";
import { ConsentGate } from "@/components/consent";
import { ContributorsProvider } from "@/components/contributors-provider";
import { FavoriteCountsProvider } from "@/components/favorite-counts-provider";
import { FavoritesProvider } from "@/components/favorites-provider";
import { I18nProvider } from "@/components/i18n-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ScrollToTop } from "@/components/scroll-to-top";
import { TaxonomyProvider } from "@/components/taxonomy-provider";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { ProfileProvider } from "@/lib/profile";
import { NotificationsProvider } from "@/lib/notifications";
import { SubmissionsProvider } from "@/lib/submissions";
import { Suspense } from "react";

/**
 * Public site chrome. AuthProvider + ClickCountsProvider wrap everything so the
 * header, cards and favorites share auth state and click counts. The command
 * palette loads its own dataset on first open (/api/search-index), and the
 * taxonomy loads where it's used (/api/taxonomy) — the layout fetches nothing,
 * so pages carry only their own data and their own cache tags.
 */
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <I18nProvider>
      <AuthProvider>
        <ProfileProvider>
          <SubmissionsProvider>
            <NotificationsProvider>
              <TaxonomyProvider>
                <FavoriteCountsProvider>
                  <FavoritesProvider>
                    <CompanyTrackerProvider>
                      <CvLikesProvider>
                        <ClickCountsProvider>
                          <ContributorsProvider>
                            <div className="flex min-h-screen flex-col">
                              <ScrollToTop />
                              <SiteHeader />
                              <CommandPalette />
                              <Suspense>
                                <AuthRequiredPrompt />
                              </Suspense>
                              {/* Clear the floating header (top-3 + h-14 ≈ 4.25rem) so
                                  page content never renders behind it. */}
                              <main className="flex-1 px-4 pb-12 pt-10">
                                <VerifyEmailBanner />
                                {children}
                              </main>
                              <SiteFooter />
                            </div>
                            <ConsentGate gaId={process.env.NEXT_PUBLIC_GA_ID} />
                          </ContributorsProvider>
                        </ClickCountsProvider>
                      </CvLikesProvider>
                    </CompanyTrackerProvider>
                  </FavoritesProvider>
                </FavoriteCountsProvider>
              </TaxonomyProvider>
            </NotificationsProvider>
          </SubmissionsProvider>
        </ProfileProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
