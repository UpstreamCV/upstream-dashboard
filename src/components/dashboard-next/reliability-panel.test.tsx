import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type {
  ReliabilityFinding,
  ReliabilitySummary,
  ReliabilitySummaryStatus,
} from "@/lib/api/types";
import { ReliabilityPanel } from "./reliability-panel";

// ReliabilityPanel is a pure Server Component with no dynamic children —
// no client modules need stubbing. Mirrors applied-geometry-panel.test.tsx:
// render to a static HTML string and assert on the operator-facing copy each
// variant emits.

function finding(over: Partial<ReliabilityFinding> = {}): ReliabilityFinding {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    camera_id: "22222222-2222-2222-2222-222222222222",
    stream_session_id: null,
    processor_status_id: null,
    finding_type: "latest_frame_stale",
    category: "stream",
    severity: "warning",
    status: "open",
    title: "Latest frame is stale",
    message:
      "The latest frame for this camera is stale. The dashboard preview or processor evidence may not reflect the current scene.",
    likely_cause: "stream_snapshot_or_media_path_issue",
    recommended_action:
      "Check stream health, snapshot extraction, and recent camera heartbeats.",
    evidence: { latest_frame_age_seconds: 120 },
    dedupe_key: "camera:cam-1:stream:latest_frame_stale",
    detector_version: "reliability.v0.1",
    first_seen_at: "2026-05-28T15:00:00Z",
    last_seen_at: "2026-05-28T15:00:00Z",
    resolved_at: null,
    resolved_reason: null,
    created_at: "2026-05-28T15:00:00Z",
    updated_at: "2026-05-28T15:00:00Z",
    ...over,
  };
}

function summary(
  status: ReliabilitySummaryStatus,
  over: Partial<ReliabilitySummary> = {},
): ReliabilitySummary {
  const top = over.top_findings ?? [];
  const highest = top[0]?.severity ?? null;
  return {
    camera_id: "22222222-2222-2222-2222-222222222222",
    status,
    highest_severity: over.highest_severity ?? highest,
    open_findings_count: over.open_findings_count ?? top.length,
    top_findings: top,
    recommended_next_action:
      over.recommended_next_action ?? top[0]?.recommended_action ?? null,
    last_evaluated_at: "2026-05-28T15:00:00Z",
    ...over,
  };
}

describe("ReliabilityPanel", () => {
  test("healthy → 'Healthy' header + no-active-findings copy", () => {
    const html = renderToStaticMarkup(
      <ReliabilityPanel summary={summary("healthy")} />,
    );
    expect(html).toContain("reliability");
    expect(html).toContain(">Healthy<");
    expect(html).toContain("No active reliability findings for this camera.");
    // Should not show any finding-shaped copy.
    expect(html).not.toContain("Recommended");
    expect(html).not.toContain("Not enough recent processor");
  });

  test("needs_review with warning finding → title, message, recommended action", () => {
    const f = finding();
    const html = renderToStaticMarkup(
      <ReliabilityPanel summary={summary("needs_review", { top_findings: [f] })} />,
    );
    expect(html).toContain(">Needs review<");
    expect(html).toContain(f.title);
    expect(html).toContain("stale");
    expect(html).toContain(f.recommended_action as string);
    // Likely cause shown in mono.
    expect(html).toContain("stream_snapshot_or_media_path_issue");
  });

  test("info status → 'Info' header + finding body", () => {
    const f = finding({
      severity: "info",
      finding_type: "processor_using_default_geometry",
      title: "Processor is using default geometry",
      message:
        "Processor is using default geometry instead of operator-saved geometry.",
      likely_cause: "processor_did_not_pick_up_saved_geometry",
      recommended_action:
        "Open Configure, verify saved geometry, and restart the processor session if needed.",
    });
    const html = renderToStaticMarkup(
      <ReliabilityPanel summary={summary("info", { top_findings: [f] })} />,
    );
    expect(html).toContain(">Info<");
    expect(html).toContain("default geometry");
    expect(html).toContain("Open Configure");
  });

  test("critical → 'Critical' header + danger-colored action block", () => {
    const f = finding({
      severity: "critical",
      finding_type: "stream_valid_processor_silent",
      title: "Stream is live but processor is not producing observations",
      message:
        "The camera stream appears live, but the processor is not producing recent observations. This workflow should not be trusted until processor output resumes.",
      likely_cause: "processor_runtime_or_observation_write_issue",
      recommended_action:
        "Check processor worker health, observation writes, and package eligibility for this session.",
    });
    const html = renderToStaticMarkup(
      <ReliabilityPanel summary={summary("critical", { top_findings: [f] })} />,
    );
    expect(html).toContain(">Critical<");
    expect(html).toContain("should not be trusted");
    // Danger color (#c0473b) is reserved for the action block on critical.
    expect(html).toContain("#c0473b");
  });

  test("unknown → muted 'not enough data' copy, no finding body", () => {
    const html = renderToStaticMarkup(
      <ReliabilityPanel summary={summary("unknown")} />,
    );
    expect(html).toContain(">Unknown<");
    expect(html).toContain(
      "Not enough recent processor or stream data to evaluate this camera yet.",
    );
    // No active-findings copy when status is unknown.
    expect(html).not.toContain("No active reliability findings");
  });

  test("summary === null (API 404 / unavailable) → 'Unavailable' muted", () => {
    const html = renderToStaticMarkup(<ReliabilityPanel summary={null} />);
    expect(html).toContain(">Unavailable<");
    expect(html).toContain("currently unavailable");
  });

  test("likely_cause absent → no mono cause line", () => {
    const f = finding({ likely_cause: null });
    const html = renderToStaticMarkup(
      <ReliabilityPanel summary={summary("needs_review", { top_findings: [f] })} />,
    );
    expect(html).toContain(f.title);
    // mono utility class is dropped when the cause is null. Match the
    // distinctive cause label rather than a generic CSS class to avoid
    // false-positives.
    expect(html).not.toContain("stream_snapshot_or_media_path_issue");
  });

  test("recommended_action absent → no action block emitted", () => {
    const f = finding({ recommended_action: null });
    const html = renderToStaticMarkup(
      <ReliabilityPanel summary={summary("needs_review", { top_findings: [f] })} />,
    );
    expect(html).toContain(f.message);
    expect(html).not.toContain(
      "Check stream health, snapshot extraction, and recent camera heartbeats.",
    );
  });

  test("needs_review with empty top_findings → defensive empty state", () => {
    // The api-server contract is "status !== healthy ⇒ top_findings has rows",
    // but the renderer must not crash if that drifts.
    const html = renderToStaticMarkup(
      <ReliabilityPanel summary={summary("needs_review", { top_findings: [] })} />,
    );
    expect(html).toContain(">Needs review<");
    expect(html).toContain("No active reliability findings");
  });

  test("never mentions runtime-internal terms in operator-facing copy", () => {
    // Mirrors the AppliedGeometryPanel assertion: copy that leaks runtime /
    // internal names (DeepStream, nvdsanalytics, GStreamer, pyds) makes the
    // dashboard feel like internal debug tooling. Pin across all variants.
    const variants: Array<ReliabilitySummary | null> = [
      summary("healthy"),
      summary("info", { top_findings: [finding({ severity: "info" })] }),
      summary("needs_review", { top_findings: [finding()] }),
      summary("critical", { top_findings: [finding({ severity: "critical" })] }),
      summary("unknown"),
      null,
    ];
    for (const v of variants) {
      const html = renderToStaticMarkup(<ReliabilityPanel summary={v} />);
      const lc = html.toLowerCase();
      expect(lc).not.toContain("deepstream");
      expect(lc).not.toContain("nvdsanalytics");
      expect(lc).not.toContain("gstreamer");
      expect(lc).not.toContain("pyds");
    }
  });
});
