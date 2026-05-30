import { formatAbsolute } from "@/lib/time";
import type {
  ConfidenceTrendPoint,
  ConfidenceTrendResponse,
} from "@/lib/api/types";

// Reliability M7 — "Detection confidence trend" card on the camera Reliability
// tab. Renders a 24h hourly average-confidence sparkline from the M6 rollups
// (served pre-aggregated across packages by the read API). Server Component, no
// chart library — a hand-rolled inline SVG keeps the dependency surface zero.
//
// States (in order): unavailable (fetch failed / null) → empty (no rollups) →
// warming up (fewer than two hourly confidence points, so no line yet) → chart.
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
  trend,
}: {
  trend: ConfidenceTrendResponse | null;
}) {
  if (trend === null) {
    return (
      <Card>
        <Body>
          Confidence trend is currently unavailable. Existing camera monitoring
          is unaffected.
        </Body>
      </Card>
    );
  }

  const points = trend.points;
  if (points.length === 0) {
    return (
      <Card range={trend.range}>
        <Body>
          No confidence history yet. A trend appears once this camera has been
          processing for at least an hour.
        </Body>
      </Card>
    );
  }

  const rated = points.filter((p) => p.avg_confidence != null);
  if (rated.length < 2) {
    return (
      <Card range={trend.range}>
        <Body>
          Collecting confidence history… a trend line appears after the second
          hourly data point.
        </Body>
        {rated.length === 1 ? (
          <StatRow trend={trend} />
        ) : null}
      </Card>
    );
  }

  return (
    <Card range={trend.range}>
      <Sparkline points={points} />
      <StatRow trend={trend} />
    </Card>
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
  const parts = [
    formatAbsolute(p.bucket_start),
    `avg ${pct(p.avg_confidence)}`,
  ];
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
      <p className="mt-1 text-[clamp(0.9rem,1.05vw,1rem)] text-black">{value}</p>
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

function Card({
  range,
  children,
}: {
  range?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          detection confidence trend
        </p>
        {range ? (
          <span className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
            last {range}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] text-[var(--dn-text-50)]">
        Hourly confidence history from recent processor output.
      </p>
      {children}
    </section>
  );
}
