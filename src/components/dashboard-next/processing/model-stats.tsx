import type { ModelMetrics } from "@/lib/api/types";

// P5-L — presentational helpers for PUBLISHED reference model stats. The
// numbers are never Upstream-measured; the note below is load-bearing honesty.

export const PUBLISHED_STATS_NOTE =
  "Published reference benchmarks — not measured on your cameras.";

export function PublishedStatsNote() {
  return <p className="text-[11px] text-[var(--dn-text-40)]">{PUBLISHED_STATS_NOTE}</p>;
}

/** The headline accuracy figure: COCO mAP for YOLO models, else the labelled
 *  vendor KPI for the TAO models, else "—". */
function headlineAccuracy(m: ModelMetrics | null): string {
  if (!m) return "—";
  if (m.coco_map50_95 != null) return `mAP ${m.coco_map50_95}`;
  if (m.vendor_kpi_value != null) return `${m.vendor_kpi_value}`;
  return "—";
}

/** Compact one-line stat summary (used in the picker trigger + option rows). */
export function ModelStatLine({
  metrics,
  computeTier,
}: {
  metrics: ModelMetrics | null;
  computeTier: string | null;
}) {
  const parts: string[] = [headlineAccuracy(metrics)];
  if (metrics?.params_m != null) parts.push(`${metrics.params_m}M`);
  if (metrics?.input_size != null) parts.push(`${metrics.input_size}px`);
  if (computeTier) parts.push(`${computeTier} compute`);
  return (
    <span className="font-mono text-[11px] text-[var(--dn-text-50)]">{parts.join(" · ")}</span>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--dn-text-40)]">
        {label}
      </span>
      <span className="text-sm text-white">{value}</span>
    </div>
  );
}

/** Fuller labelled stat grid for the selected model + the honesty note. */
export function ModelStatsDetail({
  metrics,
  computeTier,
}: {
  metrics: ModelMetrics | null;
  computeTier: string | null;
}) {
  if (!metrics) {
    return (
      <p className="text-xs text-[var(--dn-text-50)]">
        No published benchmarks recorded for this model.
      </p>
    );
  }
  const fmt = (v: number | null) => (v == null ? "—" : `${v}`);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cell label="COCO mAP 50-95" value={fmt(metrics.coco_map50_95)} />
        <Cell label="params" value={metrics.params_m == null ? "—" : `${metrics.params_m}M`} />
        <Cell
          label="input"
          value={metrics.input_size == null ? "—" : `${metrics.input_size}px`}
        />
        <Cell label="compute" value={computeTier ?? "—"} />
      </div>
      {metrics.vendor_kpi_label ? (
        <p className="text-xs text-[var(--dn-text-50)]">
          <span className="font-bold text-white/80">{metrics.vendor_kpi_label}:</span>{" "}
          {metrics.vendor_kpi_value == null ? "see model card" : metrics.vendor_kpi_value}
          {metrics.vendor_kpi_note ? ` — ${metrics.vendor_kpi_note}` : ""}
        </p>
      ) : null}
      <p className="text-[11px] text-[var(--dn-text-40)]">
        {PUBLISHED_STATS_NOTE} Source: {metrics.metric_source}
        {metrics.metric_dataset ? ` (${metrics.metric_dataset})` : ""}.
      </p>
    </div>
  );
}
