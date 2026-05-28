import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type {
  ReliabilitySummary,
  ReliabilitySummaryStatus,
} from "@/lib/api/types";

// <RelativeTime /> is a Client Component that uses useSyncExternalStore +
// browser-only timers. In a Node SSR test it crashes on first render. Stub
// it to a static label so we can assert on layout + copy without dragging in
// the real client.
vi.mock("@/components/data/relative-time", () => ({
  RelativeTime: () => "<relative-time>",
}));

import { ReliabilitySummaryCard } from "./reliability-summary-card";

function summary(
  status: ReliabilitySummaryStatus,
  over: Partial<ReliabilitySummary> = {},
): ReliabilitySummary {
  return {
    camera_id: "22222222-2222-2222-2222-222222222222",
    status,
    highest_severity: over.highest_severity ?? null,
    open_findings_count: over.open_findings_count ?? 0,
    top_findings: over.top_findings ?? [],
    recommended_next_action: over.recommended_next_action ?? null,
    last_evaluated_at: "2026-05-28T15:00:00Z",
    ...over,
  };
}

describe("ReliabilitySummaryCard", () => {
  test("healthy → 'Healthy' header + no-active-findings copy, no stats grid", () => {
    const html = renderToStaticMarkup(
      <ReliabilitySummaryCard summary={summary("healthy")} />,
    );
    expect(html).toContain(">Healthy<");
    expect(html).toContain("No active reliability findings for this camera.");
    expect(html).not.toContain("Open findings");
    expect(html).not.toContain("Highest severity");
  });

  test("unknown → muted not-enough-data copy", () => {
    const html = renderToStaticMarkup(
      <ReliabilitySummaryCard summary={summary("unknown")} />,
    );
    expect(html).toContain(">Unknown<");
    expect(html).toContain("Not enough recent stream, processor, or perception data");
  });

  test("unavailable (null) → muted unavailable copy + refresh hint", () => {
    const html = renderToStaticMarkup(<ReliabilitySummaryCard summary={null} />);
    expect(html).toContain(">Unavailable<");
    expect(html).toContain("Try refreshing");
    expect(html).toContain("existing camera monitoring is unaffected");
  });

  test("info status → 'Info' header + stats grid", () => {
    const html = renderToStaticMarkup(
      <ReliabilitySummaryCard
        summary={summary("info", {
          highest_severity: "info",
          open_findings_count: 1,
          recommended_next_action: "Check the thing.",
        })}
      />,
    );
    expect(html).toContain(">Info<");
    expect(html).toContain("Open findings");
    expect(html).toContain(">1<");
    expect(html).toContain("Check the thing.");
  });

  test("needs_review with warning + recommended action renders the action block", () => {
    const html = renderToStaticMarkup(
      <ReliabilitySummaryCard
        summary={summary("needs_review", {
          highest_severity: "warning",
          open_findings_count: 2,
          recommended_next_action: "Improve lighting or test low-light package.",
        })}
      />,
    );
    expect(html).toContain(">Needs review<");
    expect(html).toContain(">Warning<");
    expect(html).toContain(">2<");
    expect(html).toContain("Improve lighting or test low-light package.");
  });

  test("critical status → 'Critical' header + danger-colored title", () => {
    const html = renderToStaticMarkup(
      <ReliabilitySummaryCard
        summary={summary("critical", {
          highest_severity: "critical",
          open_findings_count: 1,
          recommended_next_action: "Check processor worker health.",
        })}
      />,
    );
    expect(html).toContain(">Critical<");
    expect(html).toContain("#c0473b");
  });

  test("recommended action missing → no recommended-action block", () => {
    const html = renderToStaticMarkup(
      <ReliabilitySummaryCard
        summary={summary("needs_review", {
          highest_severity: "warning",
          open_findings_count: 1,
          recommended_next_action: null,
        })}
      />,
    );
    expect(html).toContain(">Needs review<");
    expect(html).not.toContain("recommended next action");
  });
});
