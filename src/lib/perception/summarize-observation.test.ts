import { describe, expect, test } from "vitest";
import type { ObservationRecord } from "@/lib/api/types";
import {
  buildRecentObservationsPath,
  summarizeObservation,
} from "@/lib/perception/summarize-observation";

function obs(type: string, payload: unknown): ObservationRecord {
  return {
    id: "obs-1",
    camera_id: "cam-1",
    stream_session_id: "sess-1",
    processor_id: "proc-1",
    package_id: "pkg-1",
    type,
    // Cast: the tests deliberately feed malformed payloads to prove the
    // helper never throws on bad shapes.
    payload: payload as Record<string, unknown>,
    observed_at: "2026-05-21T12:00:00Z",
    created_at: "2026-05-21T12:00:01Z",
  };
}

describe("summarizeObservation — happy paths (all 7 types)", () => {
  test("line_crossing", () => {
    const s = summarizeObservation(
      obs("processor.line_crossing", {
        line_label: "entry-line",
        cumulative_count: 2,
        count_delta: 1,
      }),
    );
    expect(s).toContain("entry-line");
    expect(s).toContain("total 2");
    expect(s).toContain("+1");
  });

  test("line_crossing_object", () => {
    const s = summarizeObservation(
      obs("processor.line_crossing_object", {
        line_label: "entry-line",
        class_label: "person",
        track_id: "7",
        event_mode: "object_crossing",
      }),
    );
    expect(s).toContain("entry-line");
    expect(s).toContain("person crossed");
    expect(s).toContain("track 7");
  });

  test("roi_occupancy", () => {
    const s = summarizeObservation(
      obs("processor.roi_occupancy", {
        roi_id: "entry-roi",
        total_count: 1,
        debug: { emit_reason: "change" },
      }),
    );
    expect(s).toContain("entry-roi");
    expect(s).toContain("1 present");
    expect(s).toContain("change");
  });

  test("zone_entered", () => {
    const s = summarizeObservation(
      obs("processor.zone_entered", { zone_id: "entry-roi", track_id: "0" }),
    );
    expect(s).toBe("track 0 entered entry-roi");
  });

  test("zone_exited", () => {
    const s = summarizeObservation(
      obs("processor.zone_exited", { zone_id: "entry-roi", track_id: "3" }),
    );
    expect(s).toBe("track 3 exited entry-roi");
  });

  test("dwell_started", () => {
    const s = summarizeObservation(
      obs("processor.dwell_started", {
        zone_id: "lobby",
        track_id: "7",
        dwell_session_id: "lobby:7:1",
      }),
    );
    expect(s).toBe("track 7 started dwell in lobby");
  });

  test("dwell_updated", () => {
    const s = summarizeObservation(
      obs("processor.dwell_updated", {
        zone_id: "lobby",
        track_id: "7",
        duration_seconds: 31.2,
      }),
    );
    expect(s).toContain("track 7 dwelling 31.2");
    expect(s).toContain("in lobby");
  });

  test("dwell_exceeded", () => {
    const s = summarizeObservation(
      obs("processor.dwell_exceeded", {
        zone_id: "lobby",
        track_id: "7",
        duration_seconds: 11.3,
        threshold_seconds: 10,
      }),
    );
    expect(s).toContain("exceeded 10s");
    expect(s).toContain("11.3");
    expect(s).toContain("lobby");
  });
});

describe("summarizeObservation — missing payload fields", () => {
  test.each([
    "processor.line_crossing",
    "processor.roi_occupancy",
    "processor.zone_entered",
    "processor.zone_exited",
    "processor.dwell_started",
    "processor.dwell_updated",
    "processor.dwell_exceeded",
  ])("%s with empty payload does not throw and returns a string", (type) => {
    let summary = "";
    expect(() => {
      summary = summarizeObservation(obs(type, {}));
    }).not.toThrow();
    expect(summary.length).toBeGreaterThan(0);
  });
});

describe("summarizeObservation — malformed payloads never throw", () => {
  test("wrong-typed numeric fields fall back to '?'", () => {
    const s = summarizeObservation(
      obs("processor.line_crossing", {
        line_id: "x",
        cumulative_count: "abc",
        count_delta: null,
      }),
    );
    expect(s).toContain("?");
  });

  test("debug is a string, not an object", () => {
    expect(() =>
      summarizeObservation(
        obs("processor.roi_occupancy", {
          roi_id: "r",
          total_count: 2,
          debug: "not-an-object",
        }),
      ),
    ).not.toThrow();
  });

  test("track_id is null", () => {
    const s = summarizeObservation(
      obs("processor.zone_entered", { zone_id: "z", track_id: null }),
    );
    expect(s).toBe("track ? entered z");
  });

  test("payload is not an object at all", () => {
    expect(() =>
      summarizeObservation(obs("processor.dwell_updated", "garbage")),
    ).not.toThrow();
  });
});

describe("summarizeObservation — unknown / empty types", () => {
  test("unknown type returns the type string", () => {
    expect(
      summarizeObservation(obs("processor.future_thing", {})),
    ).toBe("processor.future_thing");
  });

  test("empty type falls back to 'observation'", () => {
    expect(summarizeObservation(obs("", {}))).toBe("observation");
  });
});

describe("buildRecentObservationsPath", () => {
  test("default — limit only, no type param", () => {
    const p = buildRecentObservationsPath("cam-1", { limit: 25 });
    expect(p).toBe("/v1/cameras/cam-1/observations/recent?limit=25");
  });

  test("with a type filter", () => {
    const p = buildRecentObservationsPath("cam-1", {
      type: "processor.line_crossing",
      limit: 50,
    });
    expect(p).toContain("type=processor.line_crossing");
    expect(p).toContain("limit=50");
  });

  test("undefined type is omitted", () => {
    const p = buildRecentObservationsPath("cam-1", {
      type: undefined,
      limit: 100,
    });
    expect(p).not.toContain("type=");
    expect(p).toContain("limit=100");
  });
});
