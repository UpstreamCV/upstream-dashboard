import type { CollectorStatus, SourceHealthStatus } from "@/lib/api/types";
import { StatusDot, type DotStatus } from "./status-dot";

// Compact source-health rollup for /agents/collector (M2b), from the liveness
// sweep's per-account counts. Hidden until at least one source exists. unknown /
// disabled are intentionally not tiled (they're not actionable states).

const TILES: { key: SourceHealthStatus; label: string; dot: DotStatus }[] = [
  { key: "healthy", label: "Healthy sources", dot: "green" },
  { key: "delayed", label: "Delayed sources", dot: "yellow" },
  { key: "silent", label: "Silent sources", dot: "red" },
  { key: "collector_offline", label: "Collector offline", dot: "red" },
];

export function CollectorHealthSummary({ status }: { status: CollectorStatus }) {
  const counts = status.source_health_counts;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      {TILES.map((t) => {
        const n = counts[t.key] ?? 0;
        return (
          <div
            key={t.key}
            className="dn-tile flex flex-col gap-2 p-[clamp(0.9rem,1.6vw,1.4rem)]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[clamp(0.62rem,0.8vw,0.78rem)] font-bold uppercase tracking-wide text-[var(--dn-text-50)]">
                {t.label}
              </span>
              <StatusDot status={n > 0 ? t.dot : "neutral"} />
            </div>
            <span className="font-bold leading-none text-[clamp(1.2rem,2.4vw,1.9rem)]">
              {n}
            </span>
          </div>
        );
      })}
    </div>
  );
}
