// Workflow Engine M5 — pure helpers for sequence workflow configs, shared
// by the sequence form (client) and its Server Action (defense in depth).
//
// Mirrors ../upstream-api-server/src/upstream_api/schemas/workflows.py
// (validate_sequence_config). Keep in lock-step: anything this lets
// through that the server rejects round-trips as a 422 toast instead of an
// inline authoring error.

import type { Workflow } from "@/lib/api/types";
import { formatDurationShort } from "@/lib/rules/rule-config-schema";

/** Discrete event types a sequence step may use (snapshots excluded). */
export const SEQUENCE_EVENT_TYPES = [
  "processor.zone_entered",
  "processor.zone_exited",
  "processor.line_crossing",
  "processor.line_crossing_object",
  "processor.dwell_started",
  "processor.dwell_exceeded",
] as const;
export type SequenceEventType = (typeof SEQUENCE_EVENT_TYPES)[number];

/** Event types whose payloads carry track_id (same-track correlation). */
export const TRACK_ATTRIBUTING_EVENT_TYPES: ReadonlySet<string> = new Set([
  "processor.zone_entered",
  "processor.zone_exited",
  "processor.line_crossing_object",
  "processor.dwell_started",
  "processor.dwell_exceeded",
]);

/** Geometry kind each step event targets, for the form's shape picker. */
export const STEP_TARGET_KIND: Record<SequenceEventType, "line" | "roi"> = {
  "processor.zone_entered": "roi",
  "processor.zone_exited": "roi",
  "processor.line_crossing": "line",
  "processor.line_crossing_object": "line",
  "processor.dwell_started": "roi",
  "processor.dwell_exceeded": "roi",
};

export const STEP_TARGET_KEY: Record<SequenceEventType, "zone_id" | "line_id"> = {
  "processor.zone_entered": "zone_id",
  "processor.zone_exited": "zone_id",
  "processor.line_crossing": "line_id",
  "processor.line_crossing_object": "line_id",
  "processor.dwell_started": "zone_id",
  "processor.dwell_exceeded": "zone_id",
};

const STEP_EVENT_LABELS: Record<SequenceEventType, string> = {
  "processor.zone_entered": "Zone entered",
  "processor.zone_exited": "Zone exited",
  "processor.line_crossing": "Line crossing (count)",
  "processor.line_crossing_object": "Line crossing (object)",
  "processor.dwell_started": "Dwell started",
  "processor.dwell_exceeded": "Dwell exceeded",
};

const STEP_CONDITION_KEYS: Record<SequenceEventType, ReadonlySet<string>> = {
  "processor.zone_entered": new Set([
    "zone_id",
    "object_classes",
    "min_confidence",
    "require_track_id",
  ]),
  "processor.zone_exited": new Set([
    "zone_id",
    "object_classes",
    "min_confidence",
    "require_track_id",
  ]),
  "processor.line_crossing": new Set(["line_id"]),
  "processor.line_crossing_object": new Set([
    "line_id",
    "object_classes",
    "min_confidence",
    "require_track_id",
  ]),
  "processor.dwell_started": new Set([
    "zone_id",
    "object_classes",
    "min_confidence",
    "require_track_id",
  ]),
  "processor.dwell_exceeded": new Set([
    "zone_id",
    "object_classes",
    "min_confidence",
    "require_track_id",
    "min_duration_seconds",
  ]),
};

export const MIN_WITHIN_SECONDS = 5;
export const MAX_WITHIN_SECONDS = 86_400;

export function isSequenceEventType(value: string): value is SequenceEventType {
  return (SEQUENCE_EVENT_TYPES as readonly string[]).includes(value);
}

export function sequenceEventLabel(eventType: string): string {
  return isSequenceEventType(eventType) ? STEP_EVENT_LABELS[eventType] : eventType;
}

export interface SequenceValidationIssue {
  field: string;
  message: string;
}

function validateStep(
  step: unknown,
  key: "start" | "then",
  issues: SequenceValidationIssue[],
): string | null {
  if (typeof step !== "object" || step === null || Array.isArray(step)) {
    issues.push({ field: key, message: `${key} must be an object.` });
    return null;
  }
  const s = step as Record<string, unknown>;
  const allowed = new Set(["event_type", "conditions", ...(key === "then" ? ["within_seconds"] : [])]);
  for (const k of Object.keys(s)) {
    if (!allowed.has(k)) {
      issues.push({ field: key, message: `Unknown ${key} key: ${k}` });
    }
  }
  const eventType = s.event_type;
  if (typeof eventType !== "string" || !isSequenceEventType(eventType)) {
    issues.push({
      field: `${key}.event_type`,
      message: `${key}.event_type must be a supported event type.`,
    });
    return null;
  }
  if (key === "then") {
    const within = s.within_seconds;
    if (
      typeof within !== "number" ||
      !Number.isInteger(within) ||
      within < MIN_WITHIN_SECONDS ||
      within > MAX_WITHIN_SECONDS
    ) {
      issues.push({
        field: "then.within_seconds",
        message: `within_seconds must be ${MIN_WITHIN_SECONDS}-${MAX_WITHIN_SECONDS}.`,
      });
    }
  }
  const conditions = s.conditions;
  if (conditions !== undefined) {
    if (typeof conditions !== "object" || conditions === null || Array.isArray(conditions)) {
      issues.push({ field: `${key}.conditions`, message: "conditions must be an object." });
    } else {
      const c = conditions as Record<string, unknown>;
      const allowedConditions = STEP_CONDITION_KEYS[eventType];
      for (const k of Object.keys(c)) {
        if (!allowedConditions.has(k)) {
          issues.push({
            field: `${key}.conditions`,
            message: `${eventType} cannot prove condition: ${k}`,
          });
        }
      }
      for (const idKey of ["zone_id", "line_id"]) {
        if (idKey in c && (typeof c[idKey] !== "string" || (c[idKey] as string).trim() === "")) {
          issues.push({ field: `${key}.conditions.${idKey}`, message: `${idKey} must be a non-empty string.` });
        }
      }
      if ("object_classes" in c) {
        const classes = c.object_classes;
        const valid =
          Array.isArray(classes) &&
          classes.length > 0 &&
          classes.length <= 20 &&
          new Set(classes).size === classes.length &&
          classes.every((x) => typeof x === "string" && x.trim() !== "");
        if (!valid) {
          issues.push({
            field: `${key}.conditions.object_classes`,
            message: "object_classes must be 1-20 unique non-empty class names.",
          });
        }
      }
      if ("min_confidence" in c) {
        const v = c.min_confidence;
        if (typeof v !== "number" || !(v > 0 && v <= 1)) {
          issues.push({
            field: `${key}.conditions.min_confidence`,
            message: "min_confidence must be in (0, 1].",
          });
        }
      }
      if ("require_track_id" in c && typeof c.require_track_id !== "boolean") {
        issues.push({
          field: `${key}.conditions.require_track_id`,
          message: "require_track_id must be a boolean.",
        });
      }
      if ("min_duration_seconds" in c) {
        const v = c.min_duration_seconds;
        if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
          issues.push({
            field: `${key}.conditions.min_duration_seconds`,
            message: "min_duration_seconds must be a number > 0.",
          });
        }
      }
    }
  }
  return eventType;
}

function validateOutcome(
  outcome: unknown,
  key: "on_success" | "on_timeout",
  issues: SequenceValidationIssue[],
): void {
  if (typeof outcome !== "object" || outcome === null || Array.isArray(outcome)) {
    issues.push({ field: key, message: `${key} must be an object.` });
    return;
  }
  const o = outcome as Record<string, unknown>;
  for (const k of Object.keys(o)) {
    if (k !== "create_alert" && k !== "alert_message") {
      issues.push({ field: key, message: `Unknown ${key} key: ${k}` });
    }
  }
  if ("create_alert" in o && typeof o.create_alert !== "boolean") {
    issues.push({ field: `${key}.create_alert`, message: "create_alert must be a boolean." });
  }
  if ("alert_message" in o) {
    const m = o.alert_message;
    if (typeof m !== "string" || m.trim() === "" || m.length > 200) {
      issues.push({
        field: `${key}.alert_message`,
        message: "alert_message must be a non-empty string (max 200 chars).",
      });
    }
  }
}

/** Mirrors the server's validate_sequence_config. Empty array = valid. */
export function validateSequenceConfig(
  config: Record<string, unknown>,
): SequenceValidationIssue[] {
  const issues: SequenceValidationIssue[] = [];
  const allowedTop = new Set([
    "start",
    "then",
    "correlation",
    "on_success",
    "on_timeout",
    "schedule",
  ]);
  for (const k of Object.keys(config)) {
    if (!allowedTop.has(k)) {
      issues.push({ field: k, message: `Unknown config key: ${k}` });
    }
  }
  if (!("start" in config)) issues.push({ field: "start", message: "start is required." });
  if (!("then" in config)) issues.push({ field: "then", message: "then is required." });
  const startType = "start" in config ? validateStep(config.start, "start", issues) : null;
  const thenType = "then" in config ? validateStep(config.then, "then", issues) : null;
  if ("correlation" in config) {
    const correlation = config.correlation;
    if (
      typeof correlation !== "object" ||
      correlation === null ||
      Array.isArray(correlation)
    ) {
      issues.push({ field: "correlation", message: "correlation must be an object." });
    } else {
      const c = correlation as Record<string, unknown>;
      for (const k of Object.keys(c)) {
        if (k !== "same_track_id") {
          issues.push({ field: "correlation", message: `Unknown correlation key: ${k}` });
        }
      }
      if ("same_track_id" in c && typeof c.same_track_id !== "boolean") {
        issues.push({
          field: "correlation.same_track_id",
          message: "same_track_id must be a boolean.",
        });
      }
      if (c.same_track_id === true) {
        for (const [label, t] of [
          ["start", startType],
          ["then", thenType],
        ] as const) {
          if (t !== null && !TRACK_ATTRIBUTING_EVENT_TYPES.has(t)) {
            issues.push({
              field: "correlation.same_track_id",
              message: `same_track_id requires a track-attributing ${label} event; ${t} carries no track_id.`,
            });
          }
        }
      }
    }
  }
  if ("on_success" in config) validateOutcome(config.on_success, "on_success", issues);
  if ("on_timeout" in config) validateOutcome(config.on_timeout, "on_timeout", issues);
  // Schedule shape is validated server-side (same helper as rules); the
  // form builds it from constrained inputs, so client-side we only check
  // it is an object.
  if (
    "schedule" in config &&
    (typeof config.schedule !== "object" ||
      config.schedule === null ||
      Array.isArray(config.schedule))
  ) {
    issues.push({ field: "schedule", message: "schedule must be an object." });
  }
  return issues;
}

/**
 * One-line summary of a sequence workflow for list rows, e.g.
 * "Zone entered (zone-a) → Line crossing (object) (line-b) within 30s · same object".
 * Malformed configs degrade to "sequence" — never throw.
 */
export function sequenceSummaryLabel(workflow: Pick<Workflow, "config">): string {
  const cfg = workflow.config;
  const start = cfg.start as Record<string, unknown> | undefined;
  const then = cfg.then as Record<string, unknown> | undefined;
  if (!start || !then) return "sequence";
  const startType = typeof start.event_type === "string" ? start.event_type : null;
  const thenType = typeof then.event_type === "string" ? then.event_type : null;
  if (startType === null || thenType === null) return "sequence";
  const target = (step: Record<string, unknown>, type: string): string => {
    const conditions = step.conditions as Record<string, unknown> | undefined;
    if (!conditions || !isSequenceEventType(type)) return "";
    const id = conditions[STEP_TARGET_KEY[type]];
    return typeof id === "string" ? ` (${id})` : "";
  };
  const within =
    typeof then.within_seconds === "number"
      ? ` within ${formatDurationShort(then.within_seconds)}`
      : "";
  const correlation = cfg.correlation as Record<string, unknown> | undefined;
  const sameTrack = correlation?.same_track_id === true ? " · same object" : "";
  return (
    `${sequenceEventLabel(startType)}${target(start, startType)} → ` +
    `${sequenceEventLabel(thenType)}${target(then, thenType)}${within}${sameTrack}`
  );
}
