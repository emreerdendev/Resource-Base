import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Makes Cloudflare bindings (D1 `DB`, KV, EMAIL, ...) available during `next dev`,
// so getCloudflareContext() resolves locally without a full workerd build.
initOpenNextCloudflareForDev();

/**
 * 301 redirects from the legacy VitePress URLs to the new category pages,
 * so the domain keeps its existing search ranking. Old path -> new slug.
 */
const LEGACY_REDIRECTS: Record<string, string> = {
  "/introduction": "/",
  // resources/
  "/resources/documents": "/category/documentation",
  "/resources/videos": "/category/videos",
  "/resources/courses": "/category/courses",
  "/resources/certificate-programs": "/category/certificate-programs",
  "/resources/training-code-battles-sites": "/category/practice",
  "/resources/cheat-sheets": "/category/cheat-sheets",
  "/resources/roadmaps": "/category/roadmaps",
  "/resources/github-repositories": "/category/github-repositories",
  "/resources/resource-search": "/category/resource-search",
  // assets/
  "/assets/ui-design": "/category/ui-components",
  "/assets/libraries-plugins": "/category/libraries-plugins",
  "/assets/ready-to-use": "/category/ready-to-use",
  "/assets/templates": "/category/templates",
  "/assets/icons": "/category/icons",
  "/assets/colors": "/category/colors",
  "/assets/fonts": "/category/fonts",
  "/assets/stock-media-resources": "/category/stock-media",
  // tools/
  "/tools/css-generators": "/category/css-generators",
  "/tools/hosts": "/category/hosting",
  "/tools/api": "/category/apis",
  // extensions/
  "/extensions/browser-extensions": "/category/browser-extensions",
  "/extensions/vscode-extensions": "/category/vscode-extensions",
  // useful-sections/
  "/useful-sections/ai-tools": "/category/ai-tools",
  "/useful-sections/cv-resume-builders": "/category/resume-builders",
  "/useful-sections/code-snippets": "/category/code-snippet-images",
  "/useful-sections/mockup-generators": "/category/mockup-generators",
  "/useful-sections/github-generators": "/category/github-generators",
};

/** Filters that only exist on the resource browser (see redirects below). */
const RESOURCE_BROWSE_PARAMS = ["category", "tags", "pricing", "lang", "sort"];

/**
 * Content Security Policy. Whitelists exactly the origins the app talks to:
 *  - scripts: self + Google Analytics (@next/third-parties).
 *    Next.js injects inline hydration scripts, so 'unsafe-inline' is required
 *    here (nonce-based CSP needs per-request middleware wiring — out of scope).
 *  - styles: self + 'unsafe-inline' (Tailwind/Next inject inline styles) + Google Fonts.
 *  - images: self + https + data: (favicons via google s2, avatars).
 *  - connect: self (auth + data go through same-origin server actions) + Sanity
 *    + analytics endpoints.
 * Wildcards keep it portable across preview/prod and provider subdomains.
 */
const isDev = process.env.NODE_ENV === "development";

// React's dev build uses eval() for debugging; production never does. So we
// only relax script-src with 'unsafe-eval' in development.
// Cloudflare Turnstile (bot protection) loads its script from and runs its
// challenge in an iframe on challenges.cloudflare.com.
const TURNSTILE = "https://challenges.cloudflare.com";

// Google Analytics 4 per Google's CSP guide: hits go to regional endpoints
// (e.g. region1.google-analytics.com for EU/TR visitors) and to
// *.analytics.google.com — allowing only www.google-analytics.com silently
// dropped most of them.
const GA_SCRIPT = "https://*.googletagmanager.com";
const GA_CONNECT =
  "https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com";

const scriptSrc = isDev
  ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${GA_SCRIPT} ${TURNSTILE}`
  : `script-src 'self' 'unsafe-inline' ${GA_SCRIPT} ${TURNSTILE}`;

// In dev, Next.js needs a WebSocket (ws:) to the local server for HMR; without
// it the browser blocks the connection and the console floods with CSP errors.
const connectSrc = isDev
  ? `connect-src 'self' ws: wss: https://*.sanity.io ${GA_CONNECT} ${TURNSTILE}`
  : `connect-src 'self' https://*.sanity.io ${GA_CONNECT} ${TURNSTILE}`;

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' https: data:",
  "font-src 'self' https://fonts.gstatic.com",
  connectSrc,
  // 'self': the CV preview embeds /api/cv/<id>/file.
  `frame-src 'self' ${TURNSTILE}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.google.com", pathname: "/s2/**" },
    ],
  },
  async headers() {
    // Apply to everything except the Sanity Studio, which needs a looser CSP
    // (it loads its own scripts/iframes/eval and manages its own security).
    return [
      {
        source: "/((?!studio|api/cv/|api/cv$).*)",
        headers: securityHeaders,
      },
      // CV PDFs: framed only by this site (the CV preview). A page CSP here
      // would stop the browser's PDF viewer; nosniff keeps the bytes from
      // ever being treated as HTML.
      {
        source: "/api/cv/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          ...securityHeaders.filter(
            (h) => h.key !== "Content-Security-Policy" && h.key !== "X-Frame-Options",
          ),
        ],
      },
    ];
  },
  // Public profiles live at /@username; the files sit under /profile/[username]
  // (a folder can't start with "@" — that's a parallel route slot).
  async rewrites() {
    return [{ source: "/@:username", destination: "/profile/:username" }];
  },
  async redirects() {
    return [
      // Old profile links → /@username (the editor keeps /profile/edit).
      {
        source: "/profile/:username((?!edit$)[^/]+)",
        destination: "/@:username",
        permanent: true,
      },
      // The contribute forms moved to their own paths. Order matters: the
      // company rule must come first (query params carry over, e.g. ?name=).
      {
        source: "/submit",
        has: [{ type: "query" as const, key: "type", value: "company" }],
        destination: "/submit/company",
        permanent: true,
      },
      { source: "/submit", destination: "/submit/resource", permanent: true },
      ...Object.entries(LEGACY_REDIRECTS).map(([source, destination]) => ({
        source,
        destination,
        permanent: true,
      })),
      // "/" used to be the resource browser; it's now the company directory.
      // Forward old filtered links (/?category=…&tags=…) — the query string is
      // carried over automatically.
      ...RESOURCE_BROWSE_PARAMS.map((key) => ({
        source: "/",
        has: [{ type: "query" as const, key }],
        destination: "/resources",
        permanent: true,
      })),
    ];
  },
};

export default nextConfig;
