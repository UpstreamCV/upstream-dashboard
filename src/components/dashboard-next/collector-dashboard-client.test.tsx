import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { CollectorStatus, ReliabilitySource } from "@/lib/api/types";

vi.mock("@/components/data/relative-time", () => ({
  RelativeTime: ({ value }: { value: string | null }) => value ?? "—",
}));

// useUpstreamList returns no live data here, so the client falls back to the
// server-fetched initial props (initialStatus / initialSources).
const useUpstreamList = vi.fn(() => ({ data: undefined }));
vi.mock("@/lib/api/use-list", () => ({
  useUpstreamList: (...args: unknown[]) => useUpstreamList(...args),
}));

import { CollectorDashboardClient } from "./collector-dashboard-client";

const EMPTY_STATUS: CollectorStatus = {
  last_received_at: null,
  recent_batch_count: 0,
  recent_observation_count: 0,
  active_source_count: 0,
  open_issue_count: 0,
  latest_collector_heartbeat: null,
  sources: [],
  recent_batches: [],
  source_health_counts: {
    healthy: 0,
    delayed: 0,
    silent: 0,
    collector_offline: 0,
    unknown: 0,
    disabled: 0,
  },
};

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
    open_issue_count: 0,
    status_hint: "active",
    health_status: "healthy",
    health_reason: null,
    health_message: null,
    liveness_enabled: true,
    expected_interval_seconds: 600,
    liveness_grace_seconds: 300,
    last_liveness_checked_at: "2026-06-24T18:00:00Z",
    last_health_status_changed_at: "2026-06-24T18:00:00Z",
    liveness_silence_started_at: null,
    last_liveness_issue_id: null,
    ...overrides,
  };
}

afterEach(() => useUpstreamList.mockClear());

describe("CollectorDashboardClient", () => {
  test("renders the registry Sources table from source-registry data", () => {
    const html = renderToStaticMarkup(
      <CollectorDashboardClient
        initialStatus={{ ...EMPTY_STATUS, last_received_at: "2026-06-24T18:00:00Z" }}
        initialSources={[source()]}
      />,
    );
    // The stable registry table (kind/model), not the managed-camera pipeline.
    expect(html).toContain("edge-box-4");
    expect(html).toContain("External source");
    expect(html).toContain("detector-v1");
    expect(html).not.toContain("managed camera pipeline");
    // It polls both the status and the M2a source registry endpoints.
    const paths = useUpstreamList.mock.calls.map((c) => c[0]);
    expect(paths).toContain("/v1/reliability/collector-status");
    expect(paths).toContain("/v1/reliability/sources");
  });

  test("renders the source-health summary when counts are present", () => {
    const html = renderToStaticMarkup(
      <CollectorDashboardClient
        initialStatus={{
          ...EMPTY_STATUS,
          last_received_at: "2026-06-24T18:00:00Z",
          source_health_counts: {
            ...EMPTY_STATUS.source_health_counts,
            healthy: 2,
            silent: 1,
          },
        }}
        initialSources={[source()]}
      />,
    );
    expect(html).toContain("Healthy sources");
    expect(html).toContain("Silent sources");
  });

  test("shows the empty state when no data has arrived", () => {
    const html = renderToStaticMarkup(
      <CollectorDashboardClient initialStatus={EMPTY_STATUS} initialSources={[]} />,
    );
    expect(html).toContain("No observations received yet");
  });
});
