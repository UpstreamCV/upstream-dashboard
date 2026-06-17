import { AlertCircle, CheckCircle2, type LucideIcon } from "lucide-react";

// Fleet Overview (Figma "Some Issues" / "All Good" — right middle card). A
// legend of three REAL current counts (Critical / Review / Healthy) above a
// "Fleet health over time" line chart.
//
// DATA NOTE: this chart is NOT wired to any data source — there is no
// fleet-health time-series endpoint. It renders purely FAKE sample data so the
// visualization can be seen, and is marked "Illustrative" in the corner. (The
// legend above still shows the real current counts.) When a real endpoint
// lands, feed fetched series into <FleetHealthChart> and drop the label.

const HOURS = 24; // 24h of hourly points (+ the current point)

// Deterministic fake series: a smooth wave around `base` (peak deviation `amp`),
// clamped ≥ 0. Pure + seedless (no Math.random / no Date) so SSR and client
// render identically — no hydration mismatch.
function fakeSeries(base: number, amp: number, phase: number): number[] {
  const n = HOURS + 1;
  return Array.from({ length: n }, (_, i) => {
    const wave =
      Math.sin(i * 0.55 + phase) * 0.6 + Math.sin(i * 0.23 + phase * 1.7) * 0.4;
    return Math.max(0, Math.round(base + wave * amp));
  });
}

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
  count: number;
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
        {count}{" "}
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
      <span className="pointer-events-none absolute right-3 top-2.5 z-10 text-[clamp(0.58rem,0.72vw,0.68rem)] font-bold uppercase tracking-wider text-[var(--dn-text-40)]">
        Illustrative
      </span>

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

export function FleetOverview({
  critical,
  review,
  healthy,
}: {
  critical: number;
  review: number;
  healthy: number;
}) {
  // FAKE illustrative data — deliberately NOT wired to the real counts, so the
  // chart always renders a populated visualization (see fakeSeries).
  const lines = [
    { color: "var(--dn-red)", points: fakeSeries(3, 2, 0.4) }, // critical ~1–5
    { color: "var(--dn-orange)", points: fakeSeries(7, 2.8, 2.1) }, // review ~4–10
    { color: "var(--dn-green)", points: fakeSeries(20, 4, 3.7) }, // healthy ~16–24
  ];

  return (
    <section className="dn-tile flex h-full flex-col gap-[clamp(1rem,1.8vw,1.6rem)] p-[clamp(1.25rem,2.2vw,2.25rem)] min-w-0">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-[clamp(1.05rem,1.5vw,1.45rem)] font-bold leading-tight">
          Fleet Overview
        </h2>
        <span className="font-bold text-[clamp(0.82rem,1vw,0.95rem)] text-[var(--dn-text-50)] shrink-0">
          Last 24 hours
        </span>
      </header>

      <div
        className="flex flex-wrap items-center justify-center gap-x-[clamp(1.25rem,3vw,2.75rem)] gap-y-2 rounded-full px-[clamp(0.9rem,1.4vw,1.25rem)] py-[clamp(0.55rem,0.9vw,0.8rem)]"
        style={{ background: "rgba(255,255,255,0.04)" }}
      >
        <LegendItem icon={AlertCircle} color="var(--dn-red)" count={critical} label="Critical" />
        <LegendItem icon={AlertCircle} color="var(--dn-orange)" count={review} label="Review" />
        <LegendItem icon={CheckCircle2} color="var(--dn-green)" count={healthy} label="Healthy" />
      </div>

      <FleetHealthChart lines={lines} />
    </section>
  );
}
