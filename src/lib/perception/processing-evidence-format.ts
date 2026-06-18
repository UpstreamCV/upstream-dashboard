// Pure formatting/copy helpers for the P5-J runtime evidence panel. No React,
// no I/O — importable from the client panel and node-environment vitest. All
// lifecycle copy is OBSERVATIONAL (evidence, never prescriptive) and lives here
// so the tone is reviewable in one place.

import type {
  EvidenceLifecycle,
  EvidenceObservationCount,
  ProcessingEvidenceRange,
} from "@/lib/api/types";

/** "processor.zone_exited" → "zone exited". */
export function shortObservationType(type: string): string {
  const base = type.startsWith("processor.")
    ? type.slice("processor.".length)
    : type;
  return base.replace(/_/g, " ");
}

export function rangeLabel(range: ProcessingEvidenceRange): string {
  return range === "1h" ? "last hour" : "last 24 hours";
}

export function observationTotal(counts: EvidenceObservationCount[]): number {
  return counts.reduce((sum, c) => sum + c.count, 0);
}

/**
 * Observational sentence for inferred zone exits, or null when there are none.
 * Deliberately descriptive — "this is evidence, not a recommendation".
 */
export function inferredExitsCopy(
  lifecycle: EvidenceLifecycle,
  range: ProcessingEvidenceRange,
): string | null {
  const n = lifecycle.inferred_zone_exits;
  if (n <= 0) return null;
  return `${n} zone exit${n === 1 ? " was" : "s were"} inferred after tracks disappeared for longer than the grace window in the ${rangeLabel(range)}. This is evidence, not a recommendation.`;
}

const EVENT_LABELS: Record<string, string> = {
  "camera.processing_package_requested": "Requested",
  "camera.processing_package_applied": "Applied",
};

export function packageEventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType;
}

const WARNING_LABELS: Record<string, string> = {
  dwell_closure_reason_not_persisted:
    "Dwell closures caused by inferred exits aren't tracked yet.",
  tracking_metrics_are_session_level:
    "Tracker counts are session-to-date, not limited to this window.",
  package_history_unavailable: "Package change history is unavailable.",
};

export function warningLabel(code: string): string {
  return WARNING_LABELS[code] ?? code;
}
