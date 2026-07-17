import { AlertCircle, CheckCircle2, type LucideIcon } from "lucide-react";
import type { FleetTrendResponse } from "@/lib/api/types";

// Fleet Overview (Figma "Some Issues" / "All Good" — right middle card). A
// legend of three counts (Critical / Review / Healthy) above a "Fleet health
// over time" line chart.
//
// Both are fed by GET /v1/dashboard/fleet-trend, which buckets `heartbeats`
// hourly: each camera counted once per hour by its last heartbeat that hour, so
// critical/review/healthy partition the reporting cameras. The legend reads the
// trend's LATEST bucket rather than a separate current-state query, so it can
// never disagree with the right-hand end of the line above it.
//
// Until 2026-07-16 the three lines were a hard-coded sine wave (`fakeSeries`)
// with an "Illustrative" corner label — the one surface in this dashboard that
// fabricated telemetry rather than admitting it had none. If the endpoint is
// unreachable the tile now says so; it never invents a shape.
//
// SCOPE: the series covers cameras that HEARTBEAT. An idle or disconnected
// camera emits nothing and is in none of the three, which is why the header
// reports "n of m reporting" rather than implying the fleet total.

// Round a max value up to a clean axis ceiling.
function niceMax(v: number): number {
  if (v <= 5) return 5;
  if (v <= 10) return 10;
  const step = v <= 50 ? 5 : v <= 100 ? 10 : 25;
  return Math.ceil(v / step) * step;
}

// y-axis ticks — evenly spaced values from maxY down to 0 (top → bottom), used
// for both the labels and the gridlines. niceMax always returns a multiple of
// 5, so maxY/5 is a clean integer step → every label is a round number.
const Y_DIVISIONS = 5;
function yTicks(maxY: number): number[] {
  const step = maxY / Y_DIVISIONS;
  return Array.from({ length: Y_DIVISIONS + 1 }, (_, i) => maxY - i * step);
}

function LegendItem({
  icon: Icon,
  color,
  count,
  label,
}: {
  icon: LucideIcon;
  color: string;
  // null when the trend is unavailable — renders "—". A hard 0 would be a
  // fabricated count, and "0 Critical" is the most reassuring lie this tile
  // could tell: it reads as "nothing is wrong" when the truth is "we don't
  // know". The chart beside it says unavailable; the legend must agree.
  count: number | null;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 shrink-0">
      <span
        className="grid place-items-center rounded-full shrink-0"
        style={{
          width: "clamp(1.4rem,2vw,1.7rem)",
          height: "clamp(1.4rem,2vw,1.7rem)",
          // Badge filled with the status color (was a white circle) — a white
          // glyph reads on top.
          background: color,
        }}
        aria-hidden
      >
        <Icon
          className="h-[clamp(0.95rem,1.3vw,1.15rem)] w-[clamp(0.95rem,1.3vw,1.15rem)] text-white"
          strokeWidth={2.25}
        />
      </span>
      <span className="font-bold text-[clamp(0.82rem,1.05vw,1rem)] whitespace-nowrap">
        {count ?? "—"}{" "}
        <span className="text-[var(--dn-text-70)] font-bold">{label}</span>
      </span>
    </span>
  );
}

// Hand-rolled SVG line chart (no chart library — matches the
// reliability-confidence-trend-card sparkline). The viewBox is stretched to the
// plot box (preserveAspectRatio="none"); vector-effect="non-scaling-stroke"
// keeps line/grid widths constant despite the non-uniform scale.
function FleetHealthChart({
  lines,
}: {
  lines: { color: string; points: number[] }[];
}) {
  const n = lines[0]?.points.length ?? 0;
  const maxY = niceMax(Math.max(1, ...lines.flatMap((l) => l.points)));
  const ticks = yTicks(maxY);
  const VW = 100;
  const VH = 100;
  const PAD = 6;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * VW);
  const y = (v: number) => PAD + (1 - v / maxY) * (VH - PAD * 2);
  // Closed path for the fill: the line, then down to the baseline and back.
  const areaD = (pts: number[]) =>
    pts.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join("") +
    `L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`;

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col gap-2 p-[clamp(1rem,1.6vw,1.4rem)]"
      style={{
        background: "rgba(255,255,255,0.04)",
        borderRadius: "var(--dn-radius-inner)",
      }}
    >
      {/* No min-height: the plot purely flexes (flex-1, min-h-0) to fill
          whatever height the grid gives the tile, so Fleet Overview defers to
          the Triage tile's height instead of forcing the shared row taller. */}
      <div className="flex min-h-0 flex-1 gap-2">
        {/* y scale — evenly spaced ticks, each aligned to its gridline */}
        <div className="relative w-[clamp(1.25rem,2.4vw,2.25rem)] shrink-0 text-right text-[clamp(0.6rem,0.72vw,0.7rem)] font-bold text-[var(--dn-text-40)] tabular-nums">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 leading-none"
              style={{ top: `${y(t)}%` }}
            >
              {t}
            </span>
          ))}
        </div>

        {/* plot */}
        <div className="relative min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${VW} ${VH}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
            aria-hidden
          >
            <defs>
              {lines.map((l, idx) => (
                <linearGradient
                  key={idx}
                  id={`fleet-grad-${idx}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" style={{ stopColor: l.color, stopOpacity: 0.25 }} />
                  <stop offset="100%" style={{ stopColor: l.color, stopOpacity: 0 }} />
                </linearGradient>
              ))}
            </defs>

            {ticks.map((t) => (
              <line
                key={t}
                x1={0}
                x2={VW}
                y1={y(t)}
                y2={y(t)}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {/* Soft gradient fills under each line — largest (healthy) drawn at
                the back so the critical glow stays visible near the bottom. */}
            {[...lines.keys()].reverse().map((idx) => (
              <path
                key={`area-${idx}`}
                d={areaD(lines[idx].points)}
                fill={`url(#fleet-grad-${idx})`}
              />
            ))}

            {lines.map((l, idx) => (
              <polyline
                key={idx}
                points={l.points.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
                fill="none"
                stroke={l.color}
                strokeWidth={2.25}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        </div>
      </div>

      {/* x scale (time, oldest → now) */}
      <div className="flex justify-between text-[clamp(0.62rem,0.78vw,0.72rem)] font-bold text-[var(--dn-text-40)]">
        <span>24h ago</span>
        <span>18h</span>
        <span>12h</span>
        <span>6h</span>
        <span>Now</span>
      </div>
    </div>
  );
}

function ChartMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-0 flex-1 items-center justify-center p-[clamp(1rem,1.6vw,1.4rem)] text-center"
      style={{
        background: "rgba(255,255,255,0.04)",
        borderRadius: "var(--dn-radius-inner)",
      }}
    >
      <p className="text-[clamp(0.75rem,0.95vw,0.88rem)] text-[var(--dn-text-50)]">
        {children}
      </p>
    </div>
  );
}

export function FleetOverview({ trend }: { trend: FleetTrendResponse | null }) {
  const summary = trend?.summary ?? null;
  const points = trend?.points ?? [];

  const lines = [
    { color: "var(--dn-red)", points: points.map((p) => p.critical) },
    { color: "var(--dn-orange)", points: points.map((p) => p.review) },
    { color: "var(--dn-green)", points: points.map((p) => p.healthy) },
  ];

  // A camera that never heartbeats is in none of the three series, so state the
  // denominator rather than letting "1 Healthy" imply a one-camera fleet.
  const reporting = points.at(-1)?.reporting_cameras ?? 0;
  const coverage = summary
    ? `${reporting} of ${summary.total_cameras} reporting`
    : null;

  return (
    <section className="dn-tile flex h-full flex-col gap-[clamp(1rem,1.8vw,1.6rem)] p-[clamp(1.25rem,2.2vw,2.25rem)] min-w-0">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-[clamp(1.05rem,1.5vw,1.45rem)] font-bold leading-tight">
          Fleet Overview
        </h2>
        <span className="font-bold text-[clamp(0.82rem,1vw,0.95rem)] text-[var(--dn-text-50)] shrink-0">
          {coverage ? `Last 24 hours · ${coverage}` : "Last 24 hours"}
        </span>
      </header>

      <div
        className="flex flex-wrap items-center justify-center gap-x-[clamp(1.25rem,3vw,2.75rem)] gap-y-2 rounded-full px-[clamp(0.9rem,1.4vw,1.25rem)] py-[clamp(0.55rem,0.9vw,0.8rem)]"
        style={{ background: "rgba(255,255,255,0.04)" }}
      >
        <LegendItem
          icon={AlertCircle}
          color="var(--dn-red)"
          count={summary?.latest_critical ?? null}
          label="Critical"
        />
        <LegendItem
          icon={AlertCircle}
          color="var(--dn-orange)"
          count={summary?.latest_review ?? null}
          label="Review"
        />
        <LegendItem
          icon={CheckCircle2}
          color="var(--dn-green)"
          count={summary?.latest_healthy ?? null}
          label="Healthy"
        />
      </div>

      {!trend ? (
        <ChartMessage>Fleet health is unavailable right now.</ChartMessage>
      ) : points.length === 0 ? (
        <ChartMessage>
          No heartbeats in the last 24 hours — nothing to chart yet.
        </ChartMessage>
      ) : (
        <FleetHealthChart lines={lines} />
      )}
    </section>
  );
}
