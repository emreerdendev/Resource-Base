"use client";

import { useState } from "react";
import { initial } from "@/lib/initial";
import type { Company } from "@/lib/types";
import { cn, favicon } from "@/lib/utils";

/** Favicon of the company's site, falling back to its initial. */
export function CompanyLogo({
  company,
  size = "md",
}: {
  company: Pick<Company, "name" | "website">;
  size?: "md" | "lg" | "xl";
}) {
  // Only the company's own website: career platforms (lever, hrpanda…) and
  // LinkedIn would show *their* icon instead of the company's.
  const icon = company.website ? favicon(company.website) : undefined;
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={cn(
        "relative z-10 grid shrink-0 place-items-center overflow-hidden rounded-lg bg-muted/60 font-semibold text-muted-foreground",
        size === "md" && "size-9 text-sm",
        size === "lg" && "size-10 text-base",
        size === "xl" && "size-14 rounded-xl border border-border text-xl",
      )}
    >
      {icon && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={icon}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className={size === "xl" ? "size-7" : "size-5"}
        />
      ) : (
        initial(company.name)
      )}
    </span>
  );
}
