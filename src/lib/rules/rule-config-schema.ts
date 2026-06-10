// Rules/Triggers M1 — pure, theme-agnostic rule helpers shared by the rule
// editor (client) and its Server Action (server-side defense in depth).
//
// Mirrors ../upstream-api-server/src/upstream_api/schemas/rules.py
// (validate_rule_config). Keep the two in lock-step: anything this validator
// lets through that the server rejects round-trips as a 422 toast instead of
// an inline authoring error.

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
 * "any line", "ROI roi-2 · ≥ 3 objects", "zone lobby · > 90s".
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
    parts.push(`≥ ${min} object${min === 1 ? "" : "s"}`);
  }
  if (
    rule.rule_type === "dwell_exceeded" &&
    typeof cfg.min_duration_seconds === "number"
  ) {
    parts.push(`> ${cfg.min_duration_seconds}s`);
  }
  return parts.join(" · ");
}

export interface RuleConfigValidationIssue {
  field: string;
  message: string;
}

const ALLOWED_CONFIG_KEYS: Record<RuleType, ReadonlySet<string>> = {
  line_crossing: new Set(["line_id"]),
  roi_occupancy: new Set(["roi_id", "min_total_count"]),
  zone_entered: new Set(["zone_id"]),
  dwell_exceeded: new Set(["zone_id", "min_duration_seconds"]),
};

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
  if ("min_total_count" in config) {
    const value = config.min_total_count;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
      issues.push({
        field: "min_total_count",
        message: "min_total_count must be an integer of at least 1.",
      });
    }
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
  return issues;
}
