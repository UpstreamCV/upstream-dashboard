import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { ReliabilityFinding } from "@/lib/api/types";

vi.mock("@/components/data/relative-time", () => ({
  RelativeTime: () => "<relative-time>",
}));

import { ReliabilityFindingCard } from "./reliability-finding-card";

function f(over: Partial<ReliabilityFinding> = {}): ReliabilityFinding {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    camera_id: "22222222-2222-2222-2222-222222222222",
    stream_session_id: null,
    processor_status_id: null,
    finding_type: "scene_too_dark_for_reliable_detection",
    category: "scene_quality",
    severity: "warning",
    status: "open",
    title: "Scene may be too dark for reliable detection",
    message:
      "This camera appears dark, which may reduce detection confidence and make events less reliable.",
    likely_cause: "low_light",
    recommended_action:
      "Improve lighting, move the camera, or test a low-light package for this camera.",
    evidence: {
      brightness_mean: 22,
      brightness_threshold: 45,
      source: "latest_frame_snapshot",
    },
    dedupe_key: "camera:cam-1:scene_quality:scene_too_dark_for_reliable_detection",
    detector_version: "reliability.v0.5",
    first_seen_at: "2026-05-28T15:00:00Z",
    last_seen_at: "2026-05-28T15:00:00Z",
    resolved_at: null,
    resolved_reason: null,
    created_at: "2026-05-28T15:00:00Z",
    updated_at: "2026-05-28T15:00:00Z",
    ...over,
  };
}

describe("ReliabilityFindingCard — open variant", () => {
  test("renders title + message + severity badge + category", () => {
    const html = renderToStaticMarkup(
      <ReliabilityFindingCard finding={f()} variant="open" />,
    );
    expect(html).toContain("Scene may be too dark for reliable detection");
    expect(html).toContain("This camera appears dark");
    expect(html).toContain(">Warning<");
    expect(html).toContain(">Scene quality<");
  });

  test("likely_cause appears when set", () => {
    const html = renderToStaticMarkup(
      <ReliabilityFindingCard finding={f()} variant="open" />,
    );
    expect(html).toContain("likely cause");
    expect(html).toContain("low_light");
  });

  test("likely_cause section hidden when null", () => {
    const html = renderToStaticMarkup(
      <ReliabilityFindingCard finding={f({ likely_cause: null })} variant="open" />,
    );
    expect(html).not.toContain("likely cause");
  });

  test("recommended fix block renders for open variant", () => {
    const html = renderToStaticMarkup(
      <ReliabilityFindingCard finding={f()} variant="open" />,
    );
    expect(html).toContain("recommended fix");
    expect(html).toContain("Improve lighting");
  });

  test("first_seen / last_seen footer present", () => {
    const html = renderToStaticMarkup(
      <ReliabilityFindingCard finding={f()} variant="open" />,
    );
    expect(html).toContain("First seen");
    expect(html).toContain("Last seen");
  });

  test("never surfaces dedupe_key / detector_version / session_ids", () => {
    const html = renderToStaticMarkup(
      <ReliabilityFindingCard
        finding={f({
          stream_session_id: "ssn-abc-12345678",
          processor_status_id: "ps-abc-12345678",
        })}
        variant="open"
      />,
    );
    // Dedupe key contains "scene_quality:scene_too_dark" -- distinctive enough
    // to catch a leak.
    expect(html).not.toContain("camera:cam-1:scene_quality");
    expect(html).not.toContain("reliability.v0.5");
    expect(html).not.toContain("ssn-abc-12345678");
    expect(html).not.toContain("ps-abc-12345678");
  });

  test("critical severity uses danger color in the action block", () => {
    const html = renderToStaticMarkup(
      <ReliabilityFindingCard
        finding={f({
          severity: "critical",
          category: "stream",
          finding_type: "stream_valid_processor_silent",
          title: "Camera is sending frames but processor is silent",
          recommended_action: "Check processor worker health.",
          evidence: { stream_state: "streaming" },
        })}
        variant="open"
      />,
    );
    expect(html).toContain(">Critical<");
    expect(html).toContain("#c0473b");
  });
});

describe("ReliabilityFindingCard — resolved variant", () => {
  test("shows resolved_at + resolved_reason, hides action block", () => {
    const html = renderToStaticMarkup(
      <ReliabilityFindingCard
        finding={f({
          status: "resolved",
          resolved_at: "2026-05-28T16:00:00Z",
          resolved_reason: "brightness_above_threshold",
        })}
        variant="resolved"
      />,
    );
    expect(html).toContain("Resolved");
    expect(html).toContain("brightness_above_threshold");
    // Action block (recommended fix) suppressed on resolved variant.
    expect(html).not.toContain("recommended fix");
  });

  test("handles missing resolved_reason gracefully", () => {
    const html = renderToStaticMarkup(
      <ReliabilityFindingCard
        finding={f({
          status: "resolved",
          resolved_at: "2026-05-28T16:00:00Z",
          resolved_reason: null,
        })}
        variant="resolved"
      />,
    );
    expect(html).toContain("Resolved reason");
    expect(html).toContain(">—<");
  });
});

describe("ReliabilityFindingCard — operator copy guards", () => {
  test("never leaks runtime jargon", () => {
    const html = renderToStaticMarkup(
      <ReliabilityFindingCard finding={f()} variant="open" />,
    ).toLowerCase();
    expect(html).not.toContain("deepstream");
    expect(html).not.toContain("nvdsanalytics");
    expect(html).not.toContain("gstreamer");
    expect(html).not.toContain("pyds");
  });
});
