// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type {
  ConfigComparisonGroup,
  ConfigComparisonSummaryResponse,
} from "@/lib/api/types";

import { ReliabilityConfigComparisonCard } from "./reliability-config-comparison-card";

afterEach(cleanup);

function group(over: Partial<ConfigComparisonGroup> = {}): ConfigComparisonGroup {
  return {
    group_key: "k",
    label: "All classes · default confidence · default FPS",
    processing_config_source: "operator_saved",
    processing_config_revision: 4,
    processing_config_status: "applied",
    applied_model_key: "trafficcamnet_v1",
    applied_selected_classes_key: "all",
    applied_confidence_threshold: null,
    requested_processing_fps: null,
    applied_processing_fps: null,
    warnings: [],
    sample_count: 120,
    avg_confidence: 0.45,
    low_confidence_ratio: 0.18,
    latest_bucket_start: "2026-06-10T00:00:00Z",
    ...over,
  };
}

const R5 = group({
  group_key: "k5",
  label: "All classes · confidence 0.10 · 5 FPS",
  processing_config_revision: 5,
  processing_config_status: "partially_applied",
  applied_confidence_threshold: 0.1,
  requested_processing_fps: 5,
  applied_processing_fps: 5,
  warnings: ["processing_fps_output_cadence_only"],
  sample_count: 268,
  avg_confidence: 0.21,
  low_confidence_ratio: 0.44,
});

function summary(
  over: Partial<ConfigComparisonSummaryResponse> = {},
): ConfigComparisonSummaryResponse {
  return {
    camera_id: "11111111-1111-1111-1111-111111111111",
    range: "24h",
    generated_at: "2026-06-10T12:00:00Z",
    comparison_mode: "latest_vs_previous",
    min_samples: 30,
    baseline: group(),
    candidate: R5,
    metric_deltas: {
      avg_confidence_delta: -0.24,
      avg_confidence_percent_delta: -53.3,
      low_confidence_ratio_delta: 0.26,
      sample_count_delta: 148,
      applied_processing_fps_delta: 5,
    },
    comparison_status: "mixed_metrics",
    metric_directions: [
      "avg_confidence_lower",
      "low_confidence_ratio_higher",
      "samples_higher",
    ],
    summary:
      "Config r5 had lower average confidence, a higher low-confidence ratio, and more samples than Config r4 in this window. The config also changed what gets measured, so these metrics are not directly comparable — see the comparability notes.",
    bullets: [
      "Average confidence is lower by 0.24 (0.45 → 0.21) in this window.",
      "The confidence threshold also changed, so this likely includes weaker detections that were previously filtered out.",
      "Sample count went from 120 to 268. Snapshot output cadence is configured at 5 FPS, which changes how many samples are recorded (output cadence only, not inference work).",
    ],
    comparability_notes: [
      "Confidence threshold changed (default → 0.10), so weaker detections may now be included or excluded — averages are not directly comparable.",
    ],
    caveats: [
      "Directional comparison only, not causal proof.",
      "Processing FPS is output cadence only; it does not reduce GPU/inference work.",
    ],
    ...over,
  };
}

describe("ReliabilityConfigComparisonCard", () => {
  test("renders the section heading and neutral framing copy", () => {
    render(
      <ReliabilityConfigComparisonCard comparison24h={summary()} comparison7d={null} />,
    );
    expect(screen.getByText("config comparison")).toBeDefined();
    expect(
      screen.getByText(/Compare reliability metrics across recent applied camera configs/),
    ).toBeDefined();
  });

  test("unavailable state when the fetch degraded to null", () => {
    render(<ReliabilityConfigComparisonCard comparison24h={null} comparison7d={null} />);
    expect(screen.getByText(/Config comparison is currently unavailable/)).toBeDefined();
  });

  test("renders the report card: status chip, labels, summary, groups", () => {
    render(
      <ReliabilityConfigComparisonCard comparison24h={summary()} comparison7d={null} />,
    );
    expect(screen.getByText("mixed metrics")).toBeDefined();
    expect(screen.getByText("Config r5 vs Config r4")).toBeDefined();
    expect(screen.getByText(/lower average confidence/)).toBeDefined();
    expect(screen.getByText("All classes · default confidence · default FPS")).toBeDefined();
    expect(screen.getByText("All classes · confidence 0.10 · 5 FPS")).toBeDefined();
    expect(screen.getByText("268")).toBeDefined();
  });

  test("renders comparability notes and caveats", () => {
    render(
      <ReliabilityConfigComparisonCard comparison24h={summary()} comparison7d={null} />,
    );
    expect(screen.getByText(/Confidence threshold changed \(default → 0.10\)/)).toBeDefined();
    expect(screen.getByText("Directional comparison only, not causal proof.")).toBeDefined();
    expect(
      screen.getByText(/output cadence only; it does not reduce GPU\/inference work/),
    ).toBeDefined();
  });

  test("no_data state renders the backend copy without groups", () => {
    const empty = summary({
      comparison_status: "no_data",
      baseline: null,
      candidate: null,
      metric_deltas: null,
      metric_directions: [],
      summary: "No config-aware reliability data in this window.",
      bullets: [],
      comparability_notes: [],
      caveats: ["Directional comparison only, not causal proof."],
    });
    render(<ReliabilityConfigComparisonCard comparison24h={empty} comparison7d={null} />);
    expect(screen.getByText("no data")).toBeDefined();
    expect(screen.getByText(/No config-aware reliability data/)).toBeDefined();
    expect(screen.queryByText("Baseline")).toBeNull();
  });

  test("inconclusive single-group state shows the lone group for context", () => {
    const lone = summary({
      comparison_status: "inconclusive",
      comparison_mode: "none",
      baseline: null,
      candidate: R5,
      metric_deltas: null,
      metric_directions: [],
      summary:
        "Not enough distinct config groups to compare in this window — a comparison needs reliability data from at least two configs.",
      bullets: [],
      comparability_notes: [],
    });
    render(<ReliabilityConfigComparisonCard comparison24h={lone} comparison7d={null} />);
    expect(screen.getByText("inconclusive")).toBeDefined();
    expect(screen.getByText("Only config group in window")).toBeDefined();
    expect(screen.getByText(/at least two configs/)).toBeDefined();
  });

  test("range toggle switches payloads", () => {
    const weekly = summary({
      summary: "Config r5 had more samples than Config r4 in this window.",
    });
    render(
      <ReliabilityConfigComparisonCard comparison24h={summary()} comparison7d={weekly} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "7d" }));
    expect(screen.getByText(/had more samples than Config r4/)).toBeDefined();
  });

  test("renders no judgment or recommendation vocabulary", () => {
    const { container } = render(
      <ReliabilityConfigComparisonCard comparison24h={summary()} comparison7d={null} />,
    );
    const text = (container.textContent ?? "").toLowerCase();
    for (const forbidden of [
      "better",
      "worse",
      "best config",
      "we recommend",
      "recommended",
      "caused",
      "optimiz",
    ]) {
      expect(text).not.toContain(forbidden);
    }
    // "recommendation" and "gpu" appear ONLY inside explicit denials.
    expect(text).toContain("not causal proof or a recommendation");
    expect(text).toContain("does not reduce gpu/inference work");
  });
});
