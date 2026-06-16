import type { ReactNode } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Clock } from "lucide-react";
import { RelativeTime } from "@/components/data/relative-time";
import { StatusDot, type DotStatus } from "./status-dot";
import type { ObservationRecord } from "@/lib/api/types";

// Summary tiles for the Observations tab — an at-a-glance read of the line-
// counting signal (total crossings, directional split, recency), derived live
// from the loaded observations so it tracks the panel's refresh/poll. Echoes
// the Cameras-page StatCard row (white .dn-tile, Satoshi bold, clamp sizing).
//
// Crossing-specific by design: returns null unless this camera has
// `processor.line_crossing` observations, so cameras running only other
// processors (ROI/dwell/zone) just show the detail table below — no row of
// meaningless zeros.

function payloadOf(o: ObservationRecord): Record<string, unknown> {
  const p = o.payload;
  return p && typeof p === "object" && !Array.isArray(p)
    ? (p as Record<string, unknown>)
    : {};
}

const ICON_STYLE = {
  width: "clamp(15px,1.6vw,19px)",
  height: "clamp(15px,1.6vw,19px)",
} as const;
const ICON_CLASS = "text-[var(--dn-creek-mid)] shrink-0";

function ObsTile({
  label,
  value,
  caption,
  icon,
  dot,
  valueClass = "text-[clamp(1.6rem,3.4vw,2.6rem)]",
}: {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  icon?: ReactNode;
  dot?: DotStatus;
  valueClass?: string;
}) {
  return (
    <div className="dn-tile flex flex-col gap-1.5 p-[clamp(0.9rem,1.6vw,1.4rem)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[clamp(0.62rem,0.8vw,0.78rem)] font-bold uppercase tracking-wide text-[var(--dn-text-50)]">
          {label}
        </span>
        {dot ? <StatusDot status={dot} /> : icon}
      </div>
      <span className={`font-bold leading-none text-white ${valueClass}`}>
        {value}
      </span>
      {caption ? (
        <span className="text-[clamp(0.68rem,0.85vw,0.82rem)] text-[var(--dn-text-50)]">
          {caption}
        </span>
      ) : null}
    </div>
  );
}

export function ObservationSummaryTiles({
  observations,
}: {
  observations: ObservationRecord[];
}) {
  const crossings = observations.filter(
    (o) => o.type === "processor.line_crossing",
  );
  if (crossings.length === 0) return null;

  let entering = 0;
  let exiting = 0;
  const lines = new Set<string>();
  for (const o of crossings) {
    const p = payloadOf(o);
    const delta =
      typeof p.count_delta === "number" && Number.isFinite(p.count_delta)
        ? p.count_delta
        : 1;
    if (p.direction === "out") exiting += delta;
    else entering += delta;
    const line =
      (typeof p.line_label === "string" && p.line_label) ||
      (typeof p.line_id === "string" && p.line_id) ||
      null;
    if (line) lines.add(line);
  }
  const total = entering + exiting;

  // The API returns observations newest-first, so the head is the most recent.
  const last = crossings[0];
  const lastAt = last?.observed_at ?? null;
  const lastDir = payloadOf(last ?? ({} as ObservationRecord)).direction === "out"
    ? "exiting"
    : "entering";

  const lineSummary =
    lines.size === 0
      ? "—"
      : lines.size === 1
        ? [...lines][0]
        : `${lines.size} lines tracked`;
  const pct = (n: number): string | undefined =>
    total > 0 ? `${Math.round((n / total) * 100)}% of crossings` : undefined;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">
      <ObsTile
        label="Total crossings"
        value={total}
        dot={total > 0 ? "green" : "neutral"}
        caption={lineSummary}
      />
      <ObsTile
        label="Entering"
        value={entering}
        caption={pct(entering)}
        icon={<ArrowDownToLine className={ICON_CLASS} style={ICON_STYLE} aria-hidden />}
      />
      <ObsTile
        label="Exiting"
        value={exiting}
        caption={pct(exiting)}
        icon={<ArrowUpFromLine className={ICON_CLASS} style={ICON_STYLE} aria-hidden />}
      />
      <ObsTile
        label="Last crossing"
        value={<RelativeTime value={lastAt} />}
        valueClass="text-[clamp(1.05rem,1.9vw,1.5rem)]"
        caption={lastAt ? lastDir : undefined}
        icon={<Clock className={ICON_CLASS} style={ICON_STYLE} aria-hidden />}
      />
    </div>
  );
}
