"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { formatAbsolute } from "@/lib/time";
import {
  configGroupKey,
  formatConfigGroupLabel,
  formatConfigGroupStatus,
  hasAnalyticsCountsCaveat,
  hasOutputCadenceCaveat,
  isNoMetadataGroup,
} from "@/lib/perception/config-group-label";
import type {
  ConfidenceTrendByConfigResponse,
  ConfidenceTrendConfigGroup,
  ConfidenceTrendPoint,
  ConfidenceTrendRange,
} from "@/lib/api/types";

// Model-config M10 — "Reliability by Config" section on the camera Reliability
// tab. Renders the M9 by-config confidence history as one card per applied
// processing-config group (label + status + caveat badges + mini sparkline +
// headline stats), so an operator can compare reliability across the configs a
// camera actually ran under. The EXISTING camera-level confidence trend card is
// untouched — this is an additive section, not a replacement.
//
// Same data posture as the trend card: both ranges are fetched server-side and
// passed as props; the 24h | 7d toggle just switches which one is shown. Both
// fetches are resilient (null on any error), so a missing/failed M9 endpoint
// degrades to an "unavailable" body without breaking the tab.
//
// Filters are CLIENT-SIDE over the already-returned groups (classes + status,
// options derived from the data — nothing hardcoded, no extra query params
// sent). Honesty: caveat badges + the standing note below never claim model
// switching, tracker changes, FPS, or class-filtered line/ROI counts are live.

const VW = 100;
const VH = 24;
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

const ALL = "__all__";

export function ReliabilityByConfigCard({
  byConfig24h,
  byConfig7d,
}: {
  byConfig24h: ConfidenceTrendByConfigResponse | null;
  byConfig7d: ConfidenceTrendByConfigResponse | null;
}) {
  const [range, setRange] = useState<ConfidenceTrendRange>("24h");
  const [classesFilter, setClassesFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const data = range === "24h" ? byConfig24h : byConfig7d;
  const groups = useMemo(() => data?.groups ?? [], [data]);

  // Filter options derived from the returned groups — never hardcoded class
  // names. Null dimensions (pre-M8 history) get explicit option labels.
  const classOptions = useMemo(
    () => distinct(groups.map((g) => g.applied_selected_classes_key ?? "∅")),
    [groups],
  );
  const statusOptions = useMemo(
    () => distinct(groups.map((g) => g.processing_config_status ?? "∅")),
    [groups],
  );

  const visible = groups.filter(
    (g) =>
      (classesFilter === ALL ||
        (g.applied_selected_classes_key ?? "∅") === classesFilter) &&
      (statusFilter === ALL || (g.processing_config_status ?? "∅") === statusFilter),
  );

  return (
    <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          reliability by config
        </p>
        <RangeToggle range={range} onRangeChange={setRange} />
      </div>
      <p className="mt-1 text-[11px] text-[var(--dn-text-50)]">
        Compare reliability metrics across applied camera configurations.
      </p>
      <p className="mt-1 text-[11px] text-[var(--dn-text-50)]">
        Selected class filters currently apply to per-object outputs. Line/ROI
        aggregate counts may still include all classes.
      </p>

      {data === null ? (
        <Body>
          Config-aware reliability is currently unavailable. The reliability
          summary and confidence trend above are unaffected.
        </Body>
      ) : groups.length === 0 ? (
        <Body>
          Config-aware reliability data will appear after the camera produces
          detections with applied processing config metadata.
        </Body>
      ) : (
        <>
          {groups.length > 1 ? (
            <FilterRow
              classOptions={classOptions}
              statusOptions={statusOptions}
              classesFilter={classesFilter}
              statusFilter={statusFilter}
              onClassesChange={setClassesFilter}
              onStatusChange={setStatusFilter}
            />
          ) : null}
          {visible.length === 0 ? (
            <Body>No config groups match the selected filters.</Body>
          ) : (
            <div className="mt-3 space-y-3">
              {visible.map((g) => (
                <ConfigGroupCard key={configGroupKey(g)} group={g} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function distinct(values: string[]): string[] {
  return [...new Set(values)];
}

// ---------------------------------------------------------------------------
// One config group: label, status, caveat badge, mini sparkline, stats.
// ---------------------------------------------------------------------------

function ConfigGroupCard({ group }: { group: ConfidenceTrendConfigGroup }) {
  const caveat = hasAnalyticsCountsCaveat(group);
  const cadenceCaveat = hasOutputCadenceCaveat(group);
  const s = group.summary;
  const latestLowRatio = latestRated(group.points)?.low_confidence_ratio ?? null;
  return (
    <div className="rounded-lg border border-black/10 bg-white/60 p-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-[clamp(0.85rem,1vw,0.95rem)] font-semibold text-black">
          {formatConfigGroupLabel(group)}
        </p>
        <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--dn-text-50)]">
          {formatConfigGroupStatus(group)}
        </span>
        {caveat ? (
          <span
            className={clsx(
              "inline-flex items-center rounded-full border px-2 py-0.5",
              "text-[11px] font-mono uppercase tracking-wider",
              "border-[#8a6d1f]/40 text-[#8a6d1f]",
            )}
            title="Selected class filters currently apply to supported per-object outputs; line/ROI aggregate counts are not class-filtered yet."
          >
            line/ROI counts still all-class
          </span>
        ) : null}
        {cadenceCaveat ? (
          <span
            className={clsx(
              "inline-flex items-center rounded-full border px-2 py-0.5",
              "text-[11px] font-mono uppercase tracking-wider",
              "border-black/10 text-[var(--dn-text-50)]",
            )}
            title="Processing FPS throttles the perception snapshot output cadence only — inference keeps running at the source rate (no GPU saving) and event observations are not throttled."
          >
            output cadence only
          </span>
        ) : null}
      </div>

      {s.total_confidence_samples === 0 ? (
        <p className="mt-2 text-[clamp(0.8rem,0.95vw,0.9rem)] text-[var(--dn-text-50)]">
          No samples for this config in the selected range.
        </p>
      ) : (
        <>
          <MiniSparkline
            points={group.points}
            label={`Hourly average confidence — ${formatConfigGroupLabel(group)}`}
          />
          <div className="mt-3 grid grid-cols-3 gap-x-6 gap-y-2">
            <Stat label="Latest avg" value={pct(s.latest_avg_confidence)} />
            <Stat label="Low-conf ratio" value={pct(latestLowRatio)} />
            <Stat
              label="Samples"
              value={s.total_confidence_samples.toLocaleString()}
            />
          </div>
        </>
      )}

      {isNoMetadataGroup(group) ? (
        <p className="mt-2 text-[11px] text-[var(--dn-text-50)]">
          History recorded before applied-config metadata existed for this
          camera.
        </p>
      ) : null}
    </div>
  );
}

function latestRated(points: ConfidenceTrendPoint[]): ConfidenceTrendPoint | null {
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].avg_confidence != null) return points[i];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Mini sparkline — same gap-aware runs approach as the trend card's chart,
// kept local so the existing card stays untouched.
// ---------------------------------------------------------------------------

function MiniSparkline({
  points,
  label,
}: {
  points: ConfidenceTrendPoint[];
  label: string;
}) {
  const n = points.length;
  if (n === 0) return null;
  const coords = points.map((p, i) => ({
    p,
    x: PAD + (n === 1 ? IW / 2 : (i / (n - 1)) * IW),
    y: p.avg_confidence == null ? null : PAD + (1 - clamp01(p.avg_confidence)) * IH,
  }));
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
    <div className="mt-2">
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="none"
        className="w-full h-[clamp(36px,5vw,56px)] block"
        role="img"
        aria-label={label}
      >
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
// Filters (client-side over returned groups) + chrome.
// ---------------------------------------------------------------------------

function FilterRow({
  classOptions,
  statusOptions,
  classesFilter,
  statusFilter,
  onClassesChange,
  onStatusChange,
}: {
  classOptions: string[];
  statusOptions: string[];
  classesFilter: string;
  statusFilter: string;
  onClassesChange: (v: string) => void;
  onStatusChange: (v: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-3">
      <FilterSelect
        label="Classes"
        value={classesFilter}
        options={classOptions}
        optionLabel={(v) =>
          v === "∅" ? "no metadata" : v === "all" ? "All classes" : v
        }
        onChange={onClassesChange}
      />
      <FilterSelect
        label="Status"
        value={statusFilter}
        options={statusOptions}
        optionLabel={(v) => (v === "∅" ? "no metadata" : v.replaceAll("_", " "))}
        onChange={onStatusChange}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  optionLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  optionLabel: (v: string) => string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-[var(--dn-text-50)]">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-black/10 bg-white px-2 py-1 text-[12px] normal-case tracking-normal text-black"
      >
        <option value={ALL}>All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {optionLabel(o)}
          </option>
        ))}
      </select>
    </label>
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
      aria-label="Reliability by config range"
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
                : "border-black/10 bg-white text-[var(--dn-text-50)] hover:text-black hover:bg-black/[0.04]",
            )}
          >
            {r}
          </button>
        );
      })}
    </div>
  );
}
