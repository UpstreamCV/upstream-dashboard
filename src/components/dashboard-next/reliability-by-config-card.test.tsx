// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type {
  ConfidenceTrendByConfigResponse,
  ConfidenceTrendConfigGroup,
  ConfidenceTrendPoint,
} from "@/lib/api/types";

import { ReliabilityByConfigCard } from "./reliability-by-config-card";

afterEach(cleanup);

let hour = 0;
function point(over: Partial<ConfidenceTrendPoint> = {}): ConfidenceTrendPoint {
  const start = `2026-06-09T${String(hour++ % 24).padStart(2, "0")}:00:00Z`;
  return {
    bucket_start: start,
    bucket_end: start,
    avg_confidence: 0.8,
    min_confidence: 0.5,
    max_confidence: 0.95,
    low_confidence_ratio: 0.1,
    confidence_stddev: 0.05,
    metric_count: 100,
    object_count_total: 200,
    confidence_sample_count: 100,
    ...over,
  };
}

function group(
  over: Partial<ConfidenceTrendConfigGroup> = {},
): ConfidenceTrendConfigGroup {
  const points = over.points ?? [point(), point(), point()];
  const rated = points.filter((p) => p.avg_confidence != null);
  return {
    processing_config_source: "operator_saved",
    processing_config_revision: 3,
    processing_config_status: "applied",
    applied_model_key: "trafficcamnet_v1",
    applied_selected_classes_key: "all",
    applied_confidence_threshold: null,
    requested_processing_fps: null,
    applied_processing_fps: null,
    processing_config_warnings: null,
    summary: {
      point_count: points.length,
      latest_avg_confidence: rated.length
        ? rated[rated.length - 1].avg_confidence
        : null,
      lowest_avg_confidence: null,
      highest_avg_confidence: null,
      total_confidence_samples: points.reduce(
        (a, p) => a + p.confidence_sample_count,
        0,
      ),
      latest_bucket_start: null,
    },
    ...over,
    points,
  };
}

function response(
  groups: ConfidenceTrendConfigGroup[],
): ConfidenceTrendByConfigResponse {
  return {
    camera_id: "11111111-1111-1111-1111-111111111111",
    range: "24h",
    bucket_size: "1h",
    group_count: groups.length,
    groups,
  };
}

const PERSON_GROUP = group({
  processing_config_revision: 4,
  processing_config_status: "partially_applied",
  applied_selected_classes_key: "person",
  applied_confidence_threshold: 0.2,
  processing_config_warnings: ["selected_classes_analytics_counts_not_filtered"],
});

describe("ReliabilityByConfigCard", () => {
  test("renders the section heading and comparison copy", () => {
    render(<ReliabilityByConfigCard byConfig24h={response([])} byConfig7d={null} />);
    expect(screen.getByText("reliability by config")).toBeDefined();
    expect(
      screen.getByText(
        "Compare reliability metrics across applied camera configurations.",
      ),
    ).toBeDefined();
  });

  test("unavailable state when the fetch degraded to null (tab not broken)", () => {
    render(<ReliabilityByConfigCard byConfig24h={null} byConfig7d={null} />);
    expect(
      screen.getByText(/Config-aware reliability is currently unavailable/),
    ).toBeDefined();
  });

  test("empty state explains when data will appear", () => {
    render(<ReliabilityByConfigCard byConfig24h={response([])} byConfig7d={null} />);
    expect(
      screen.getByText(
        /will appear after the camera produces detections with applied processing config metadata/,
      ),
    ).toBeDefined();
  });

  test("renders multiple config groups with readable labels", () => {
    render(
      <ReliabilityByConfigCard
        byConfig24h={response([group(), PERSON_GROUP])}
        byConfig7d={null}
      />,
    );
    // "all" -> "All classes."; null threshold -> "default confidence".
    expect(screen.getByText("All classes · default confidence · default FPS")).toBeDefined();
    // confidence 0.2 displays clearly.
    expect(screen.getByText("person · confidence 0.20 · default FPS")).toBeDefined();
  });

  test("partially_applied status renders calmly with revision", () => {
    render(
      <ReliabilityByConfigCard byConfig24h={response([PERSON_GROUP])} byConfig7d={null} />,
    );
    expect(screen.getByText("partially applied · r4")).toBeDefined();
  });

  test("selected_classes_analytics_counts_not_filtered renders a caveat badge", () => {
    render(
      <ReliabilityByConfigCard byConfig24h={response([PERSON_GROUP])} byConfig7d={null} />,
    );
    expect(screen.getByText("line/ROI counts still all-class")).toBeDefined();
  });

  test("applied fps shows in the group label", () => {
    const fps_group = group({
      applied_selected_classes_key: "all",
      requested_processing_fps: 5,
      applied_processing_fps: 5,
      processing_config_warnings: ["processing_fps_output_cadence_only"],
    });
    render(<ReliabilityByConfigCard byConfig24h={response([fps_group])} byConfig7d={null} />);
    expect(screen.getByText("All classes · default confidence · 5 FPS")).toBeDefined();
    // M7E caveat badge rides along.
    expect(screen.getByText("output cadence only")).toBeDefined();
  });

  test("no cadence badge without the M7E warning", () => {
    render(<ReliabilityByConfigCard byConfig24h={response([group()])} byConfig7d={null} />);
    expect(screen.queryByText("output cadence only")).toBeNull();
  });

  test("no caveat badge without the warning", () => {
    render(<ReliabilityByConfigCard byConfig24h={response([group()])} byConfig7d={null} />);
    expect(screen.queryByText("line/ROI counts still all-class")).toBeNull();
  });

  test("zero-sample group shows the no-samples message instead of a chart", () => {
    const empty = group({
      points: [point({ avg_confidence: null, confidence_sample_count: 0 })],
    });
    empty.summary.total_confidence_samples = 0;
    render(<ReliabilityByConfigCard byConfig24h={response([empty])} byConfig7d={null} />);
    expect(
      screen.getByText("No samples for this config in the selected range."),
    ).toBeDefined();
  });

  test("pre-M8 all-null-dimension group is labeled, not dropped", () => {
    const legacy = group({
      processing_config_source: null,
      processing_config_revision: null,
      processing_config_status: null,
      applied_model_key: null,
      applied_selected_classes_key: null,
      applied_confidence_threshold: null,
    });
    render(<ReliabilityByConfigCard byConfig24h={response([legacy])} byConfig7d={null} />);
    expect(screen.getByText("No config metadata")).toBeDefined();
  });

  test("class filter narrows groups client-side", () => {
    render(
      <ReliabilityByConfigCard
        byConfig24h={response([group(), PERSON_GROUP])}
        byConfig7d={null}
      />,
    );
    const classSelect = screen.getByLabelText("Classes");
    fireEvent.change(classSelect, { target: { value: "person" } });
    expect(screen.getByText("person · confidence 0.20 · default FPS")).toBeDefined();
    expect(screen.queryByText("All classes · default confidence · default FPS")).toBeNull();
  });

  test("range toggle switches to the 7d payload", () => {
    render(
      <ReliabilityByConfigCard
        byConfig24h={response([group()])}
        byConfig7d={response([PERSON_GROUP])}
      />,
    );
    expect(screen.getByText("All classes · default confidence · default FPS")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "7d" }));
    expect(screen.getByText("person · confidence 0.20 · default FPS")).toBeDefined();
    expect(screen.queryByText("All classes · default confidence · default FPS")).toBeNull();
  });

  test("does not claim model/tracker/FPS are live-applied", () => {
    const { container } = render(
      <ReliabilityByConfigCard
        byConfig24h={response([group(), PERSON_GROUP])}
        byConfig7d={null}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/model (switch|change).{0,20}(live|applied)/i);
    expect(text).not.toMatch(/tracker.{0,20}(live|applied)/i);
    // M9.1: "5 FPS" labels are facts about applied output cadence — what must
    // never appear is a GPU/inference-throttling claim.
    expect(text).not.toMatch(/gpu/i);
    expect(text).not.toMatch(/throttles? inference/i);
    expect(text).not.toMatch(/reduces? (gpu|inference|cost)/i);
    // The standing caveat IS present.
    expect(text).toContain(
      "Line/ROI aggregate counts may still include all classes.",
    );
  });
});
