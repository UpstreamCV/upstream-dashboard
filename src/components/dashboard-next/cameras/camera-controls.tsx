"use client";

import { ChevronDown, LayoutGrid, List } from "lucide-react";
import { StatusDot } from "../status-dot";
import { BUCKET_META, BUCKET_ORDER, type CameraBucket } from "../dn-status";

// Controls row for the DarkMode cameras grid (Figma frame 409:403 "Frame 5" +
// "Frame 6"). LEFT: an "All" chip + one chip per bucket (dot + label + count).
// RIGHT: a "Sort by: <X>" select styled as a dn pill + a grid/list view toggle.
// All client-state driven; the grid owns the state and passes setters down.

export type CameraFilter = "all" | CameraBucket;
export type CameraSort = "status" | "name" | "updated";
export type CameraView = "grid" | "list";

const SORT_LABEL: Record<CameraSort, string> = {
  status: "Status",
  name: "Name",
  updated: "Recently updated",
};

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`dn-glow-soft inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[clamp(0.78rem,0.95vw,0.92rem)] font-bold transition ${
        active
          ? "bg-white text-black"
          : "bg-[rgba(255,255,255,0.25)] text-white hover:bg-[rgba(255,255,255,0.32)]"
      }`}
    >
      {children}
    </button>
  );
}

export function CameraControls({
  filter,
  onFilterChange,
  counts,
  total,
  sort,
  onSortChange,
  view,
  onViewChange,
}: {
  filter: CameraFilter;
  onFilterChange: (f: CameraFilter) => void;
  counts: Record<CameraBucket, number>;
  total: number;
  sort: CameraSort;
  onSortChange: (s: CameraSort) => void;
  view: CameraView;
  onViewChange: (v: CameraView) => void;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={filter === "all"} onClick={() => onFilterChange("all")}>
          <span>All</span>
          <span
            className={
              filter === "all" ? "text-black/55" : "text-[var(--dn-text-50)]"
            }
          >
            {total}
          </span>
        </Chip>
        {BUCKET_ORDER.map((b) => (
          <Chip
            key={b}
            active={filter === b}
            onClick={() => onFilterChange(b)}
          >
            <StatusDot status={BUCKET_META[b].dot} />
            <span>{BUCKET_META[b].label}</span>
            <span
              className={
                filter === b ? "text-black/55" : "text-[var(--dn-text-50)]"
              }
            >
              {counts[b]}
            </span>
          </Chip>
        ))}
      </div>

      {/* Sort + view toggle */}
      <div className="flex items-center gap-2">
        <div className="dn-glow-soft relative inline-flex items-center rounded-full bg-[rgba(255,255,255,0.25)] text-white">
          <span className="pointer-events-none absolute left-3.5 z-10 flex items-center gap-1 text-[clamp(0.78rem,0.95vw,0.92rem)] font-bold">
            Sort by: {SORT_LABEL[sort]}
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          </span>
          <select
            aria-label="Sort cameras"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as CameraSort)}
            className="relative z-[1] cursor-pointer appearance-none bg-transparent py-1.5 pl-3.5 pr-9 font-bold text-transparent outline-none"
          >
            {/* Width-shimming options carry the visible label so the pill sizes
                to the longest choice; the real label is the overlay above. */}
            <option value="status" className="text-black">
              Sort by: Status
            </option>
            <option value="name" className="text-black">
              Sort by: Name
            </option>
            <option value="updated" className="text-black">
              Sort by: Recently updated
            </option>
          </select>
        </div>

        <div className="dn-glow-soft inline-flex shrink-0 overflow-hidden rounded-full bg-[rgba(255,255,255,0.25)]">
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => onViewChange("grid")}
            className={`grid h-9 w-9 place-items-center transition ${
              view === "grid"
                ? "bg-white text-black"
                : "text-white hover:bg-[rgba(255,255,255,0.12)]"
            }`}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => onViewChange("list")}
            className={`grid h-9 w-9 place-items-center transition ${
              view === "list"
                ? "bg-white text-black"
                : "text-white hover:bg-[rgba(255,255,255,0.12)]"
            }`}
          >
            <List className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
