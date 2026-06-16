"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

// Client-side pager for the DarkMode cameras grid (Figma frame 409:403
// "Group 39"). "Showing X-Y of Z cameras" + numbered page buttons (active =
// white-on-black) bracketed by prev/next chevrons. Pure presentation — page
// state lives in the grid.
export function CameraPagination({
  page,
  pageCount,
  rangeStart,
  rangeEnd,
  total,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

  const arrowCls =
    "dn-glow-soft grid h-9 w-9 place-items-center rounded-[var(--dn-radius-inner)] bg-[rgba(255,255,255,0.25)] text-white transition hover:bg-[rgba(255,255,255,0.32)] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <p className="text-[clamp(0.74rem,0.9vw,0.9rem)] font-bold text-[var(--dn-text-50)]">
        Showing {rangeStart}-{rangeEnd} of {total} cameras
      </p>

      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className={arrowCls}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
              onClick={() => onPageChange(p)}
              className={`dn-glow-soft grid h-9 w-9 place-items-center rounded-[var(--dn-radius-inner)] text-[clamp(0.78rem,0.95vw,0.92rem)] font-bold transition ${
                p === page
                  ? "bg-white text-black"
                  : "bg-[rgba(255,255,255,0.25)] text-white hover:bg-[rgba(255,255,255,0.32)]"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
            className={arrowCls}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
