import type { ConfidenceTrendPoint } from "@/lib/api/types";

// Reliability M8-A — a plain-language interpretation of a camera's
// detection-confidence trend, derived entirely from the points the M7
// confidence-trend API already returns. This is a DASHBOARD-LEVEL summary only:
// it is NOT a persisted reliability finding and does not touch the M5 evaluator
// or M6 rollups. Pure + side-effect-free so it runs in the client card and is
// unit-testable in isolation.
//
// Deliberately conservative + confidence-only language: it never claims model
// accuracy changed, only that the *average reported confidence* looks lower /
// higher / steady across the selected range.

export type ConfidenceTrendStatus =
  | "warming"
  | "stable"
  | "improving"
  | "degrading";

export interface ConfidenceTrendVerdict {
  status: ConfidenceTrendStatus;
  /** Short pill label, e.g. "Degrading" / "Warming up". */
  label: string;
  /** One operator-friendly sentence. */
  blurb: string;
}

// Need at least this many confidence-bearing hours to split into two halves and
// compare them, and at least this many total confidence samples to trust the
// comparison at all. Below either, we say "Not enough history".
const MIN_VALID_POINTS = 4;
const MIN_TOTAL_SAMPLES = 20;
// Conservative change thresholds so the badge doesn't overreact to noise.
const DEGRADE_RATIO = -0.15;
const IMPROVE_RATIO = 0.15;

const WARMING: ConfidenceTrendVerdict = {
  status: "warming",
  label: "Warming up",
  blurb: "Keep processing this camera to build more confidence history.",
};
const STABLE: ConfidenceTrendVerdict = {
  status: "stable",
  label: "Stable",
  blurb: "Average confidence is roughly steady across this range.",
};
const IMPROVING: ConfidenceTrendVerdict = {
  status: "improving",
  label: "Improving",
  blurb: "Average confidence is higher in the most recent part of this range.",
};
const DEGRADING: ConfidenceTrendVerdict = {
  status: "degrading",
  label: "Degrading",
  blurb: "Average confidence is lower in the most recent part of this range.",
};

/** A point that actually carries a confidence value (narrowed for arithmetic). */
type RatedPoint = ConfidenceTrendPoint & { avg_confidence: number };

/** Weighted (by confidence_sample_count) average of a half, or null if no weight. */
function weightedAvg(points: RatedPoint[]): number | null {
  let num = 0;
  let den = 0;
  for (const p of points) {
    const w = p.confidence_sample_count;
    if (w <= 0) continue;
    num += p.avg_confidence * w;
    den += w;
  }
  return den === 0 ? null : num / den;
}

/**
 * Interpret a range's confidence points as Warming / Stable / Improving /
 * Degrading by comparing the weighted average of the first half vs the second
 * half of the confidence-bearing hours.
 */
export function interpretConfidenceTrend(
  points: ConfidenceTrendPoint[],
): ConfidenceTrendVerdict {
  const valid = points.filter(
    (p): p is RatedPoint => p.avg_confidence != null,
  );

  const totalSamples = valid.reduce(
    (a, p) => a + p.confidence_sample_count,
    0,
  );
  if (valid.length < MIN_VALID_POINTS || totalSamples < MIN_TOTAL_SAMPLES) {
    return WARMING;
  }

  // Split into first/second half by count; for an odd number of points the
  // middle hour is excluded from both halves so we compare the extremes.
  const half = Math.floor(valid.length / 2);
  const earlyAvg = weightedAvg(valid.slice(0, half));
  const lateAvg = weightedAvg(valid.slice(valid.length - half));

  if (earlyAvg == null || lateAvg == null || earlyAvg <= 0) {
    return WARMING;
  }

  const changeRatio = (lateAvg - earlyAvg) / earlyAvg;
  if (changeRatio <= DEGRADE_RATIO) return DEGRADING;
  if (changeRatio >= IMPROVE_RATIO) return IMPROVING;
  return STABLE;
}
