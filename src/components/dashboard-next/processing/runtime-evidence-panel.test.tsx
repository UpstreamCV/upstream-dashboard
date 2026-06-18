// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const { useUpstreamList } = vi.hoisted(() => ({ useUpstreamList: vi.fn() }));
vi.mock("@/lib/api/use-list", () => ({ useUpstreamList }));
// Avoid loading the server-only client module in jsdom.
vi.mock("@/lib/api/processing-evidence", () => ({
  buildProcessingEvidencePath: (id: string, r: string) =>
    `/v1/cameras/${id}/processing/evidence?range=${r}`,
}));

import { RuntimeEvidencePanel } from "./runtime-evidence-panel";
import type { ProcessingEvidenceResponse } from "@/lib/api/types";

function evidence(
  over: Partial<ProcessingEvidenceResponse> = {},
): ProcessingEvidenceResponse {
  return {
    camera_id: "cam-1",
    window: {
      range: "24h",
      started_at: "2026-06-17T00:00:00Z",
      ended_at: "2026-06-18T00:00:00Z",
    },
    package: {
      requested_package_id: "pkg.iou",
      applied_package_id: "pkg.iou",
      state: "active",
      requested_revision: 2,
    },
    lineage: {
      model_id: "yolox_s_v1",
      tracker_profile_id: "deepstream_iou_fast_v1",
      tracker_algorithm: "iou",
      analytics_profile_id: "deepstream_nvdsanalytics_probe_v1",
    },
    status: {
      status: "processing",
      last_seen_at: "2026-06-17T23:59:00Z",
      last_error_code: null,
      updated_at: "2026-06-17T23:59:00Z",
    },
    observation_counts: [
      { type: "processor.line_crossing", count: 3 },
      { type: "processor.zone_exited", count: 2 },
    ],
    lifecycle: { inferred_zone_exits: 2, track_missing_timeout_exits: 2 },
    tracking: {
      unique_tracker_ids_count: 8,
      tracker_ids_sample: ["1", "2", "5"],
      is_session_level: true,
    },
    package_history: [
      {
        id: "h1",
        event_type: "camera.processing_package_applied",
        package_id: "pkg.iou",
        actor_type: "user",
        actor_user_id: "u1",
        summary: "applied",
        created_at: "2026-06-17T23:40:00Z",
      },
    ],
    warnings: [
      "dwell_closure_reason_not_persisted",
      "tracking_metrics_are_session_level",
    ],
    ...over,
  };
}

function swr(over: Record<string, unknown> = {}) {
  return {
    data: undefined,
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  useUpstreamList.mockReset();
});
afterEach(cleanup);

function renderPanel(initial: ProcessingEvidenceResponse | null = null) {
  return render(
    <RuntimeEvidencePanel cameraId="cam-1" initialEvidence={initial} />,
  );
}

describe("RuntimeEvidencePanel", () => {
  test("renders all evidence sections from data", () => {
    useUpstreamList.mockReturnValue(swr({ data: evidence() }));
    renderPanel();
    expect(screen.getByText("current runtime")).toBeDefined();
    expect(screen.getByText(/recent observations · last 24 hours/)).toBeDefined();
    expect(screen.getByText("lifecycle signals")).toBeDefined();
    expect(screen.getByText("package history")).toBeDefined();
    // lineage + counts + inferred copy
    expect(screen.getByText("iou")).toBeDefined();
    expect(screen.getByText("line crossing")).toBeDefined();
    expect(screen.getByText(/2 zone exits were inferred/)).toBeDefined();
  });

  test("renders the session-to-date tracking warning", () => {
    useUpstreamList.mockReturnValue(swr({ data: evidence() }));
    renderPanel();
    expect(
      screen.getByText(/Tracker counts are session-to-date/),
    ).toBeDefined();
  });

  test("error state when the fetch fails", () => {
    useUpstreamList.mockReturnValue(swr({ error: new Error("boom") }));
    renderPanel();
    expect(
      screen.getByText(/Could not load processing evidence/),
    ).toBeDefined();
  });

  test("empty state when there is no evidence yet", () => {
    useUpstreamList.mockReturnValue(swr({ data: undefined, isLoading: false }));
    renderPanel();
    expect(
      screen.getByText(/Runtime evidence will appear after a processing session starts/),
    ).toBeDefined();
  });

  test("the range toggle re-keys the fetch to 1h", () => {
    useUpstreamList.mockReturnValue(swr({ data: evidence() }));
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "1h" }));
    const paths = useUpstreamList.mock.calls.map((c) => c[0]);
    expect(paths).toContain("/v1/cameras/cam-1/processing/evidence?range=1h");
  });

  test("uses observational copy, never prescriptive language", () => {
    useUpstreamList.mockReturnValue(swr({ data: evidence() }));
    const { container } = renderPanel();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/you should/i);
    expect(text).not.toMatch(/we recommend/i);
    expect(text).not.toMatch(/change your package/i);
  });
});
