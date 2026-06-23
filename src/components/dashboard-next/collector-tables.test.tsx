import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { CollectorBatch, CollectorSource } from "@/lib/api/types";

vi.mock("@/components/data/relative-time", () => ({
  RelativeTime: ({ value }: { value: string | null }) => value ?? "—",
}));

import { CollectorActivityTable } from "./collector-activity-table";
import { CollectorSourcesTable } from "./collector-sources-table";

const source: CollectorSource = {
  source: "edge-box-4",
  external_camera_key: "dock-12",
  last_seen_at: "2026-06-23T18:00:00Z",
  recent_observations: 1200,
  recent_events: 80,
  recent_detection_summaries: 112,
  open_issues: 1,
};

const batch: CollectorBatch = {
  id: "b-1",
  source: "edge-box-4",
  external_camera_key: "dock-12",
  observation_count: 120,
  status: "completed",
  received_at: "2026-06-23T18:00:00Z",
};

describe("CollectorSourcesTable", () => {
  test("empty state", () => {
    const html = renderToStaticMarkup(<CollectorSourcesTable sources={[]} />);
    expect(html).toContain("No sources");
  });

  test("renders a source row with counts", () => {
    const html = renderToStaticMarkup(<CollectorSourcesTable sources={[source]} />);
    expect(html).toContain("edge-box-4");
    expect(html).toContain("dock-12");
    expect(html).toContain("1,200");
  });
});

describe("CollectorActivityTable", () => {
  test("empty state", () => {
    const html = renderToStaticMarkup(<CollectorActivityTable batches={[]} />);
    expect(html).toContain("No batches");
  });

  test("renders a batch row with status", () => {
    const html = renderToStaticMarkup(<CollectorActivityTable batches={[batch]} />);
    expect(html).toContain("edge-box-4");
    expect(html).toContain("120");
    expect(html).toContain("completed");
  });
});
