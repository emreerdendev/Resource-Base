import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { siteName, siteDescription, siteUrl } from "@/lib/site";

// Inter for body text (crisp, neutral), Plus Jakarta Sans for headings
// (modern, geometric, distinctive). Geist Mono for code/kbd.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Resource Base — Companies & resources for everything",
    template: "%s · Resource Base",
  },
  description: siteDescription,
  openGraph: {
    type: "website",
    siteName,
    title: "Resource Base — Companies & resources for everything",
    description: siteDescription,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Resource Base — Companies & resources for everything",
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {gaId && (
          <>
            {/* Google Analytics with Consent Mode v2. The default (denied) MUST
                execute before gtag.js loads so nothing is stored until the user
                grants consent — inlining both here, in order, in <head>
                guarantees it. ConsentGate flips consent via gtag('consent',
                'update', …) once the user chooses. */}
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',wait_for_update:500});gtag('js',new Date());gtag('config','${gaId}');`,
              }}
            />
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            />
          </>
        )}
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
