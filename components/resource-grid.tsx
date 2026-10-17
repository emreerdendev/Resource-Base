"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ResourceCard } from "@/components/resource-card";
import { Pagination } from "@/components/pagination";
import type { Resource } from "@/lib/types";

/**
 * Paginated grid of resource cards — shared by category, tag and favorites
 * pages. Same limits as the home browse list: 90 per page on desktop (30×3),
 * 30 on mobile, with the page anchored to the top of the grid on change.
 */
export function ResourceGrid({ resources }: { resources: Resource[] }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(90);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const apply = () => setPageSize(mq.matches ? 90 : 30);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (resources.length === 0) {
    return (
      <p className="py-16 text-center text-muted-foreground">
        {t("browse.empty")}
      </p>
    );
  }

  const totalPages = Math.max(1, Math.ceil(resources.length / pageSize));
  // Clamped, so a shrinking set (e.g. un-favoriting the last item on the last
  // page) lands on the new last page instead of an empty one.
  const currentPage = Math.min(page, totalPages);
  const paged = resources.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const goToPage = (p: number) => {
    setPage(p);
    requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <>
      <div ref={topRef} className="scroll-mt-28" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {paged.map((r) => (
          <ResourceCard key={r._id} resource={r} />
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          onChange={goToPage}
          prevLabel={t("browse.prev")}
          nextLabel={t("browse.next")}
          firstLabel={t("browse.first")}
          pageLabel={t("browse.page", {
            page: currentPage,
            total: totalPages,
          })}
        />
      )}
    </>
  );
}
