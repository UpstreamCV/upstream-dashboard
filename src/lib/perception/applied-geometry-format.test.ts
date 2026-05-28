import { describe, expect, test } from "vitest";
import type { ProcessorStatusRecord } from "@/lib/api/types";
import {
  formatAppliedGeometryStatus,
  type AppliedGeometryDisplay,
} from "./applied-geometry-format";

// Factory for a baseline `ProcessorStatusRecord`. Each test overrides only
// the fields it cares about; the rest of the row stays constant so the
// helper's output reflects only the field under test.
function row(
  over: {
    error_code?: string | null;
    error_message?: string | null;
    applied_geometry?: Record<string, unknown> | null;
    extra_payload?: Record<string, unknown>;
  } = {},
): ProcessorStatusRecord {
  const payload: Record<string, unknown> = {};
  if (over.applied_geometry !== undefined) {
    if (over.applied_geometry !== null) {
      payload.applied_geometry = over.applied_geometry;
    }
  } else {
    payload.applied_geometry = {
      source: "operator_saved",
      revision: 9,
      line_count: 2,
      roi_count: 1,
    };
  }
  if (over.extra_payload) Object.assign(payload, over.extra_payload);
  return {
    id: "0".repeat(8) + "-" + "0".repeat(4) + "-" + "0".repeat(4) + "-" + "0".repeat(4) + "-" + "0".repeat(12),
    camera_id: "7b8313e5-155c-498f-9cc5-7af613d06074",
    stream_session_id: "5bc5dabe-37df-4ff2-961f-8268890bae01",
    processor_id: "proc-1",
    runtime: "deepstream",
    package_id: "deepstream.analytics_probe.v0",
    status: "processing",
    fps_input: 30,
    fps_processed: 29.8,
    last_frame_at: "2026-05-27T15:30:10Z",
    last_observation_at: "2026-05-27T15:30:11Z",
    error_code: over.error_code ?? null,
    error_message: over.error_message ?? null,
    payload: payload as ProcessorStatusRecord["payload"],
    created_at: "2026-05-27T15:24:59Z",
    updated_at: "2026-05-27T15:30:11Z",
  };
}

describe("formatAppliedGeometryStatus", () => {
  test("null status → no_status", () => {
    const out = formatAppliedGeometryStatus(null);
    expect(out).toEqual<AppliedGeometryDisplay>({ kind: "no_status" });
  });

  test("operator_saved happy path → operator_saved with counts and revision", () => {
    const out = formatAppliedGeometryStatus(row());
    expect(out).toEqual<AppliedGeometryDisplay>({
      kind: "operator_saved",
      revision: 9,
      lineCount: 2,
      roiCount: 1,
    });
  });

  test("source=default → default with counts (no revision needed)", () => {
    const out = formatAppliedGeometryStatus(
      row({
        applied_geometry: {
          source: "default",
          revision: null,
          line_count: 1,
          roi_count: 1,
        },
      }),
    );
    expect(out).toEqual<AppliedGeometryDisplay>({
      kind: "default",
      lineCount: 1,
      roiCount: 1,
    });
  });

  test("source=fallback_default_on_error with reason → fallback variant carries revision + reason", () => {
    const out = formatAppliedGeometryStatus(
      row({
        applied_geometry: {
          source: "fallback_default_on_error",
          revision: 9,
          line_count: 1,
          roi_count: 1,
          error_reason: "geometry envelope has no enabled rois or lines",
        },
      }),
    );
    expect(out).toEqual<AppliedGeometryDisplay>({
      kind: "fallback",
      revision: 9,
      errorReason: "geometry envelope has no enabled rois or lines",
    });
  });

  test("source=fallback_default_on_error without reason → null errorReason, null revision", () => {
    const out = formatAppliedGeometryStatus(
      row({
        applied_geometry: {
          source: "fallback_default_on_error",
          revision: null,
          line_count: 1,
          roi_count: 1,
        },
      }),
    );
    expect(out).toEqual<AppliedGeometryDisplay>({
      kind: "fallback",
      revision: null,
      errorReason: null,
    });
  });

  test("error_code=geometry_invalid overrides whatever applied_geometry says", () => {
    // P6-C stamps the error_code at the row level alongside source =
    // fallback_default_on_error. The chip should surface the strongest
    // signal — geometry_invalid — even though applied_geometry also exists.
    const out = formatAppliedGeometryStatus(
      row({
        error_code: "geometry_invalid",
        error_message: "invalid geometry envelope: coordinate_space",
        applied_geometry: {
          source: "fallback_default_on_error",
          revision: 9,
          line_count: 1,
          roi_count: 1,
        },
      }),
    );
    expect(out).toEqual<AppliedGeometryDisplay>({
      kind: "geometry_invalid",
      errorMessage: "invalid geometry envelope: coordinate_space",
    });
  });

  test("error_code=geometry_invalid with no error_message → null errorMessage", () => {
    const out = formatAppliedGeometryStatus(
      row({ error_code: "geometry_invalid", error_message: null }),
    );
    expect(out).toEqual<AppliedGeometryDisplay>({
      kind: "geometry_invalid",
      errorMessage: null,
    });
  });

  test("missing applied_geometry on payload → missing_applied_geometry", () => {
    const out = formatAppliedGeometryStatus(row({ applied_geometry: null }));
    expect(out).toEqual<AppliedGeometryDisplay>({
      kind: "missing_applied_geometry",
    });
  });

  test("unrecognized source string → unknown_source with sourceLabel verbatim", () => {
    const out = formatAppliedGeometryStatus(
      row({
        applied_geometry: {
          source: "future_source_kind",
          revision: 0,
          line_count: 0,
          roi_count: 0,
        },
      }),
    );
    expect(out).toEqual<AppliedGeometryDisplay>({
      kind: "unknown_source",
      sourceLabel: "future_source_kind",
    });
  });

  test("non-error error_code is ignored (only geometry_invalid is special-cased)", () => {
    // Other error codes (e.g. container_crash) live in their own taxonomy
    // and do not change the geometry verdict. The chip still shows whatever
    // applied_geometry resolved to.
    const out = formatAppliedGeometryStatus(
      row({ error_code: "container_crash", error_message: "exit 1" }),
    );
    expect(out.kind).toBe("operator_saved");
  });
});
