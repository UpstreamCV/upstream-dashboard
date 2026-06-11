import { describe, expect, it } from "vitest";

import {
  sequenceEventLabel,
  sequenceSummaryLabel,
  validateSequenceConfig,
} from "./sequence-config-schema";

// Mirrors upstream-api-server's validate_sequence_config tests — keep the
// two validators in lock-step.

const VALID = {
  start: {
    event_type: "processor.zone_entered",
    conditions: { zone_id: "zone-a", object_classes: ["person"] },
  },
  then: {
    within_seconds: 30,
    event_type: "processor.line_crossing_object",
    conditions: { line_id: "line-b" },
  },
  correlation: { same_track_id: true },
  on_timeout: { create_alert: true, alert_message: "Did not cross in time." },
};

describe("validateSequenceConfig", () => {
  it("accepts a valid sequence", () => {
    expect(validateSequenceConfig(VALID)).toEqual([]);
  });

  it.each([
    [{}], // start + then required
    [{ ...VALID, branching: [] }], // unknown top key
    [{ ...VALID, start: { event_type: "processor.mock_detection" } }],
    [{ ...VALID, start: { event_type: "processor.roi_occupancy" } }], // snapshot
    [{ ...VALID, then: { event_type: "processor.line_crossing_object" } }], // no within
    [
      {
        ...VALID,
        then: { within_seconds: 2, event_type: "processor.line_crossing_object" },
      },
    ],
    [
      {
        ...VALID,
        then: { within_seconds: 90000, event_type: "processor.line_crossing_object" },
      },
    ],
    // same_track over a track-less type.
    [{ ...VALID, then: { within_seconds: 30, event_type: "processor.line_crossing" } }],
    // Condition a type can't prove.
    [
      {
        ...VALID,
        correlation: {},
        then: {
          within_seconds: 30,
          event_type: "processor.line_crossing",
          conditions: { object_classes: ["person"] },
        },
      },
    ],
    [{ ...VALID, correlation: { same_track_id: "yes" } }],
    [{ ...VALID, on_timeout: { create_alert: "yes" } }],
    [{ ...VALID, on_timeout: { alert_message: "" } }],
    [{ ...VALID, on_timeout: { snooze: true } }],
    [
      {
        ...VALID,
        start: {
          event_type: "processor.zone_entered",
          conditions: { min_confidence: 1.5 },
        },
      },
    ],
  ])("rejects invalid config %#", (config) => {
    expect(
      validateSequenceConfig(config as Record<string, unknown>).length,
    ).toBeGreaterThan(0);
  });

  it("accepts same_track over two track-attributing types", () => {
    const config = {
      ...VALID,
      then: { within_seconds: 60, event_type: "processor.zone_exited" },
    };
    expect(validateSequenceConfig(config)).toEqual([]);
  });
});

describe("sequenceEventLabel", () => {
  it("labels supported types and echoes unknown ones", () => {
    expect(sequenceEventLabel("processor.zone_entered")).toBe("Zone entered");
    expect(sequenceEventLabel("processor.line_crossing_object")).toBe(
      "Line crossing (object)",
    );
    expect(sequenceEventLabel("processor.something_new")).toBe(
      "processor.something_new",
    );
  });
});

describe("sequenceSummaryLabel", () => {
  it("summarizes a full sequence", () => {
    expect(sequenceSummaryLabel({ config: VALID })).toBe(
      "Zone entered (zone-a) → Line crossing (object) (line-b) within 30s · same object",
    );
  });

  it("omits targets and correlation when absent", () => {
    expect(
      sequenceSummaryLabel({
        config: {
          start: { event_type: "processor.zone_entered" },
          then: { within_seconds: 120, event_type: "processor.zone_exited" },
        },
      }),
    ).toBe("Zone entered → Zone exited within 2m");
  });

  it("degrades malformed configs to a generic label", () => {
    expect(sequenceSummaryLabel({ config: {} })).toBe("sequence");
    expect(sequenceSummaryLabel({ config: { start: "x", then: 3 } })).toBe(
      "sequence",
    );
  });
});
