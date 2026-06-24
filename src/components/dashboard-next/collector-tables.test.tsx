import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { CollectorBatch, ReliabilitySource } from "@/lib/api/types";

vi.mock("@/components/data/relative-time", () => ({
  RelativeTime: ({ value }: { value: string | null }) => value ?? "—",
}));

import { CollectorActivityTable } from "./collector-activity-table";
import { CollectorSourcesTable } from "./collector-sources-table";

function source(overrides: Partial<ReliabilitySource> = {}): ReliabilitySource {
  return {
    id: "s-1",
    source: "edge-box-4",
    external_camera_key: "dock-12",
    display_name: "dock-12",
    source_kind: "external_camera",
    first_seen_at: "2026-06-24T17:00:00Z",
    last_seen_at: "2026-06-24T18:00:00Z",
    last_observation_at: "2026-06-24T18:00:00Z",
    last_event_at: "2026-06-24T18:00:00Z",
    last_detection_summary_at: "2026-06-24T18:00:00Z",
    last_collector_heartbeat_at: null,
    last_config_changed_at: null,
    last_model_name: "detector-v1",
    last_model_version: "2026-06-22",
    observation_count_total: 1200,
    event_count_total: 80,
    detection_summary_count_total: 112,
    collector_heartbeat_count_total: 0,
    config_changed_count_total: 0,
    open_issue_count: 1,
    status_hint: "active",
    ...overrides,
  };
}

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

  test("clarifies sources are not managed Upstream cameras", () => {
    const html = renderToStaticMarkup(<CollectorSourcesTable sources={[]} />);
    expect(html).toContain("not managed Upstream cameras");
  });

  test("renders an external-source row with kind, model, counts, status", () => {
    const html = renderToStaticMarkup(
      <CollectorSourcesTable sources={[source()]} />,
    );
    expect(html).toContain("edge-box-4");
    expect(html).toContain("dock-12");
    expect(html).toContain("External source");
    expect(html).toContain("active");
    expect(html).toContain("detector-v1");
    expect(html).toContain("2026-06-22");
    expect(html).toContain("112"); // detection summaries total
    expect(html).toContain("80"); // events total
  });

  test("renders a collector row cleanly (null external key, Collector kind)", () => {
    const html = renderToStaticMarkup(
      <CollectorSourcesTable
        sources={[
          source({
            id: "s-2",
            external_camera_key: null,
            display_name: "edge-box-4",
            source_kind: "collector",
            last_model_name: null,
            last_model_version: null,
          }),
        ]}
      />,
    );
    expect(html).toContain("Collector");
    expect(html).toContain("—"); // null external key + null model render as em dash
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
