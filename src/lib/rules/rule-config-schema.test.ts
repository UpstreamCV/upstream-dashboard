import { describe, expect, it } from "vitest";

import {
  RULE_TYPES,
  isRuleType,
  ruleTargetLabel,
  ruleTypeLabel,
  validateRuleConfig,
} from "./rule-config-schema";

// Mirrors upstream-api-server's validate_rule_config tests — keep the two
// validators in lock-step so authoring errors render inline instead of
// round-tripping as a 422.

describe("isRuleType / ruleTypeLabel", () => {
  it("accepts every supported type", () => {
    for (const t of RULE_TYPES) {
      expect(isRuleType(t)).toBe(true);
      expect(ruleTypeLabel(t)).not.toBe(t); // every type has a human label
    }
  });

  it("rejects unsupported types and echoes them through the label", () => {
    expect(isRuleType("camera_offline")).toBe(false);
    expect(ruleTypeLabel("camera_offline")).toBe("camera_offline");
  });
});

describe("validateRuleConfig", () => {
  it.each([
    ["line_crossing", {}],
    ["line_crossing", { line_id: "line-1" }],
    ["roi_occupancy", { roi_id: "roi-1", min_total_count: 3 }],
    ["zone_entered", { zone_id: "z-1" }],
    ["dwell_exceeded", { zone_id: "z-1", min_duration_seconds: 90 }],
    ["dwell_exceeded", { min_duration_seconds: 90.5 }],
  ] as const)("accepts valid %s config %j", (ruleType, config) => {
    expect(validateRuleConfig(ruleType, config)).toEqual([]);
  });

  it.each([
    ["line_crossing", { roi_id: "roi-1" }], // wrong key for type
    ["line_crossing", { line_id: "" }],
    ["line_crossing", { line_id: 7 }],
    ["roi_occupancy", { min_total_count: 0 }],
    ["roi_occupancy", { min_total_count: 1.5 }],
    ["roi_occupancy", { min_total_count: "3" }],
    ["dwell_exceeded", { min_duration_seconds: 0 }],
    ["dwell_exceeded", { min_duration_seconds: -5 }],
    ["nonsense_type", {}],
  ] as const)("rejects invalid %s config %j", (ruleType, config) => {
    expect(
      validateRuleConfig(ruleType, config as Record<string, unknown>).length,
    ).toBeGreaterThan(0);
  });
});

describe("ruleTargetLabel", () => {
  it("describes an unfiltered line rule", () => {
    expect(ruleTargetLabel({ rule_type: "line_crossing", config: {} })).toBe(
      "any line",
    );
  });

  it("describes a filtered line rule", () => {
    expect(
      ruleTargetLabel({
        rule_type: "line_crossing",
        config: { line_id: "line-1" },
      }),
    ).toBe("line line-1");
  });

  it("includes the occupancy threshold", () => {
    expect(
      ruleTargetLabel({
        rule_type: "roi_occupancy",
        config: { roi_id: "roi-2", min_total_count: 3 },
      }),
    ).toBe("zone roi-2 · ≥ 3 objects");
  });

  it("defaults the occupancy threshold to 1", () => {
    expect(
      ruleTargetLabel({ rule_type: "roi_occupancy", config: {} }),
    ).toBe("any zone · ≥ 1 object");
  });

  it("includes the dwell duration when set", () => {
    expect(
      ruleTargetLabel({
        rule_type: "dwell_exceeded",
        config: { zone_id: "lobby", min_duration_seconds: 90 },
      }),
    ).toBe("zone lobby · > 90s");
  });

  it("dashes out unknown rule types", () => {
    expect(ruleTargetLabel({ rule_type: "camera_offline", config: {} })).toBe(
      "—",
    );
  });
});
