import { RelativeTime } from "@/components/data/relative-time";
import type { ReliabilityFinding } from "@/lib/api/types";

// Per-finding-type evidence formatter (M4 Reliability tab).
//
// Closed switch over finding_type. Each branch reads the known fields from
// the evidence dict with optional-field guards -- we never assume a key
// exists, because evidence is JSONB and rule code may evolve.
//
// Unknown shapes fall through to <GenericEvidence />, which filters out any
// key matching the "looks like an id / url / token / key / secret" patterns
// before rendering. The reliability rules don't stamp those today, but the
// filter is defense-in-depth so a future rule that accidentally includes a
// signed URL or storage key can't leak it to the operator UI.
//
// All values render as plain text (no Markdown, no HTML), so even if a rule
// somehow stamped untrusted content, there's no XSS surface.

function get<T>(
  evidence: Record<string, unknown>,
  key: string,
  guard: (v: unknown) => v is T,
): T | undefined {
  const v = evidence[key];
  return guard(v) ? v : undefined;
}

const isNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const isString = (v: unknown): v is string => typeof v === "string";
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

// M5: human labels for the unstable_detection_confidence trigger_reasons.
// Unknown reasons fall back to the raw key so a new rule signal still shows.
const TRIGGER_REASON_LABELS: Record<string, string> = {
  low_average_confidence: "low average",
  high_low_confidence_ratio: "many low-confidence",
  high_variance: "high variance",
  drop_vs_recent_baseline: "dropped vs recent baseline",
};

function formatTriggerReasons(reasons: string[] | undefined): string | null {
  if (reasons === undefined || reasons.length === 0) return null;
  return reasons.map((r) => TRIGGER_REASON_LABELS[r] ?? r).join(", ");
}

function humanAge(seconds: number | undefined): string | null {
  if (seconds === undefined) return null;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} d`;
}

function percent(ratio: number | undefined): string | null {
  if (ratio === undefined) return null;
  return `${Math.round(ratio * 100)}%`;
}

// Reusable two-column label/value row. Tight density so up to ~8 rows fit
// in a card without scrolling.
function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        {label}
      </span>
      <span className="text-right text-[clamp(0.82rem,0.95vw,0.9rem)] text-white">
        {value}
      </span>
    </div>
  );
}

function EvidenceCard({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 rounded-lg bg-[var(--dn-tile)] p-3">{children}</div>;
}

// ---------------------------------------------------------------------------
// Per-finding-type formatters.
// ---------------------------------------------------------------------------

function SceneTooDarkEvidence({ evidence }: { evidence: Record<string, unknown> }) {
  const mean = get(evidence, "brightness_mean", isNumber);
  const threshold = get(evidence, "brightness_threshold", isNumber);
  const w = get(evidence, "image_width", isNumber);
  const h = get(evidence, "image_height", isNumber);
  const captured = get(evidence, "captured_at", isString);
  const source = get(evidence, "source", isString);

  return (
    <EvidenceCard>
      <Row
        label="Brightness"
        value={mean !== undefined ? `${mean.toFixed(1)} / 255` : null}
      />
      <Row
        label="Threshold"
        value={threshold !== undefined ? threshold : null}
      />
      <Row
        label="Frame"
        value={w !== undefined && h !== undefined ? `${w}×${h}` : null}
      />
      <Row label="Captured" value={captured ? <RelativeTime value={captured} /> : null} />
      <Row label="Source" value={source ? formatSource(source) : null} />
    </EvidenceCard>
  );
}

function UnstableConfidenceEvidence({
  evidence,
}: {
  evidence: Record<string, unknown>;
}) {
  const samples = get(evidence, "confidence_sample_count", isNumber);
  const avg = get(evidence, "avg_confidence", isNumber);
  const median = get(evidence, "median_confidence", isNumber);
  const min = get(evidence, "min_confidence", isNumber);
  const max = get(evidence, "max_confidence", isNumber);
  const lowRatio = get(evidence, "low_confidence_ratio", isNumber);
  const stddev = get(evidence, "confidence_stddev", isNumber);
  const captured = get(evidence, "captured_at", isString);

  // M5 drift-vs-recent-baseline fields. Present only once the camera has
  // enough confidence history; absent for a young camera or first run.
  const currentAvg = get(evidence, "current_avg_confidence", isNumber);
  const previousAvg = get(evidence, "previous_avg_confidence", isNumber);
  const dropRatio = get(evidence, "drop_ratio", isNumber);
  const baselineWindow = get(evidence, "baseline_window_seconds", isNumber);
  const baselineSamples = get(
    evidence,
    "baseline_confidence_sample_count",
    isNumber,
  );
  const triggerReasons = get(evidence, "trigger_reasons", isStringArray);

  // Thresholds nest one level down. Tolerate either string-or-object shape.
  const thresholds = evidence["thresholds"];
  const lowThreshold =
    typeof thresholds === "object" &&
    thresholds !== null &&
    isNumber((thresholds as Record<string, unknown>)["low_confidence_threshold"])
      ? ((thresholds as Record<string, unknown>)[
          "low_confidence_threshold"
        ] as number)
      : undefined;

  return (
    <EvidenceCard>
      <Row label="Confidence samples" value={samples !== undefined ? samples : null} />
      <Row
        label="Average confidence"
        value={avg !== undefined ? avg.toFixed(2) : null}
      />
      <Row
        label="Median confidence"
        value={median !== undefined ? median.toFixed(2) : null}
      />
      <Row
        label="Min / Max"
        value={
          min !== undefined && max !== undefined
            ? `${min.toFixed(2)} – ${max.toFixed(2)}`
            : null
        }
      />
      <Row label="Low-confidence ratio" value={percent(lowRatio)} />
      <Row
        label="Confidence spread"
        value={stddev !== undefined ? stddev.toFixed(3) : null}
      />
      <Row
        label="Low-confidence threshold"
        value={lowThreshold !== undefined ? lowThreshold.toFixed(2) : null}
      />
      <Row
        label="Recent avg confidence"
        value={currentAvg !== undefined ? currentAvg.toFixed(2) : null}
      />
      <Row
        label="Previous avg confidence"
        value={previousAvg !== undefined ? previousAvg.toFixed(2) : null}
      />
      <Row label="Confidence drop" value={percent(dropRatio)} />
      <Row
        label="Baseline samples"
        value={baselineSamples !== undefined ? baselineSamples : null}
      />
      <Row label="Baseline window" value={humanAge(baselineWindow)} />
      <Row label="Why flagged" value={formatTriggerReasons(triggerReasons)} />
      <Row label="Captured" value={captured ? <RelativeTime value={captured} /> : null} />
    </EvidenceCard>
  );
}

function StreamSilentEvidence({
  evidence,
}: {
  evidence: Record<string, unknown>;
}) {
  const streamState = get(evidence, "stream_state", isString);
  const frameAge = humanAge(get(evidence, "latest_frame_age_seconds", isNumber));
  const obsAge = humanAge(get(evidence, "last_observation_age_seconds", isNumber));
  const statusAge = humanAge(get(evidence, "processor_status_age_seconds", isNumber));

  return (
    <EvidenceCard>
      <Row label="Stream state" value={streamState ?? null} />
      <Row label="Latest frame age" value={frameAge} />
      <Row label="Last processor status" value={statusAge ? `${statusAge} ago` : null} />
      <Row label="Last observation" value={obsAge ? `${obsAge} ago` : null} />
    </EvidenceCard>
  );
}

function FrameStaleEvidence({
  evidence,
}: {
  evidence: Record<string, unknown>;
}) {
  const age = get(evidence, "latest_frame_age_seconds", isNumber);
  const threshold = get(evidence, "threshold_seconds", isNumber);
  const streamState = get(evidence, "stream_state", isString);

  return (
    <EvidenceCard>
      <Row label="Latest frame age" value={age !== undefined ? `${age}s` : null} />
      <Row label="Threshold" value={threshold !== undefined ? `${threshold}s` : null} />
      <Row label="Stream state" value={streamState ?? null} />
    </EvidenceCard>
  );
}

function DefaultGeometryEvidence({
  evidence,
}: {
  evidence: Record<string, unknown>;
}) {
  const source = get(evidence, "applied_geometry_source", isString);
  const hasSaved = get(evidence, "has_saved_geometry", isBool);
  const errorCode = get(evidence, "error_code", isString);
  const errorReason = get(evidence, "error_reason", isString);
  const errorMessage = get(evidence, "error_message", isString);

  return (
    <EvidenceCard>
      <Row label="Applied geometry" value={source ? formatGeometrySource(source) : null} />
      <Row
        label="Operator-saved geometry"
        value={hasSaved === undefined ? null : hasSaved ? "Yes" : "No"}
      />
      <Row label="Error code" value={errorCode ?? null} />
      <Row label="Error reason" value={errorReason ?? null} />
      <Row label="Error message" value={errorMessage ?? null} />
    </EvidenceCard>
  );
}

// ---------------------------------------------------------------------------
// Generic fallback with secret-key filtering.
// ---------------------------------------------------------------------------

const SECRET_PATTERNS = [
  /url$/i,
  /token$/i,
  /secret$/i,
  /^bucket$/i,
  /storage_key/i,
  /service_role/i,
  /authorization/i,
  /password/i,
  /api_?key/i,
  /^streamid$/i,
];

function looksSensitive(key: string): boolean {
  return SECRET_PATTERNS.some((rx) => rx.test(key));
}

function GenericEvidence({ evidence }: { evidence: Record<string, unknown> }) {
  const entries = Object.entries(evidence).filter(([k, v]) => {
    if (looksSensitive(k)) return false;
    if (v === null || v === undefined) return false;
    return true;
  });
  if (entries.length === 0) {
    return (
      <EvidenceCard>
        <p className="text-[clamp(0.78rem,0.9vw,0.85rem)] text-[var(--dn-text-50)]">
          No additional evidence available.
        </p>
      </EvidenceCard>
    );
  }
  return (
    <EvidenceCard>
      {entries.map(([k, v]) => (
        <Row key={k} label={k.replace(/_/g, " ")} value={formatGenericValue(v)} />
      ))}
    </EvidenceCard>
  );
}

function formatGenericValue(value: unknown): React.ReactNode {
  if (typeof value === "object" && value !== null) {
    // Don't recurse arbitrarily deep; an object value is rendered as a
    // compact JSON-ish summary so the operator sees something rather than
    // [object Object].
    return JSON.stringify(value);
  }
  if (typeof value === "number") return Number.isInteger(value) ? value : value.toFixed(2);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatSource(source: string): string {
  if (source === "latest_frame_snapshot") return "Latest frame snapshot";
  if (source === "latest_perception_snapshot") return "Latest perception snapshot";
  return source;
}

function formatGeometrySource(source: string): string {
  if (source === "default") return "Default";
  if (source === "operator_saved") return "Operator-saved";
  if (source === "fallback_default_on_error") return "Fallback default";
  return source;
}

// ---------------------------------------------------------------------------
// Entry point.
// ---------------------------------------------------------------------------

export function ReliabilityEvidence({
  finding,
}: {
  finding: ReliabilityFinding;
}) {
  const evidence = (finding.evidence ?? {}) as Record<string, unknown>;

  switch (finding.finding_type) {
    case "scene_too_dark_for_reliable_detection":
      return <SceneTooDarkEvidence evidence={evidence} />;
    case "unstable_detection_confidence":
      return <UnstableConfidenceEvidence evidence={evidence} />;
    case "stream_valid_processor_silent":
      return <StreamSilentEvidence evidence={evidence} />;
    case "latest_frame_stale":
      return <FrameStaleEvidence evidence={evidence} />;
    case "processor_using_default_geometry":
      return <DefaultGeometryEvidence evidence={evidence} />;
    default:
      return <GenericEvidence evidence={evidence} />;
  }
}
