import { describe, expect, it } from "vitest";

import {
  RULE_TYPES,
  isRuleType,
  ruleConditionsLabel,
  ruleScheduleLabel,
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
    // --- M3 -----------------------------------------------------------
    [
      "zone_entered",
      { object_classes: ["person", "forklift"], require_track_id: true },
    ],
    ["dwell_exceeded", { object_classes: ["person"], min_duration_seconds: 30 }],
    ["roi_occupancy", { min_total_count: 2, max_total_count: 10 }],
    ["roi_occupancy", { max_total_count: 1 }],
    [
      "line_crossing",
      {
        line_id: "line-1",
        schedule: {
          days: ["mon", "tue", "wed", "thu", "fri"],
          start_time: "08:00",
          end_time: "18:00",
          timezone: "America/New_York",
        },
      },
    ],
    // Overnight window + default days are both valid.
    [
      "zone_entered",
      { schedule: { start_time: "22:00", end_time: "06:00", timezone: "UTC" } },
    ],
    // --- payload-enrichment unlock ---------------------------------------
    ["zone_entered", { min_confidence: 0.7 }],
    ["zone_entered", { min_confidence: 1 }],
    ["dwell_exceeded", { min_confidence: 0.5, object_classes: ["person"] }],
    ["roi_occupancy", { object_class: "person", min_total_count: 3 }],
    ["roi_occupancy", { object_class: "person", max_total_count: 2 }],
    // --- per-object line crossing unlock ----------------------------------
    ["line_crossing", { object_classes: ["person"] }],
    ["line_crossing", { require_track_id: true }],
    ["line_crossing", { min_confidence: 0.7 }],
    [
      "line_crossing",
      { line_id: "line-1", object_classes: ["person"], min_confidence: 0.7 },
    ],
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
    // --- conditions rejected on types whose payloads can't prove them ---
    ["line_crossing", { direction: "a_to_b" }], // still deferred — no true a_to_b
    ["roi_occupancy", { object_classes: ["person"] }], // use object_class (single)
    ["roi_occupancy", { min_confidence: 0.7 }], // counts have no confidence
    // --- payload-enrichment unlock: value validation ----------------------
    ["zone_entered", { min_confidence: 0 }],
    ["zone_entered", { min_confidence: 1.5 }],
    ["zone_entered", { min_confidence: "0.7" }],
    ["roi_occupancy", { object_class: "" }],
    ["roi_occupancy", { object_class: 7 }],
    ["zone_entered", { object_class: "person" }], // roi-only key
    // --- M3: value validation -------------------------------------------
    ["zone_entered", { object_classes: [] }],
    ["zone_entered", { object_classes: ["person", "person"] }],
    ["zone_entered", { object_classes: ["person", ""] }],
    ["zone_entered", { object_classes: "person" }],
    ["zone_entered", { require_track_id: "yes" }],
    ["roi_occupancy", { max_total_count: 0 }],
    ["roi_occupancy", { min_total_count: 5, max_total_count: 2 }],
    // --- M3: schedule validation ------------------------------------------
    ["line_crossing", { schedule: "always" }],
    ["line_crossing", { schedule: { start_time: "08:00", end_time: "18:00" } }],
    [
      "line_crossing",
      { schedule: { start_time: "8am", end_time: "18:00", timezone: "UTC" } },
    ],
    [
      "line_crossing",
      { schedule: { start_time: "08:00", end_time: "24:00", timezone: "UTC" } },
    ],
    [
      "line_crossing",
      { schedule: { start_time: "08:00", end_time: "08:00", timezone: "UTC" } },
    ],
    [
      "line_crossing",
      {
        schedule: {
          start_time: "08:00",
          end_time: "18:00",
          timezone: "Mars/Olympus",
        },
      },
    ],
    [
      "line_crossing",
      {
        schedule: {
          days: ["monday"],
          start_time: "08:00",
          end_time: "18:00",
          timezone: "UTC",
        },
      },
    ],
    [
      "line_crossing",
      {
        schedule: {
          days: [],
          start_time: "08:00",
          end_time: "18:00",
          timezone: "UTC",
        },
      },
    ],
    [
      "line_crossing",
      {
        schedule: {
          start_time: "08:00",
          end_time: "18:00",
          timezone: "UTC",
          label: "work hours",
        },
      },
    ],
  ] as const)("rejects invalid %s config %j", (ruleType, config) => {
    expect(
      validateRuleConfig(ruleType, config as Record<string, unknown>).length,
    ).toBeGreaterThan(0);
  });
});

describe("ruleConditionsLabel", () => {
  it("returns null when no conditions are set", () => {
    expect(ruleConditionsLabel({ config: {} })).toBeNull();
  });

  it("lists classes and track requirement", () => {
    expect(
      ruleConditionsLabel({
        config: { object_classes: ["person", "forklift"], require_track_id: true },
      }),
    ).toBe("person, forklift · tracked only");
  });

  it("shows track requirement alone", () => {
    expect(ruleConditionsLabel({ config: { require_track_id: true } })).toBe(
      "tracked only",
    );
  });

  it("renders the confidence floor as a percentage", () => {
    expect(
      ruleConditionsLabel({
        config: { object_classes: ["person"], min_confidence: 0.7 },
      }),
    ).toBe("person · conf ≥ 70%");
  });
});

describe("ruleScheduleLabel", () => {
  it("returns null when no schedule is set", () => {
    expect(ruleScheduleLabel({ config: {} })).toBeNull();
  });

  it("collapses consecutive days to a range", () => {
    expect(
      ruleScheduleLabel({
        config: {
          schedule: {
            days: ["mon", "tue", "wed", "thu", "fri"],
            start_time: "08:00",
            end_time: "18:00",
            timezone: "America/New_York",
          },
        },
      }),
    ).toBe("Mon–Fri 08:00–18:00 America/New_York");
  });

  it("lists non-consecutive days individually", () => {
    expect(
      ruleScheduleLabel({
        config: {
          schedule: {
            days: ["mon", "fri"],
            start_time: "22:00",
            end_time: "06:00",
            timezone: "UTC",
          },
        },
      }),
    ).toBe("Mon, Fri 22:00–06:00 UTC");
  });

  it("labels a no-days schedule as every day", () => {
    expect(
      ruleScheduleLabel({
        config: {
          schedule: { start_time: "08:00", end_time: "18:00", timezone: "UTC" },
        },
      }),
    ).toBe("Every day 08:00–18:00 UTC");
  });

  it("degrades malformed schedules to a generic label, never throws", () => {
    expect(ruleScheduleLabel({ config: { schedule: "always" } })).toBe(
      "scheduled",
    );
    expect(ruleScheduleLabel({ config: { schedule: { days: ["mon"] } } })).toBe(
      "scheduled",
    );
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

  it("scopes the occupancy bounds to a count class when set", () => {
    expect(
      ruleTargetLabel({
        rule_type: "roi_occupancy",
        config: { min_total_count: 2, max_total_count: 5, object_class: "person" },
      }),
    ).toBe("any zone · 2–5 person");
    expect(
      ruleTargetLabel({
        rule_type: "roi_occupancy",
        config: { min_total_count: 3, object_class: "car" },
      }),
    ).toBe("any zone · ≥ 3 car");
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
