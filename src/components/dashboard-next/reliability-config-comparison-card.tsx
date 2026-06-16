"use client";

import { useState } from "react";
import { clsx } from "clsx";
import type {
  ConfidenceTrendRange,
  ConfigComparisonGroup,
  ConfigComparisonStatus,
  ConfigComparisonSummaryResponse,
} from "@/lib/api/types";

// Model-config M11 — "Config Comparison" report card on the camera Reliability
// tab. A DESCRIPTIVE before/after view of two applied-config groups from the
// M11 summary endpoint: baseline vs candidate labels, a neutral status chip,
// the backend's factual summary/bullets, comparability notes, and standing
// caveats. This is a report card, NOT a recommender — nothing here says
// "better", "best", "recommended", or implies causation; the backend is built
// the same way and the UI renders its text verbatim.
//
// Same data posture as the other reliability cards: both ranges fetched
// server-side, resilient null (an unavailable endpoint shows a muted body and
// never breaks the tab).

const STATUS_LABEL: Record<ConfigComparisonStatus, string> = {
  comparable: "comparable",
  mixed_metrics: "mixed metrics",
  inconclusive: "inconclusive",
  no_data: "no data",
};

function pct(value: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

export function ReliabilityConfigComparisonCard({
  comparison24h,
  comparison7d,
}: {
  comparison24h: ConfigComparisonSummaryResponse | null;
  comparison7d: ConfigComparisonSummaryResponse | null;
}) {
  const [range, setRange] = useState<ConfidenceTrendRange>("24h");
  const data = range === "24h" ? comparison24h : comparison7d;

  return (
    <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          config comparison
        </p>
        <RangeToggle range={range} onRangeChange={setRange} />
      </div>
      <p className="mt-1 text-[11px] text-[var(--dn-text-50)]">
        Compare reliability metrics across recent applied camera configs.
        Directional comparison only — not causal proof or a recommendation.
      </p>

      {data === null ? (
        <Body>
          Config comparison is currently unavailable. The reliability sections
          above are unaffected.
        </Body>
      ) : (
        <Report data={data} />
      )}
    </section>
  );
}

function Report({ data }: { data: ConfigComparisonSummaryResponse }) {
  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={data.comparison_status} />
        {data.baseline && data.candidate ? (
          <span className="text-[clamp(0.85rem,1vw,0.95rem)] font-semibold text-white">
            {revLabel(data.candidate)} vs {revLabel(data.baseline)}
          </span>
        ) : null}
      </div>

      <p className="text-[clamp(0.85rem,1vw,0.95rem)] text-white">{data.summary}</p>

      {data.baseline && data.candidate ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <GroupPanel title="Baseline" group={data.baseline} />
          <GroupPanel title="Candidate" group={data.candidate} />
        </div>
      ) : data.candidate ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <GroupPanel title="Only config group in window" group={data.candidate} />
        </div>
      ) : null}

      {data.bullets.length > 0 ? (
        <ul className="list-disc pl-5 space-y-1 text-[clamp(0.8rem,0.95vw,0.9rem)] text-white">
          {data.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}

      {data.comparability_notes.length > 0 ? (
        <NoteList
          heading="comparability notes"
          items={data.comparability_notes}
          tone="amber"
        />
      ) : null}

      <NoteList heading="caveats" items={data.caveats} tone="muted" />
    </div>
  );
}

function revLabel(group: ConfigComparisonGroup): string {
  return group.processing_config_revision != null
    ? `Config r${group.processing_config_revision}`
    : "Config (no revision)";
}

function GroupPanel({ title, group }: { title: string; group: ConfigComparisonGroup }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
      <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        {title}
      </p>
      <p className="mt-1 text-[clamp(0.85rem,1vw,0.95rem)] font-semibold text-white">
        {group.label}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1">
        <Stat label="Avg conf" value={pct(group.avg_confidence)} />
        <Stat label="Low-conf" value={pct(group.low_confidence_ratio)} />
        <Stat label="Samples" value={group.sample_count.toLocaleString()} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        {label}
      </p>
      <p className="mt-0.5 text-[clamp(0.85rem,1vw,0.95rem)] text-white">{value}</p>
    </div>
  );
}

function StatusChip({ status }: { status: ConfigComparisonStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2 py-0.5",
        "text-[11px] font-mono uppercase tracking-wider",
        status === "mixed_metrics"
          ? "border-[#8a6d1f]/40 text-[#8a6d1f]"
          : "border-white/10 text-[var(--dn-text-50)]",
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function NoteList({
  heading,
  items,
  tone,
}: {
  heading: string;
  items: string[];
  tone: "amber" | "muted";
}) {
  return (
    <div
      className={clsx(
        "rounded-lg border p-3",
        tone === "amber" ? "border-[#8a6d1f]/30" : "border-white/10",
      )}
    >
      <p
        className={clsx(
          "text-[11px] uppercase tracking-wider font-mono",
          tone === "amber" ? "text-[#8a6d1f]" : "text-[var(--dn-text-50)]",
        )}
      >
        {heading}
      </p>
      <ul className="mt-1 space-y-1 text-[clamp(0.78rem,0.9vw,0.85rem)] text-[var(--dn-text-50)]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-[clamp(0.85rem,1vw,0.95rem)] text-[var(--dn-text-50)]">
      {children}
    </p>
  );
}

const RANGES: ConfidenceTrendRange[] = ["24h", "7d"];

function RangeToggle({
  range,
  onRangeChange,
}: {
  range: ConfidenceTrendRange;
  onRangeChange: (r: ConfidenceTrendRange) => void;
}) {
  return (
    <div role="group" aria-label="Config comparison range" className="inline-flex gap-1">
      {RANGES.map((r) => {
        const active = r === range;
        return (
          <button
            key={r}
            type="button"
            aria-pressed={active}
            onClick={() => onRangeChange(r)}
            className={clsx(
              "rounded-full border px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider transition",
              active
                ? "border-[var(--dn-creek-mid)]/40 bg-[var(--dn-creek-mid)]/15 text-[var(--dn-creek-deep)]"
                : "border-white/10 bg-white/[0.06] text-[var(--dn-text-50)] hover:text-white hover:bg-white/[0.08]",
            )}
          >
            {r}
          </button>
        );
      })}
    </div>
  );
}
