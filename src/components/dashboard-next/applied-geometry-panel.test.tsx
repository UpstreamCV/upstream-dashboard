import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { ProcessorStatusRecord } from "@/lib/api/types";
import { AppliedGeometryPanel } from "./applied-geometry-panel";

// AppliedGeometryPanel is a pure Server Component with no dynamic children
// — no client modules need stubbing. We render to a static HTML string and
// assert on the operator-facing copy each variant emits.

function row(
  over: {
    error_code?: string | null;
    error_message?: string | null;
    applied_geometry?: Record<string, unknown> | null;
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
  return {
    id: "00000000-0000-0000-0000-000000000001",
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

describe("AppliedGeometryPanel", () => {
  test("operator_saved → revision, line count, ROI count, positive header", () => {
    const html = renderToStaticMarkup(<AppliedGeometryPanel status={row()} />);
    expect(html).toContain("applied geometry");
    expect(html).toContain("Operator-saved");
    expect(html).toContain("r9");
    expect(html).toContain("Lines");
    // The values appear after their labels — match the rendered numbers via
    // the inline span with the value classes; checking the bare digit risks
    // false positives if "1" or "2" appear elsewhere in markup.
    expect(html).toMatch(/Lines[\s\S]*?>2<\/span>/);
    expect(html).toMatch(/ROIs[\s\S]*?>1<\/span>/);
    // No warning copy on the happy path.
    expect(html).not.toContain("using default geometry");
    expect(html).not.toContain("failed validation");
  });

  test("source=default → counts + warning copy", () => {
    const html = renderToStaticMarkup(
      <AppliedGeometryPanel
        status={row({
          applied_geometry: {
            source: "default",
            revision: null,
            line_count: 1,
            roi_count: 1,
          },
        })}
      />,
    );
    expect(html).toContain(">Default<");
    expect(html).toContain("Processor is using default geometry");
    expect(html).toContain("restart the processor session");
    // No revision row on the default path (default has no operator revision).
    expect(html).not.toContain("Revision");
  });

  test("source=fallback_default_on_error with reason → saved revision + reason text", () => {
    const html = renderToStaticMarkup(
      <AppliedGeometryPanel
        status={row({
          applied_geometry: {
            source: "fallback_default_on_error",
            revision: 9,
            line_count: 1,
            roi_count: 1,
            error_reason: "geometry envelope has no enabled rois or lines",
          },
        })}
      />,
    );
    expect(html).toContain("Fallback default");
    expect(html).toContain("Saved revision");
    expect(html).toContain("r9");
    expect(html).toContain("Saved geometry failed validation");
    expect(html).toContain("no enabled rois or lines");
  });

  test("error_code=geometry_invalid → danger header + error_message", () => {
    const html = renderToStaticMarkup(
      <AppliedGeometryPanel
        status={row({
          error_code: "geometry_invalid",
          error_message: "invalid geometry envelope: coordinate_space",
        })}
      />,
    );
    expect(html).toContain("Geometry error");
    expect(html).toContain("Saved geometry failed validation");
    expect(html).toContain("invalid geometry envelope: coordinate_space");
  });

  test("null status → 'Not reported yet' muted state", () => {
    const html = renderToStaticMarkup(<AppliedGeometryPanel status={null} />);
    expect(html).toContain("Not reported yet");
    expect(html).toContain("Start a processor session");
    // No revision / lines / ROIs rows when there is no row to display.
    expect(html).not.toContain("Revision");
    expect(html).not.toContain("ROIs");
  });

  test("missing applied_geometry → 'Unknown' + explanation", () => {
    const html = renderToStaticMarkup(
      <AppliedGeometryPanel status={row({ applied_geometry: null })} />,
    );
    expect(html).toContain(">Unknown<");
    expect(html).toContain("does not include geometry lineage");
  });

  test("unrecognized source string → shows source verbatim + 'may need an update'", () => {
    const html = renderToStaticMarkup(
      <AppliedGeometryPanel
        status={row({
          applied_geometry: {
            source: "future_source_kind",
            revision: 0,
            line_count: 0,
            roi_count: 0,
          },
        })}
      />,
    );
    expect(html).toContain(">future_source_kind<");
    expect(html).toContain("Dashboard may need an update");
  });

  test("never mentions runtime-internal terms in operator-facing copy", () => {
    // The chip is operator-facing; copy that leaks runtime/internal names
    // (DeepStream, nvdsanalytics, GStreamer, pyds) makes the dashboard
    // feel like internal debug tooling. Pin this across all variants.
    const variants: Array<ProcessorStatusRecord | null> = [
      row(),
      row({ applied_geometry: { source: "default", revision: null, line_count: 1, roi_count: 1 } }),
      row({
        applied_geometry: {
          source: "fallback_default_on_error",
          revision: 9,
          line_count: 1,
          roi_count: 1,
        },
      }),
      row({ error_code: "geometry_invalid", error_message: "anything" }),
      null,
      row({ applied_geometry: null }),
    ];
    for (const v of variants) {
      const html = renderToStaticMarkup(<AppliedGeometryPanel status={v} />);
      const lc = html.toLowerCase();
      expect(lc).not.toContain("deepstream");
      expect(lc).not.toContain("nvdsanalytics");
      expect(lc).not.toContain("gstreamer");
      expect(lc).not.toContain("pyds");
    }
  });
});
