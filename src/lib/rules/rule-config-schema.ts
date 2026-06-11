// Workflow Engine M1/M3 — pure, theme-agnostic rule helpers shared by the rule
// editor (client) and its Server Action (server-side defense in depth).
//
// Mirrors ../upstream-api-server/src/upstream_api/schemas/rules.py
// (validate_rule_config). Keep the two in lock-step: anything this validator
// lets through that the server rejects round-trips as a 422 toast instead of
// an inline authoring error.
//
// M3 condition availability follows what production observation payloads can
// actually prove (audited in the processor):
// - object_classes / require_track_id: zone_entered + dwell_exceeded only
//   (zone/dwell events carry class_label + track_id; line crossings are
//   cumulative counters with no per-object attribution; ROI counts are
//   cross-class aggregates).
// - min/max_total_count: roi_occupancy.
// - min_confidence: zone_entered + dwell_exceeded — unlocked by the
//   processor's payload-enrichment side task (per-object detection
//   confidence stamped on zone/dwell events; omitted when the track wasn't
//   detected in the triggering frame).
// - object_class: roi_occupancy — the same side task populates class_counts
//   from object-attributed ROI membership; the count bounds then apply to
//   that class's count instead of the aggregate total.
// - schedule: every rule type — evaluated inline from the observation time.
// - direction (and any line_crossing conditions): still deferred — line
//   crossings remain cumulative counters with no per-object attribution.

import type { Rule, RuleSeverity, RuleType } from "@/lib/api/types";

export const RULE_TYPES: RuleType[] = [
  "line_crossing",
  "roi_occupancy",
  "zone_entered",
  "dwell_exceeded",
];

export const RULE_SEVERITIES: RuleSeverity[] = ["info", "warning", "critical"];

export const DEFAULT_COOLDOWN_SECONDS = 300;
export const MAX_COOLDOWN_SECONDS = 86_400;
export const MAX_OBJECT_CLASSES = 20;

export const SCHEDULE_DAYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;
export type ScheduleDay = (typeof SCHEDULE_DAYS)[number];

const SCHEDULE_DAY_LABELS: Record<ScheduleDay, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export interface RuleSchedule {
  days?: ScheduleDay[];
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"; > start wraps midnight
  timezone: string; // IANA
}

/** Which geometry shape kind a rule type targets, for the editor's picker. */
export const RULE_TYPE_TARGET: Record<RuleType, "line" | "roi"> = {
  line_crossing: "line",
  roi_occupancy: "roi",
  zone_entered: "roi",
  dwell_exceeded: "roi",
};

/** The config key carrying the optional shape filter, per rule type. */
export const RULE_TYPE_TARGET_KEY: Record<RuleType, string> = {
  line_crossing: "line_id",
  roi_occupancy: "roi_id",
  zone_entered: "zone_id",
  dwell_exceeded: "zone_id",
};

/** Rule types whose payloads can prove object class / track identity (M3). */
export const CLASS_FILTER_RULE_TYPES: ReadonlySet<RuleType> = new Set([
  "zone_entered",
  "dwell_exceeded",
]);

/**
 * Rule types whose payloads can prove per-object detection confidence
 * (payload-enrichment side task). Same set as the class filter today.
 */
export const CONFIDENCE_FILTER_RULE_TYPES: ReadonlySet<RuleType> = new Set([
  "zone_entered",
  "dwell_exceeded",
]);

const RULE_TYPE_LABELS: Record<RuleType, string> = {
  line_crossing: "Line crossing",
  roi_occupancy: "Objects in ROI",
  zone_entered: "Zone entered",
  dwell_exceeded: "Dwell time exceeded",
};

const RULE_TYPE_DESCRIPTIONS: Record<RuleType, string> = {
  line_crossing: "Fires when an object crosses a counting line.",
  roi_occupancy:
    "Fires when the object count inside an ROI reaches a threshold.",
  zone_entered: "Fires when a tracked object enters a zone (ROI).",
  dwell_exceeded:
    "Fires when a tracked object stays in a zone (ROI) past a duration.",
};

export function isRuleType(value: string): value is RuleType {
  return (RULE_TYPES as string[]).includes(value);
}

/** Human label for a rule type; unknown types echo through unchanged. */
export function ruleTypeLabel(ruleType: string): string {
  return isRuleType(ruleType) ? RULE_TYPE_LABELS[ruleType] : ruleType;
}

export function ruleTypeDescription(ruleType: RuleType): string {
  return RULE_TYPE_DESCRIPTIONS[ruleType];
}

/**
 * One-line "what does this rule watch" summary for list rows, e.g.
 * "any line", "ROI roi-2 · 2–5 objects", "zone lobby · > 90s".
 */
export function ruleTargetLabel(rule: Pick<Rule, "rule_type" | "config">): string {
  const cfg = rule.config;
  if (!isRuleType(rule.rule_type)) return "—";
  const targetKey = RULE_TYPE_TARGET_KEY[rule.rule_type];
  const target = typeof cfg[targetKey] === "string" ? (cfg[targetKey] as string) : null;
  const kind = RULE_TYPE_TARGET[rule.rule_type] === "line" ? "line" : "zone";
  const parts: string[] = [target ? `${kind} ${target}` : `any ${kind}`];
  if (rule.rule_type === "roi_occupancy") {
    const min = typeof cfg.min_total_count === "number" ? cfg.min_total_count : 1;
    const max = typeof cfg.max_total_count === "number" ? cfg.max_total_count : null;
    // object_class scopes the count bounds to one class's count.
    const noun =
      typeof cfg.object_class === "string" && cfg.object_class.trim() !== ""
        ? cfg.object_class
        : `object${min === 1 && max === null ? "" : "s"}`;
    if (max !== null) {
      parts.push(`${min}–${max} ${noun}`);
    } else {
      parts.push(`≥ ${min} ${noun}`);
    }
  }
  if (
    rule.rule_type === "dwell_exceeded" &&
    typeof cfg.min_duration_seconds === "number"
  ) {
    parts.push(`> ${cfg.min_duration_seconds}s`);
  }
  return parts.join(" · ");
}

/**
 * One-line summary of the M3 conditions on a rule ("person, forklift ·
 * tracked only"), or null when none are set.
 */
export function ruleConditionsLabel(
  rule: Pick<Rule, "config">,
): string | null {
  const cfg = rule.config;
  const parts: string[] = [];
  if (Array.isArray(cfg.object_classes) && cfg.object_classes.length > 0) {
    parts.push(cfg.object_classes.filter((c) => typeof c === "string").join(", "));
  }
  if (cfg.require_track_id === true) {
    parts.push("tracked only");
  }
  if (typeof cfg.min_confidence === "number") {
    parts.push(`conf ≥ ${Math.round(cfg.min_confidence * 100)}%`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * One-line summary of a rule's schedule window ("Mon–Fri 08:00–18:00
 * America/New_York"; consecutive days collapse to a range), or null when the
 * rule has no schedule. Malformed schedules render as "scheduled" rather
 * than throwing — the server is the validator of record.
 */
export function ruleScheduleLabel(rule: Pick<Rule, "config">): string | null {
  const schedule = rule.config.schedule;
  if (schedule === undefined || schedule === null) return null;
  if (typeof schedule !== "object" || Array.isArray(schedule)) return "scheduled";
  const s = schedule as Record<string, unknown>;
  if (typeof s.start_time !== "string" || typeof s.end_time !== "string") {
    return "scheduled";
  }
  const days = Array.isArray(s.days)
    ? (s.days.filter(
        (d): d is ScheduleDay =>
          typeof d === "string" && (SCHEDULE_DAYS as readonly string[]).includes(d),
      ) as ScheduleDay[])
    : null;
  let dayPart = "Every day";
  if (days && days.length > 0 && days.length < 7) {
    const indices = days
      .map((d) => SCHEDULE_DAYS.indexOf(d))
      .sort((a, b) => a - b);
    const consecutive =
      indices.length > 1 &&
      indices.every((v, i) => i === 0 || v === indices[i - 1] + 1);
    dayPart = consecutive
      ? `${SCHEDULE_DAY_LABELS[SCHEDULE_DAYS[indices[0]]]}–${SCHEDULE_DAY_LABELS[SCHEDULE_DAYS[indices[indices.length - 1]]]}`
      : indices.map((i) => SCHEDULE_DAY_LABELS[SCHEDULE_DAYS[i]]).join(", ");
  }
  const tz = typeof s.timezone === "string" ? ` ${s.timezone}` : "";
  return `${dayPart} ${s.start_time}–${s.end_time}${tz}`;
}

export interface RuleConfigValidationIssue {
  field: string;
  message: string;
}

const ALLOWED_CONFIG_KEYS: Record<RuleType, ReadonlySet<string>> = {
  line_crossing: new Set(["line_id", "schedule"]),
  roi_occupancy: new Set([
    "roi_id",
    "min_total_count",
    "max_total_count",
    "object_class",
    "schedule",
  ]),
  zone_entered: new Set([
    "zone_id",
    "object_classes",
    "require_track_id",
    "min_confidence",
    "schedule",
  ]),
  dwell_exceeded: new Set([
    "zone_id",
    "min_duration_seconds",
    "object_classes",
    "require_track_id",
    "min_confidence",
    "schedule",
  ]),
};

const ALLOWED_SCHEDULE_KEYS = new Set(["days", "start_time", "end_time", "timezone"]);
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function validateSchedule(
  schedule: unknown,
  issues: RuleConfigValidationIssue[],
): void {
  if (typeof schedule !== "object" || schedule === null || Array.isArray(schedule)) {
    issues.push({ field: "schedule", message: "schedule must be an object." });
    return;
  }
  const s = schedule as Record<string, unknown>;
  for (const key of Object.keys(s)) {
    if (!ALLOWED_SCHEDULE_KEYS.has(key)) {
      issues.push({ field: "schedule", message: `Unknown schedule key: ${key}` });
    }
  }
  for (const key of ["start_time", "end_time"] as const) {
    if (typeof s[key] !== "string" || !HHMM_RE.test(s[key] as string)) {
      issues.push({
        field: `schedule.${key}`,
        message: `schedule.${key} must be an "HH:MM" time.`,
      });
    }
  }
  if (
    typeof s.start_time === "string" &&
    typeof s.end_time === "string" &&
    s.start_time === s.end_time
  ) {
    issues.push({
      field: "schedule",
      message: "Schedule start and end times must differ.",
    });
  }
  if (typeof s.timezone !== "string" || s.timezone.trim() === "") {
    issues.push({
      field: "schedule.timezone",
      message: "schedule.timezone must be a non-empty IANA timezone.",
    });
  } else if (!isValidTimezone(s.timezone)) {
    issues.push({
      field: "schedule.timezone",
      message: `Unknown timezone: ${s.timezone}`,
    });
  }
  if ("days" in s) {
    const days = s.days;
    const valid =
      Array.isArray(days) &&
      days.length > 0 &&
      new Set(days).size === days.length &&
      days.every(
        (d) => typeof d === "string" && (SCHEDULE_DAYS as readonly string[]).includes(d),
      );
    if (!valid) {
      issues.push({
        field: "schedule.days",
        message: "schedule.days must be a non-empty list of unique day keys (mon–sun).",
      });
    }
  }
}

/**
 * Pure per-type config validation, mirroring the server's
 * validate_rule_config. Empty array = valid.
 */
export function validateRuleConfig(
  ruleType: string,
  config: Record<string, unknown>,
): RuleConfigValidationIssue[] {
  if (!isRuleType(ruleType)) {
    return [{ field: "rule_type", message: `Unsupported rule type: ${ruleType}` }];
  }
  const issues: RuleConfigValidationIssue[] = [];
  const allowed = ALLOWED_CONFIG_KEYS[ruleType];
  for (const key of Object.keys(config)) {
    if (!allowed.has(key)) {
      issues.push({
        field: key,
        message: `Unknown config key for ${ruleType}: ${key}`,
      });
    }
  }
  for (const key of ["line_id", "roi_id", "zone_id"]) {
    if (key in config) {
      const value = config[key];
      if (typeof value !== "string" || value.trim() === "") {
        issues.push({ field: key, message: `${key} must be a non-empty string.` });
      }
    }
  }
  for (const key of ["min_total_count", "max_total_count"] as const) {
    if (key in config) {
      const value = config[key];
      if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
        issues.push({
          field: key,
          message: `${key} must be an integer of at least 1.`,
        });
      }
    }
  }
  if (
    typeof config.min_total_count === "number" &&
    typeof config.max_total_count === "number" &&
    config.max_total_count < config.min_total_count
  ) {
    issues.push({
      field: "max_total_count",
      message: "max_total_count must be at least min_total_count.",
    });
  }
  if ("min_duration_seconds" in config) {
    const value = config.min_duration_seconds;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      issues.push({
        field: "min_duration_seconds",
        message: "min_duration_seconds must be a number greater than 0.",
      });
    }
  }
  if ("object_classes" in config) {
    const classes = config.object_classes;
    const valid =
      Array.isArray(classes) &&
      classes.length > 0 &&
      classes.length <= MAX_OBJECT_CLASSES &&
      new Set(classes).size === classes.length &&
      classes.every((c) => typeof c === "string" && c.trim() !== "");
    if (!valid) {
      issues.push({
        field: "object_classes",
        message: `object_classes must be 1–${MAX_OBJECT_CLASSES} unique non-empty class names.`,
      });
    }
  }
  if ("require_track_id" in config && typeof config.require_track_id !== "boolean") {
    issues.push({
      field: "require_track_id",
      message: "require_track_id must be a boolean.",
    });
  }
  if ("min_confidence" in config) {
    const value = config.min_confidence;
    if (typeof value !== "number" || !(value > 0 && value <= 1)) {
      issues.push({
        field: "min_confidence",
        message: "min_confidence must be a number between 0 (exclusive) and 1.",
      });
    }
  }
  if ("object_class" in config) {
    const value = config.object_class;
    if (typeof value !== "string" || value.trim() === "") {
      issues.push({
        field: "object_class",
        message: "object_class must be a non-empty class name.",
      });
    }
  }
  if ("schedule" in config) {
    validateSchedule(config.schedule, issues);
  }
  return issues;
}
