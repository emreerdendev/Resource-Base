import { ImageResponse } from "next/og";
import { siteName, siteDescription } from "@/lib/site";

// No `runtime = "edge"` — OpenNext/Cloudflare runs the Node.js runtime (workerd)
// and next/og's ImageResponse works there. Edge runtime is unsupported by OpenNext.
export const alt = "Resource Base";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default branded OG image (1200×630) used across pages without their own. */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 24,
          padding: 80,
          background: "linear-gradient(135deg, #0b0b12 0%, #16121f 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #694ce6, #8b6ff0)",
              fontSize: 40,
            }}
          >
            📦
          </div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>{siteName}</div>
        </div>
        <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1, maxWidth: 900 }}>
          Resources, companies and CVs in one free directory.
        </div>
        <div style={{ fontSize: 30, color: "#b7b3c7", maxWidth: 900 }}>
          {siteDescription}
        </div>
      </div>
    ),
    { ...size },
  );
}
