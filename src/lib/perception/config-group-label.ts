// Model-config M10 — readable labels for applied-processing-config groups
// returned by the M9 by-config reliability endpoint. Pure + theme-agnostic so
// tests (and any future segment) can use them without rendering.
//
// Honesty rules baked in here, not in the components:
// - "All classes" / "default confidence" describe what was APPLIED, never what
//   was requested.
// - `partially applied` / warning caveats are surfaced calmly, not hidden.
// - Nothing here claims model switching, tracker changes, processing FPS, or
//   class-filtered line/ROI counts are live — because they are not.

import type { ConfidenceTrendConfigGroup } from "@/lib/api/types";

/** The M7D caveat code: selected classes filter per-object outputs, but
 * line/ROI aggregate counts remain all-class. */
export const SELECTED_CLASSES_ANALYTICS_WARNING =
  "selected_classes_analytics_counts_not_filtered";

/** Whether a group carries the line/ROI all-class-counts caveat. */
export function hasAnalyticsCountsCaveat(
  group: Pick<ConfidenceTrendConfigGroup, "processing_config_warnings">,
): boolean {
  return (group.processing_config_warnings ?? []).includes(
    SELECTED_CLASSES_ANALYTICS_WARNING,
  );
}

/** True when every dimension is null — history recorded before the processor
 * stamped applied_processing_config (pre-M8). */
export function isNoMetadataGroup(
  group: Pick<
    ConfidenceTrendConfigGroup,
    | "processing_config_source"
    | "processing_config_revision"
    | "processing_config_status"
    | "applied_selected_classes_key"
    | "applied_confidence_threshold"
  >,
): boolean {
  return (
    group.processing_config_source == null &&
    group.processing_config_revision == null &&
    group.processing_config_status == null &&
    group.applied_selected_classes_key == null &&
    group.applied_confidence_threshold == null
  );
}

/**
 * Primary label: "<classes> · <confidence>".
 *
 * - classes key "all"      -> "All classes"
 * - classes key "person"   -> "person"
 * - classes key "unknown"  -> "unknown config" (the whole label; malformed
 *   metadata groups visibly rather than masquerading as a real config)
 * - null threshold         -> "default confidence"
 * - threshold 0.2          -> "confidence 0.20"
 * - all-null dimensions    -> "No config metadata" (pre-M8 history)
 */
export function formatConfigGroupLabel(group: ConfidenceTrendConfigGroup): string {
  if (isNoMetadataGroup(group)) return "No config metadata";
  if (group.applied_selected_classes_key === "unknown") return "unknown config";

  const classes =
    group.applied_selected_classes_key == null ||
    group.applied_selected_classes_key === "all"
      ? "All classes"
      : group.applied_selected_classes_key;
  const confidence =
    group.applied_confidence_threshold == null
      ? "default confidence"
      : `confidence ${group.applied_confidence_threshold.toFixed(2)}`;
  return `${classes} · ${confidence}`;
}

/**
 * Secondary label: status + revision, in calm plain language. Examples:
 * "applied · r4", "partially applied · r7", "default config". Unknown status
 * strings pass through with underscores humanised (open vocabulary).
 */
export function formatConfigGroupStatus(group: ConfidenceTrendConfigGroup): string {
  if (isNoMetadataGroup(group)) return "recorded before config metadata";
  const status = group.processing_config_status;
  const statusLabel =
    status == null
      ? "unknown status"
      : status === "applied_defaults"
        ? "default config"
        : status === "fallback_default_on_error"
          ? "fallback default"
          : status.replaceAll("_", " ");
  const revision =
    group.processing_config_revision == null
      ? null
      : `r${group.processing_config_revision}`;
  return revision ? `${statusLabel} · ${revision}` : statusLabel;
}

/** Stable React key for a group — the full dimension identity. */
export function configGroupKey(group: ConfidenceTrendConfigGroup): string {
  return [
    group.processing_config_source ?? "∅",
    group.processing_config_revision ?? "∅",
    group.processing_config_status ?? "∅",
    group.applied_model_key ?? "∅",
    group.applied_selected_classes_key ?? "∅",
    group.applied_confidence_threshold ?? "∅",
    (group.processing_config_warnings ?? []).join("|"),
  ].join("·");
}
