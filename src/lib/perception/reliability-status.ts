import type {
  ReliabilitySeverity,
  ReliabilitySummary,
  ReliabilitySummaryStatus,
} from "@/lib/api/types";
import type { DotStatus } from "@/components/dashboard-next/status-dot";

// Single source of truth for how reliability status verdicts and finding
// severities map to dashboard colors + labels. Originally inlined in
// reliability-panel.tsx; lifted here so the Monitor card and the Reliability
// tab agree on every variant without one drifting away from the other.
//
// "unavailable" is the dashboard-only variant for the case where the api
// returned 404 (camera_not_found) -- the summary payload is null. We render
// it as muted/neutral so an outage doesn't crash the surrounding tab.

export type SummaryVariant = ReliabilitySummaryStatus | "unavailable";

export function variantOfSummary(
  summary: ReliabilitySummary | null,
): SummaryVariant {
  return summary === null ? "unavailable" : summary.status;
}

export const SUMMARY_DOT: Record<SummaryVariant, DotStatus> = {
  healthy: "green",
  info: "yellow",
  needs_review: "yellow",
  critical: "red",
  unknown: "neutral",
  unavailable: "neutral",
};

export const SUMMARY_TEXT: Record<SummaryVariant, string> = {
  healthy: "#3f7d4e",
  info: "#8a6d1f",
  needs_review: "#8a6d1f",
  critical: "#c0473b",
  unknown: "var(--dn-text-50)",
  unavailable: "var(--dn-text-50)",
};

export const SUMMARY_LABEL: Record<SummaryVariant, string> = {
  healthy: "Healthy",
  info: "Info",
  needs_review: "Needs review",
  critical: "Critical",
  unknown: "Unknown",
  unavailable: "Unavailable",
};

// Finding-severity palette (per-card badges + action-block colour). Distinct
// from the summary palette because findings are only severity-tagged, never
// "unknown" / "healthy".

export const SEVERITY_DOT: Record<ReliabilitySeverity, DotStatus> = {
  info: "yellow",
  warning: "yellow",
  critical: "red",
};

export const SEVERITY_TEXT: Record<ReliabilitySeverity, string> = {
  info: "#8a6d1f",
  warning: "#8a6d1f",
  critical: "#c0473b",
};

export const SEVERITY_LABEL: Record<ReliabilitySeverity, string> = {
  info: "Info",
  warning: "Warning",
  critical: "Critical",
};
