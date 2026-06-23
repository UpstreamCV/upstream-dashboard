import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { ReliabilityIssue } from "@/lib/api/types";

vi.mock("@/components/data/relative-time", () => ({
  RelativeTime: ({ value }: { value: string | null }) => value ?? "—",
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/app/(dash)/(app)/(fleet)/agents/collector/actions", () => ({
  resolveReliabilityIssueAction: vi.fn(),
}));

const useUpstreamList = vi.fn();
vi.mock("@/lib/api/use-list", () => ({
  useUpstreamList: (...args: unknown[]) => useUpstreamList(...args),
}));

import { CollectorIssuesClient } from "./collector-issues-client";

function issue(over: Partial<ReliabilityIssue> = {}): ReliabilityIssue {
  return {
    id: "i-1",
    camera_id: null,
    source_batch_id: null,
    external_camera_key: "dock-12",
    issue_type: "event_count_drop",
    category: "count",
    severity: "warning",
    status: "open",
    title: "Event rate dropped for 'forklift'",
    message: "Saw 0 forklift events in the last 10 min.",
    likely_cause: null,
    recommended_action: "Check the source pipeline.",
    evidence: { event_name: "forklift", current_count: 0, api_token: "ups_secret", source_id: "x" },
    dedupe_key: "external:dock-12:event_count_drop:forklift",
    detector_version: "reliability.observations.v0.1",
    source_observation_ids: null,
    first_seen_at: "2026-06-23T17:00:00Z",
    last_seen_at: "2026-06-23T18:00:00Z",
    resolved_at: null,
    resolved_reason: null,
    created_at: "2026-06-23T17:00:00Z",
    updated_at: "2026-06-23T18:00:00Z",
    ...over,
  };
}

describe("CollectorIssuesClient", () => {
  test("renders open issues with a resolve button and safe evidence", () => {
    useUpstreamList.mockReturnValue({ data: { issues: [issue()] }, mutate: vi.fn() });
    const html = renderToStaticMarkup(
      <CollectorIssuesClient initialIssues={[issue()]} canResolve />,
    );
    expect(html).toContain("Observation Issues");
    expect(html).toContain("Event rate dropped");
    expect(html).toContain("Recommended: Check the source pipeline.");
    // The resolve action button (distinct from the "Resolved" tab).
    expect(html).toContain("Resolve</button>");
    // Safe evidence shown; secret-ish / id keys filtered out.
    expect(html).toContain("forklift");
    expect(html).not.toContain("ups_secret");
    expect(html).not.toContain("source_id");
  });

  test("hides the resolve button without permission", () => {
    useUpstreamList.mockReturnValue({ data: { issues: [issue()] }, mutate: vi.fn() });
    const html = renderToStaticMarkup(
      <CollectorIssuesClient initialIssues={[issue()]} canResolve={false} />,
    );
    expect(html).not.toContain("Resolve</button>"); // resolve action button absent
    expect(html).toContain("Resolved</button>"); // the tab still renders
  });

  test("empty state when there are no issues", () => {
    useUpstreamList.mockReturnValue({ data: { issues: [] }, mutate: vi.fn() });
    const html = renderToStaticMarkup(
      <CollectorIssuesClient initialIssues={[]} canResolve />,
    );
    expect(html).toContain("No open issues");
  });
});
