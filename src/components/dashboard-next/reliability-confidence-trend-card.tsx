"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { formatAbsolute } from "@/lib/time";
import {
  interpretConfidenceTrend,
  type ConfidenceTrendStatus,
  type ConfidenceTrendVerdict,
} from "@/lib/perception/confidence-trend-interpretation";
import type {
  ConfidenceTrendPoint,
  ConfidenceTrendRange,
  ConfidenceTrendResponse,
} from "@/lib/api/types";

// Reliability M7/M8-A — "Detection confidence trend" card on the camera
// Reliability tab. Renders an hourly average-confidence sparkline from the M6
// rollups (served pre-aggregated across packages by the read API), with a
// 24h | 7d range toggle and a plain-language trend badge. No chart library — a
// hand-rolled inline SVG keeps the dependency surface zero.
//
// M8-A note: both ranges are fetched server-side and passed in as props; the
// toggle just switches which one is shown (instant, no client fetch). The trend
// badge is a DASHBOARD-LEVEL interpretation of the points (interpretConfidenceTrend),
// NOT a persisted reliability finding — M5 drift + M6 rollups are unchanged.
//
// Per-range states (in order): unavailable (fetch failed / null) → empty (no
// rollups) → warming up (fewer than two hourly confidence points) → chart.
// Hours with no usable confidence (empty-frame hours) are gaps in the line.

// Sparkline geometry. The viewBox is stretched to the card width
// (preserveAspectRatio="none"); confidence 0..1 maps to the vertical axis with
// higher = more confident.
const VW = 100;
const VH = 32;
const PAD = 2;
const IW = VW - PAD * 2;
const IH = VH - PAD * 2;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function pct(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

export function ReliabilityConfidenceTrendCard({
  trend24h,
  trend7d,
}: {
  trend24h: ConfidenceTrendResponse | null;
  trend7d: ConfidenceTrendResponse | null;
}) {
  const [range, setRange] = useState<ConfidenceTrendRange>("24h");
  const trend = range === "24h" ? trend24h : trend7d;
  // Compute the verdict once and derive BOTH the badge and the chart gate from
  // it, so the sparkline and the badge can never disagree: the chart is only
  // drawn for a real (non-"warming") verdict — when there isn't enough history
  // to judge a trend, the body shows the "collecting" copy and the badge says
  // "Warming up", never a finished-looking line under a "not enough history"
  // badge.
  const verdict = trend ? interpretConfidenceTrend(trend.points) : null;
  const hasVerdict = verdict != null && verdict.status !== "warming";
  return (
    <Card range={range} onRangeChange={setRange}>
      {verdict ? <TrendBadge verdict={verdict} /> : null}
      <TrendBody trend={trend} hasVerdict={hasVerdict} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Per-range body (the M7 states), now driven by the selected range. The chart
// gate is the verdict (hasVerdict), so it stays consistent with the badge.
// ---------------------------------------------------------------------------

function TrendBody({
  trend,
  hasVerdict,
}: {
  trend: ConfidenceTrendResponse | null;
  hasVerdict: boolean;
}) {
  if (trend === null) {
    return (
      <Body>
        Confidence trend is currently unavailable. Existing camera monitoring is
        unaffected.
      </Body>
    );
  }

  const points = trend.points;
  if (points.length === 0) {
    return (
      <Body>
        No confidence history yet. A trend appears once this camera has been
        processing for at least an hour.
      </Body>
    );
  }

  if (!hasVerdict) {
    // Some confidence data, but not yet enough hours/samples to judge a trend —
    // matches the "Warming up" badge. Show the factual stats, not a line.
    const hasRated = points.some((p) => p.avg_confidence != null);
    return (
      <>
        <Body>
          Collecting confidence history… a trend appears once this camera has
          enough recent confidence data.
        </Body>
        {hasRated ? <StatRow trend={trend} /> : null}
      </>
    );
  }

  return (
    <>
      <Sparkline points={points} />
      <StatRow trend={trend} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Trend badge (M8-A) — dashboard-level interpretation, not a finding.
// ---------------------------------------------------------------------------

const BADGE_COLOR: Record<ConfidenceTrendStatus, string> = {
  degrading: "border-[#8a6d1f]/40 text-[#8a6d1f]",
  improving: "border-[var(--dn-creek-mid)]/40 text-[var(--dn-creek-deep)]",
  stable: "border-white/10 text-[var(--dn-text-50)]",
  warming: "border-white/10 text-[var(--dn-text-50)]",
};

function TrendBadge({ verdict }: { verdict: ConfidenceTrendVerdict }) {
  return (
    <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span
        className={clsx(
          "inline-flex items-center rounded-full border px-2 py-0.5",
          "text-[11px] font-mono uppercase tracking-wider",
          BADGE_COLOR[verdict.status],
        )}
      >
        Trend: {verdict.label}
      </span>
      <span className="text-[clamp(0.8rem,0.95vw,0.9rem)] text-[var(--dn-text-50)]">
        {verdict.blurb}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparkline.
// ---------------------------------------------------------------------------

function Sparkline({ points }: { points: ConfidenceTrendPoint[] }) {
  const n = points.length;
  const coords = points.map((p, i) => ({
    p,
    x: PAD + (n === 1 ? IW / 2 : (i / (n - 1)) * IW),
    y: p.avg_confidence == null ? null : PAD + (1 - clamp01(p.avg_confidence)) * IH,
  }));

  // Split into runs of consecutive non-null points so a gap (empty-frame hour)
  // breaks the line instead of drawing a misleading straight segment across it.
  const runs: { x: number; y: number }[][] = [];
  let run: { x: number; y: number }[] = [];
  for (const c of coords) {
    if (c.y == null) {
      if (run.length) runs.push(run);
      run = [];
    } else {
      run.push({ x: c.x, y: c.y });
    }
  }
  if (run.length) runs.push(run);

  return (
    <div className="mt-3">
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="none"
        className="w-full h-[clamp(56px,8vw,88px)] block"
        role="img"
        aria-label="Hourly average detection confidence"
      >
        {/* faint 50% baseline for reference */}
        <line
          x1={PAD}
          x2={VW - PAD}
          y1={PAD + 0.5 * IH}
          y2={PAD + 0.5 * IH}
          stroke="var(--dn-text-15)"
          strokeWidth={0.5}
          vectorEffect="non-scaling-stroke"
        />
        {runs.map((r, idx) =>
          r.length >= 2 ? (
            <polyline
              key={`line-${idx}`}
              points={r.map((pt) => `${pt.x},${pt.y}`).join(" ")}
              fill="none"
              stroke="var(--dn-creek-mid)"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : (
            // A lone non-null point between gaps: a small dot so it stays visible.
            <circle
              key={`dot-${idx}`}
              cx={r[0].x}
              cy={r[0].y}
              r={1.2}
              fill="var(--dn-creek-mid)"
              vectorEffect="non-scaling-stroke"
            />
          ),
        )}
        {/* Transparent per-hour hover bands carry the native <title> tooltip. */}
        {coords.map((c, i) =>
          c.y == null ? null : (
            <rect
              key={`hit-${i}`}
              x={c.x - (n === 1 ? IW / 2 : IW / (n - 1) / 2)}
              y={PAD}
              width={n === 1 ? IW : IW / (n - 1)}
              height={IH}
              fill="transparent"
            >
              <title>{tooltip(c.p)}</title>
            </rect>
          ),
        )}
      </svg>
    </div>
  );
}

function tooltip(p: ConfidenceTrendPoint): string {
  const parts = [formatAbsolute(p.bucket_start), `avg ${pct(p.avg_confidence)}`];
  if (p.low_confidence_ratio != null) {
    parts.push(`low-conf ${pct(p.low_confidence_ratio)}`);
  }
  parts.push(`${p.confidence_sample_count.toLocaleString()} samples`);
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// Stats + card chrome.
// ---------------------------------------------------------------------------

function StatRow({ trend }: { trend: ConfidenceTrendResponse }) {
  const s = trend.summary;
  return (
    <div className="mt-4 grid grid-cols-3 gap-x-6 gap-y-2">
      <Stat label="Latest avg" value={pct(s.latest_avg_confidence)} />
      <Stat label="Lowest hourly" value={pct(s.lowest_avg_confidence)} />
      <Stat
        label="Total samples"
        value={s.total_confidence_samples.toLocaleString()}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        {label}
      </p>
      <p className="mt-1 text-[clamp(0.9rem,1.05vw,1rem)] text-white">{value}</p>
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
    <div
      role="group"
      aria-label="Confidence trend range"
      className="inline-flex gap-1"
    >
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

function Card({
  range,
  onRangeChange,
  children,
}: {
  range: ConfidenceTrendRange;
  onRangeChange: (r: ConfidenceTrendRange) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          detection confidence trend
        </p>
        <RangeToggle range={range} onRangeChange={onRangeChange} />
      </div>
      <p className="mt-1 text-[11px] text-[var(--dn-text-50)]">
        Hourly confidence history from recent processor output.
      </p>
      {children}
    </section>
  );
}
