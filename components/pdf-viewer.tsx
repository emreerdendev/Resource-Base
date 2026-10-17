"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

/** CVs are short; anything longer opens in full via "new tab". */
const MAX_PAGES = 10;

type State = "loading" | "ready" | "error";

/**
 * Renders a PDF's pages to canvases with PDF.js, for phones whose browsers
 * can't show a PDF inside the page. PDF.js and its worker are fetched only
 * when this mounts (the CV preview loads it lazily on small screens), and are
 * served as static assets, so they cost nothing per view.
 */
export function PdfViewer({ url, title, errorText }: { url: string; title: string; errorText: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const task = pdfjs.getDocument({ url, useSystemFonts: true, enableXfa: false });
        destroy = () => void task.destroy();
        const doc = await task.promise;
        if (cancelled) return;

        const width = el.clientWidth;
        const ratio = window.devicePixelRatio || 1;
        for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = "100%";
          canvas.className = "rounded-md bg-white shadow-sm";
          canvas.setAttribute("aria-label", `${title} — ${n}/${doc.numPages}`);
          el.appendChild(canvas);
          await page.render({ canvas, viewport }).promise;
          if (n === 1 && !cancelled) setState("ready");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      destroy?.();
      el.replaceChildren();
    };
  }, [url, title]);

  return (
    <div className="relative max-h-[60vh] min-h-40 overflow-y-auto rounded-lg border border-border bg-muted p-2">
      <div ref={container} className="flex flex-col gap-2" />
      {state === "loading" && (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}
      {state === "error" && <p className="p-4 text-center text-sm text-muted-foreground">{errorText}</p>}
    </div>
  );
}
