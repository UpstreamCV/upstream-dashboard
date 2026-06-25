import type {
  ReliabilitySource,
  SourceHealthStatus,
  SourceKind,
} from "@/lib/api/types";
import type { DotStatus } from "./status-dot";

// Shared collector source-health presentation helpers (M2b badges + M2c
// Configure modal). Centralized here so the Sources table and the modal agree on
// labels, colors, and duration formatting.

export const KIND_LABEL: Record<SourceKind, string> = {
  collector: "Collector",
  external_camera: "External source",
  observation_source: "Observation source",
  unknown: "Unknown",
};

// Health → StatusDot color, reusing the redesign's status-accent system:
// healthy green, delayed yellow, silent/offline red, unknown/disabled neutral.
export const HEALTH_DOT: Record<SourceHealthStatus, DotStatus> = {
  healthy: "green",
  delayed: "yellow",
  silent: "red",
  collector_offline: "red",
  unknown: "neutral",
  disabled: "neutral",
};

export const HEALTH_LABEL: Record<SourceHealthStatus, string> = {
  healthy: "Healthy",
  delayed: "Delayed",
  silent: "Silent",
  collector_offline: "Collector offline",
  unknown: "Unknown",
  disabled: "Disabled",
};

export const UNIT_SECONDS = { seconds: 1, minutes: 60, hours: 3600 } as const;
export type DurationUnit = keyof typeof UNIT_SECONDS;

// Largest clean unit: 3600 → "1h", 600 → "10m", 30 → "30s", 0 → "0s".
export function formatInterval(seconds: number): string {
  if (seconds >= 3600 && seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

// Split seconds into the largest clean unit + value, for the modal's inputs.
export function secondsToUnit(seconds: number): {
  value: number;
  unit: DurationUnit;
} {
  if (seconds >= 3600 && seconds % 3600 === 0) {
    return { value: seconds / 3600, unit: "hours" };
  }
  if (seconds >= 60 && seconds % 60 === 0) {
    return { value: seconds / 60, unit: "minutes" };
  }
  return { value: seconds, unit: "seconds" };
}

// Sources-table "Expected" cell: "Off" when monitoring is disabled, else
// "Every 10m · 5m grace" from the effective interval + grace.
export function formatExpected(source: ReliabilitySource): string {
  if (!source.liveness_enabled) return "Off";
  return `Every ${formatInterval(source.expected_interval_seconds)} · ${formatInterval(
    source.liveness_grace_seconds,
  )} grace`;
}

// Plain-language health explanation. Prefer the API's health_message (the sweep
// writes rich text for silent/offline/delayed); fall back to a simple derived
// line for states the backend leaves unmessaged (healthy/unknown/disabled).
export function healthExplanation(source: ReliabilitySource): string {
  if (source.health_message) return source.health_message;
  const s = source.health_status;
  if (s === "delayed") {
    return `Late — expected every ${formatInterval(source.expected_interval_seconds)}.`;
  }
  if (s === "silent") return "No observations received recently.";
  if (s === "collector_offline") return "No heartbeat received recently.";
  if (s === "disabled") return "Monitoring is turned off.";
  if (s === "healthy") return "Reporting on schedule.";
  return "No signal has been received yet."; // unknown / fallback
}
