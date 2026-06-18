import { describe, expect, test } from "vitest";
import type { EvidenceLifecycle } from "@/lib/api/types";
import {
  inferredExitsCopy,
  observationTotal,
  packageEventLabel,
  rangeLabel,
  shortObservationType,
  warningLabel,
} from "./processing-evidence-format";

const lifecycle = (n: number): EvidenceLifecycle => ({
  inferred_zone_exits: n,
  track_missing_timeout_exits: n,
});

describe("shortObservationType", () => {
  test("strips the processor. prefix and underscores", () => {
    expect(shortObservationType("processor.zone_exited")).toBe("zone exited");
    expect(shortObservationType("processor.line_crossing_object")).toBe(
      "line crossing object",
    );
  });
  test("leaves non-processor types alone (besides underscores)", () => {
    expect(shortObservationType("custom_type")).toBe("custom type");
  });
});

describe("rangeLabel", () => {
  test("maps the two ranges", () => {
    expect(rangeLabel("1h")).toBe("last hour");
    expect(rangeLabel("24h")).toBe("last 24 hours");
  });
});

describe("inferredExitsCopy", () => {
  test("null when there are no inferred exits", () => {
    expect(inferredExitsCopy(lifecycle(0), "24h")).toBeNull();
  });
  test("observational, plural, and range-aware", () => {
    const copy = inferredExitsCopy(lifecycle(2), "24h");
    expect(copy).toContain("2 zone exits were inferred");
    expect(copy).toContain("last 24 hours");
    expect(copy).toContain("evidence, not a recommendation");
  });
  test("singular phrasing for one exit", () => {
    expect(inferredExitsCopy(lifecycle(1), "1h")).toContain(
      "1 zone exit was inferred",
    );
  });
  test("never prescriptive", () => {
    const copy = inferredExitsCopy(lifecycle(3), "24h") ?? "";
    expect(copy).not.toMatch(/you should/i);
    expect(copy).not.toMatch(/we recommend/i);
  });
});

describe("packageEventLabel", () => {
  test("maps the package event types", () => {
    expect(packageEventLabel("camera.processing_package_requested")).toBe(
      "Requested",
    );
    expect(packageEventLabel("camera.processing_package_applied")).toBe("Applied");
  });
  test("passes unknown event types through", () => {
    expect(packageEventLabel("camera.something_else")).toBe(
      "camera.something_else",
    );
  });
});

describe("warningLabel", () => {
  test("maps known warning codes to human copy", () => {
    expect(warningLabel("tracking_metrics_are_session_level")).toMatch(
      /session-to-date/,
    );
    expect(warningLabel("dwell_closure_reason_not_persisted")).toMatch(/Dwell/);
  });
  test("falls back to the raw code", () => {
    expect(warningLabel("unknown_code")).toBe("unknown_code");
  });
});

describe("observationTotal", () => {
  test("sums counts", () => {
    expect(
      observationTotal([
        { type: "a", count: 3 },
        { type: "b", count: 4 },
      ]),
    ).toBe(7);
    expect(observationTotal([])).toBe(0);
  });
});
