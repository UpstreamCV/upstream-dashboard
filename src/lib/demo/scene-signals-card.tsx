"use client";

import {
  Activity,
  ArrowRightLeft,
  CheckCircle2,
  Cpu,
  Gauge,
  Radio,
  TriangleAlert,
} from "lucide-react";
import type { DemoScene } from "./scene";
import { counting, findingOpen, fixed } from "./scene";

// Demo-mode reliability dashboard for the Reliability tab: each detection signal
// (Exposure / Focus / Confidence) in its own tile with an animated sparkline,
// a target line + health-vs-target readout, window avg/range, and trend — plus a
// row of reliability/operational metric tiles. Keyed by scene so it re-draws on
// each step. The story the signals encode:
//   • problem/fixing — Exposure + Confidence fall below target, Focus holds.
//   • fixed — Confidence recovers though Exposure stays marginal (model, not light).

const W = 240;
const H = 60;
const PADX = 5;
const PADY = 7;
// Sparklines map THIS domain (not 0..1) to the tile height, so dips + recoveries
// use the space instead of hugging the middle.
const Y_MIN = 0.3;

type Metric = {
  key: string;
  label: string;
  color: string;
  note: string;
  target: number; // healthy floor (0..1)
  series: number[];
};

function metricsFor(scene: DemoScene): Metric[] {
  const data = findingOpen(scene)
    ? {
        exposure: [0.84, 0.83, 0.8, 0.74, 0.66, 0.58, 0.5, 0.45],
        focus: [0.9, 0.91, 0.89, 0.9, 0.88, 0.89, 0.88, 0.88],
        confidence: [0.82, 0.81, 0.79, 0.74, 0.66, 0.57, 0.5, 0.46],
      }
    : fixed(scene)
      ? {
          exposure: [0.84, 0.8, 0.72, 0.62, 0.54, 0.48, 0.49, 0.5],
          focus: [0.9, 0.9, 0.89, 0.9, 0.88, 0.89, 0.9, 0.89],
          confidence: [0.82, 0.78, 0.7, 0.58, 0.5, 0.62, 0.78, 0.86],
        }
      : {
          exposure: [0.84, 0.85, 0.83, 0.86, 0.84, 0.85, 0.84, 0.85],
          focus: [0.9, 0.91, 0.89, 0.9, 0.92, 0.9, 0.91, 0.9],
          confidence: [0.82, 0.83, 0.81, 0.82, 0.84, 0.82, 0.83, 0.82],
        };
  return [
    { key: "exposure", label: "Exposure", color: "#cf9233", note: "ambient light", target: 0.6, series: data.exposure },
    { key: "focus", label: "Focus", color: "#3f8fb0", note: "lens sharpness", target: 0.7, series: data.focus },
    { key: "confidence", label: "Confidence", color: "#3f9d5a", note: "detection score", target: 0.7, series: data.confidence },
  ];
}

// Catmull-Rom → cubic bezier for a smooth (not jagged) sparkline.
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  const f = (n: number) => n.toFixed(2);
  let d = `M ${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${f(c1x)} ${f(c1y)}, ${f(c2x)} ${f(c2y)}, ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
}

type InfoTileData = {
  key: string;
  label: string;
  value: string;
  sub: string;
  color: string;
  icon: typeof Activity;
};

function infoFor(scene: DemoScene): InfoTileData[] {
  const issues = findingOpen(scene) ? 1 : 0;
  const lowConf = findingOpen(scene) ? 41 : fixed(scene) ? 9 : 6;
  const crossings = counting(scene) ? (fixed(scene) ? 4 : 3) : 0;
  const highRecall = fixed(scene);
  return [
    {
      key: "issues",
      label: "Open issues",
      value: String(issues),
      sub: issues ? "Needs review" : "All clear",
      color: issues ? "#c0473b" : "#3f7d4e",
      icon: issues ? TriangleAlert : CheckCircle2,
    },
    {
      key: "lowconf",
      label: "Low-confidence",
      value: `${lowConf}%`,
      sub: "of detections",
      color: lowConf >= 20 ? "#c0473b" : "#3f7d4e",
      icon: Activity,
    },
    {
      key: "model",
      label: "Active model",
      value: highRecall ? "High-recall v2" : "Baseline v1",
      sub: "detection package",
      color: highRecall ? "#3f7d4e" : "#000",
      icon: Cpu,
    },
    {
      key: "crossings",
      label: "Crossings today",
      value: String(crossings),
      sub: "inbound · Dock Door",
      color: "#000",
      icon: ArrowRightLeft,
    },
    {
      key: "fps",
      label: "Processor",
      value: "6 fps",
      sub: "6 in · 6 out",
      color: "#3f7d4e",
      icon: Gauge,
    },
    {
      key: "stream",
      label: "Stream",
      value: "2h 14m",
      sub: "h264 · 720p · live",
      color: "#000",
      icon: Radio,
    },
  ];
}

export function SceneSignalsCard({ scene }: { scene: DemoScene }) {
  const metrics = metricsFor(scene);
  const info = infoFor(scene);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {metrics.map((m, i) => (
          <SignalTile key={m.key} metric={m} scene={scene} index={i} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {info.map((t) => (
          <InfoTile key={t.key} data={t} scene={scene} />
        ))}
      </div>
      <style>{`
        @keyframes sigDraw { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }
        @keyframes sigArea { from { opacity: 0 } to { opacity: 1 } }
        @keyframes sigDot  { from { opacity: 0; transform: scale(0) } to { opacity: 1; transform: scale(1) } }
        @keyframes sigRise { from { opacity: 0; transform: translateY(5px) } to { opacity: 1; transform: translateY(0) } }
        @media (prefers-reduced-motion: reduce) { [data-signal] *, [data-info] * { animation: none !important; } }
      `}</style>
    </div>
  );
}

function SignalTile({
  metric,
  scene,
  index,
}: {
  metric: Metric;
  scene: DemoScene;
  index: number;
}) {
  const s = metric.series;
  const n = s.length;
  const innerH = H - 2 * PADY;
  const yFor = (v: number) =>
    H - PADY - ((Math.min(1, Math.max(Y_MIN, v)) - Y_MIN) / (1 - Y_MIN)) * innerH;
  const pts = s.map((v, i) => ({
    x: PADX + (i / (n - 1)) * (W - 2 * PADX),
    y: yFor(v),
  }));
  const line = smoothPath(pts);
  const last = pts[n - 1];
  const area = `${line} L ${last.x.toFixed(2)} ${H} L ${pts[0].x.toFixed(2)} ${H} Z`;
  const gridYs = [0.33, 0.66].map((t) => H - PADY - t * innerH);

  const cur = s[n - 1];
  const current = Math.round(cur * 100);
  const avg = Math.round((s.reduce((a, b) => a + b, 0) / n) * 100);
  const lo = Math.round(Math.min(...s) * 100);
  const hi = Math.round(Math.max(...s) * 100);
  const delta = Math.round((cur - s[0]) * 100);
  const targetPct = Math.round(metric.target * 100);
  const gap = Math.round((metric.target - cur) * 100); // >0 when below target
  const onTarget = cur >= metric.target;
  const status = onTarget ? "#3f7d4e" : gap >= 18 ? "#c0473b" : "#cf9233";
  const targetY = yFor(metric.target);
  const gid = `sig-grad-${metric.key}`;
  const delay = index * 130;
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "•";

  return (
    <div data-signal className="dn-tile p-[clamp(1rem,1.5vw,1.3rem)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: status }} aria-hidden />
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
              {metric.label}
            </span>
          </span>
          <span className="mt-0.5 block text-[11px] text-[var(--dn-text-50)]">{metric.note}</span>
        </div>
        <span
          key={`v-${scene}`}
          className="font-bold leading-none text-[clamp(1.3rem,1.9vw,1.7rem)]"
          style={{ color: metric.color, animation: `sigRise 500ms ${delay}ms ease-out both` }}
        >
          {current}%
        </span>
      </div>

      <svg
        key={`s-${scene}`}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2.5 w-full"
        style={{ height: "clamp(64px, 8vw, 96px)", overflow: "visible" }}
        aria-hidden
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={metric.color} stopOpacity="0.34" />
            <stop offset="55%" stopColor={metric.color} stopOpacity="0.1" />
            <stop offset="100%" stopColor={metric.color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridYs.map((gy, gi) => (
          <line key={gi} x1="0" y1={gy} x2={W} y2={gy} stroke="var(--dn-text-50)" strokeOpacity="0.09" strokeWidth="1" />
        ))}
        {/* target line */}
        <line x1="0" y1={targetY} x2={W} y2={targetY} stroke="var(--dn-text-50)" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="3 3" />
        <path d={area} fill={`url(#${gid})`} style={{ animation: `sigArea 700ms ${delay}ms ease-out both` }} />
        {/* soft glow under the line */}
        <path d={line} fill="none" stroke={metric.color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" style={{ filter: "blur(3px)", opacity: 0.35, animation: `sigArea 800ms ${delay}ms ease-out both` }} />
        <path
          d={line}
          fill="none"
          stroke={metric.color}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          style={{ strokeDasharray: 1, animation: `sigDraw 950ms ${delay}ms ease-out both` }}
        />
        <circle cx={last.x} cy={last.y} r={6.5} fill={metric.color} opacity={0.16} style={{ transformBox: "fill-box", transformOrigin: "center", animation: `sigDot 450ms ${delay + 760}ms ease-out both` }} />
        <circle cx={last.x} cy={last.y} r={3.4} fill={metric.color} stroke="#fff" strokeWidth={1.6} style={{ transformBox: "fill-box", transformOrigin: "center", animation: `sigDot 450ms ${delay + 820}ms ease-out both` }} />
      </svg>

      <div
        className="mt-2.5 flex items-center justify-between gap-2 rounded-lg px-2 py-1"
        style={{ background: `${status}14` }}
      >
        <span className="inline-flex items-center gap-1.5 text-[12px] font-bold" style={{ color: status }}>
          <span>{onTarget ? "On target" : `${gap}% below target`}</span>
        </span>
        <span className="font-mono text-[11px] text-[var(--dn-text-50)]">target {targetPct}%</span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 font-mono text-[11px] text-[var(--dn-text-50)]">
        <span>avg {avg}% · {lo}–{hi}%</span>
        <span style={{ color: delta === 0 ? "var(--dn-text-50)" : delta > 0 ? "#3f9d5a" : "#c0473b" }}>
          {arrow} {delta > 0 ? "+" : ""}{delta}% / 8h
        </span>
      </div>
    </div>
  );
}

function InfoTile({ data, scene }: { data: InfoTileData; scene: DemoScene }) {
  const Icon = data.icon;
  return (
    <div data-info className="dn-tile flex flex-col p-[clamp(1rem,1.5vw,1.3rem)]">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
          {data.label}
        </span>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ background: `${data.color}1f` }}>
          <Icon className="h-3.5 w-3.5" style={{ color: data.color }} />
        </span>
      </div>
      <p
        key={`iv-${scene}`}
        className="mt-2 font-bold leading-tight text-[clamp(1.2rem,1.7vw,1.6rem)]"
        style={{ color: data.color, animation: "sigRise 450ms ease-out both" }}
      >
        {data.value}
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--dn-text-50)]">{data.sub}</p>
    </div>
  );
}
