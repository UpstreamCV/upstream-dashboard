import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { ReliabilityFinding } from "@/lib/api/types";

vi.mock("@/components/data/relative-time", () => ({
  RelativeTime: () => "<relative-time>",
}));

import { ReliabilityEvidence } from "./reliability-evidence";

function finding(
  type: ReliabilityFinding["finding_type"],
  evidence: Record<string, unknown>,
  category: ReliabilityFinding["category"] = "stream",
): ReliabilityFinding {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    camera_id: "cam-1",
    stream_session_id: null,
    processor_status_id: null,
    finding_type: type,
    category,
    severity: "warning",
    status: "open",
    title: "x",
    message: "x",
    likely_cause: null,
    recommended_action: null,
    evidence,
    dedupe_key: "x",
    detector_version: "x",
    first_seen_at: "2026-05-28T15:00:00Z",
    last_seen_at: "2026-05-28T15:00:00Z",
    resolved_at: null,
    resolved_reason: null,
    created_at: "2026-05-28T15:00:00Z",
    updated_at: "2026-05-28T15:00:00Z",
  };
}

describe("ReliabilityEvidence — scene_too_dark", () => {
  test("renders brightness / threshold / frame dims / source", () => {
    const html = renderToStaticMarkup(
      <ReliabilityEvidence
        finding={finding(
          "scene_too_dark_for_reliable_detection",
          {
            brightness_mean: 22.4,
            brightness_threshold: 45,
            image_width: 1280,
            image_height: 720,
            captured_at: "2026-05-28T15:00:00Z",
            source: "latest_frame_snapshot",
          },
          "scene_quality",
        )}
      />,
    );
    expect(html).toContain("Brightness");
    expect(html).toContain("22.4 / 255");
    expect(html).toContain("Threshold");
    expect(html).toContain(">45<");
    expect(html).toContain("Frame");
    expect(html).toContain("1280×720");
    expect(html).toContain("Latest frame snapshot");
  });

  test("handles partial evidence (no source, no dims)", () => {
    const html = renderToStaticMarkup(
      <ReliabilityEvidence
        finding={finding("scene_too_dark_for_reliable_detection", {
          brightness_mean: 5,
          brightness_threshold: 45,
        })}
      />,
    );
    expect(html).toContain("5.0 / 255");
    expect(html).toContain(">45<");
    expect(html).not.toContain("Frame");
  });
});

describe("ReliabilityEvidence — unstable_detection_confidence", () => {
  test("renders sample count + avg + low ratio as percentage", () => {
    const html = renderToStaticMarkup(
      <ReliabilityEvidence
        finding={finding(
          "unstable_detection_confidence",
          {
            confidence_sample_count: 8,
            avg_confidence: 0.31,
            median_confidence: 0.305,
            min_confidence: 0.28,
            max_confidence: 0.35,
            low_confidence_ratio: 1.0,
            confidence_stddev: 0.022,
            thresholds: { low_confidence_threshold: 0.45 },
            captured_at: "2026-05-28T15:00:00Z",
          },
          "detection",
        )}
      />,
    );
    expect(html).toContain("Confidence samples");
    expect(html).toContain(">8<");
    expect(html).toContain("0.31");
    expect(html).toContain("Low-confidence ratio");
    expect(html).toContain(">100%<");
    expect(html).toContain("0.45");
  });

  test("renders M5 baseline drift fields (previous avg, drop %, baseline, reasons)", () => {
    const html = renderToStaticMarkup(
      <ReliabilityEvidence
        finding={finding(
          "unstable_detection_confidence",
          {
            confidence_sample_count: 9,
            avg_confidence: 0.34,
            median_confidence: 0.35,
            min_confidence: 0.22,
            max_confidence: 0.49,
            low_confidence_ratio: 0.4,
            confidence_stddev: 0.08,
            previous_avg_confidence: 0.68,
            drop_ratio: 0.5,
            baseline_window_seconds: 1800,
            baseline_confidence_sample_count: 54,
            baseline_metric_count: 7,
            trigger_reasons: ["drop_vs_recent_baseline"],
            thresholds: { low_confidence_threshold: 0.45 },
            source: "latest_perception_snapshot_with_history",
          },
          "detection",
        )}
      />,
    );
    expect(html).toContain("Previous avg confidence");
    expect(html).toContain(">0.68<");
    expect(html).toContain("Confidence drop");
    expect(html).toContain(">50%<");
    expect(html).toContain("Baseline samples");
    expect(html).toContain(">54<");
    expect(html).toContain("Baseline window");
    expect(html).toMatch(/30\s*min/);
    expect(html).toContain("Why flagged");
    expect(html).toContain("dropped vs recent baseline");
  });

  test("omits baseline rows when no history is present (no crash)", () => {
    const html = renderToStaticMarkup(
      <ReliabilityEvidence
        finding={finding(
          "unstable_detection_confidence",
          {
            confidence_sample_count: 6,
            avg_confidence: 0.3,
            median_confidence: 0.3,
            min_confidence: 0.25,
            max_confidence: 0.4,
            low_confidence_ratio: 0.6,
            confidence_stddev: 0.05,
            previous_avg_confidence: null,
            drop_ratio: null,
            baseline_window_seconds: null,
            baseline_confidence_sample_count: null,
            baseline_metric_count: null,
            trigger_reasons: ["low_average_confidence"],
            thresholds: { low_confidence_threshold: 0.45 },
            source: "latest_perception_snapshot",
          },
          "detection",
        )}
      />,
    );
    // The static stats still render.
    expect(html).toContain("Average confidence");
    // Baseline rows are absent (null values -> Row returns null).
    expect(html).not.toContain("Previous avg confidence");
    expect(html).not.toContain("Confidence drop");
    expect(html).not.toContain("Baseline window");
    // trigger_reasons still explains the static trigger.
    expect(html).toContain("Why flagged");
    expect(html).toContain("low average");
  });
});

describe("ReliabilityEvidence — stream_valid_processor_silent", () => {
  test("renders human-friendly ages", () => {
    const html = renderToStaticMarkup(
      <ReliabilityEvidence
        finding={finding("stream_valid_processor_silent", {
          stream_state: "streaming",
          latest_frame_age_seconds: 6,
          last_observation_age_seconds: 52357,
          processor_status_age_seconds: 52321,
        })}
      />,
    );
    expect(html).toContain("streaming");
    expect(html).toContain(">6s<");
    expect(html).toContain("Last processor status");
    // 52321s ≈ 15h
    expect(html.toLowerCase()).toMatch(/15\s*h\s*ago/);
  });
});

describe("ReliabilityEvidence — latest_frame_stale", () => {
  test("renders frame age + threshold + stream state", () => {
    const html = renderToStaticMarkup(
      <ReliabilityEvidence
        finding={finding("latest_frame_stale", {
          latest_frame_age_seconds: 75,
          threshold_seconds: 60,
          stream_state: "streaming",
        })}
      />,
    );
    expect(html).toContain(">75s<");
    expect(html).toContain(">60s<");
    expect(html).toContain("streaming");
  });
});

describe("ReliabilityEvidence — processor_using_default_geometry", () => {
  test("operator-friendly geometry source labels", () => {
    const html = renderToStaticMarkup(
      <ReliabilityEvidence
        finding={finding(
          "processor_using_default_geometry",
          {
            applied_geometry_source: "default",
            has_saved_geometry: true,
          },
          "geometry_config",
        )}
      />,
    );
    expect(html).toContain(">Default<");
    expect(html).toContain("Operator-saved geometry");
    expect(html).toContain(">Yes<");
  });

  test("shows fallback + error_reason when present", () => {
    const html = renderToStaticMarkup(
      <ReliabilityEvidence
        finding={finding(
          "processor_using_default_geometry",
          {
            applied_geometry_source: "fallback_default_on_error",
            error_reason: "geometry envelope has no enabled rois",
          },
          "geometry_config",
        )}
      />,
    );
    expect(html).toContain("Fallback default");
    expect(html).toContain("geometry envelope has no enabled rois");
  });
});

describe("ReliabilityEvidence — generic fallback + secret filter", () => {
  test("unknown finding type falls through to generic key/value", () => {
    const html = renderToStaticMarkup(
      <ReliabilityEvidence
        finding={finding(
          "some_future_finding_type",
          { interesting_metric: 42, other: "hello" },
        )}
      />,
    );
    expect(html).toContain("interesting metric");
    expect(html).toContain(">42<");
    expect(html).toContain(">hello<");
  });

  test("missing evidence renders empty muted note (no crash)", () => {
    const html = renderToStaticMarkup(
      <ReliabilityEvidence finding={finding("some_future_finding_type", {})} />,
    );
    expect(html).toContain("No additional evidence available.");
  });

  test("secret-looking keys are filtered out of the generic renderer", () => {
    const html = renderToStaticMarkup(
      <ReliabilityEvidence
        finding={finding("some_future_finding_type", {
          interesting_metric: 7,
          signed_url: "https://secret.example.com/abc",
          storage_key: "acct/cam/d/k.jpg",
          service_role_key: "supersecret",
          api_key: "ups_live_...",
          authorization: "Bearer xyz",
          password: "hunter2",
          streamid: "publish:sess_abc",
        })}
      />,
    );
    expect(html).toContain("interesting metric");
    // Every secret-shaped field is dropped.
    expect(html).not.toContain("secret.example.com");
    expect(html).not.toContain("acct/cam/d/k.jpg");
    expect(html).not.toContain("supersecret");
    expect(html).not.toContain("ups_live_");
    expect(html).not.toContain("Bearer xyz");
    expect(html).not.toContain("hunter2");
    expect(html).not.toContain("publish:sess_");
  });
});
