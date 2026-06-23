import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { CollectorStatus } from "@/lib/api/types";

vi.mock("@/components/data/relative-time", () => ({
  RelativeTime: ({ value }: { value: string | null }) => value ?? "—",
}));

import { CollectorStatusCards } from "./collector-status-cards";

function status(over: Partial<CollectorStatus> = {}): CollectorStatus {
  return {
    last_received_at: null,
    recent_batch_count: 0,
    recent_observation_count: 0,
    active_source_count: 0,
    open_issue_count: 0,
    latest_collector_heartbeat: null,
    sources: [],
    recent_batches: [],
    ...over,
  };
}

describe("CollectorStatusCards", () => {
  test("shows 'not reported yet' when there is no heartbeat", () => {
    const html = renderToStaticMarkup(<CollectorStatusCards status={status()} />);
    expect(html).toContain("Collector heartbeat");
    expect(html).toContain("not reported yet");
  });

  test("renders cloud-ingest counts", () => {
    const html = renderToStaticMarkup(
      <CollectorStatusCards
        status={status({
          recent_observation_count: 8000,
          active_source_count: 4,
          open_issue_count: 3,
        })}
      />,
    );
    expect(html).toContain("Recent observations");
    expect(html).toContain("8,000"); // toLocaleString
    expect(html).toContain("Open issues");
  });

  test("renders a heartbeat timestamp when present", () => {
    const html = renderToStaticMarkup(
      <CollectorStatusCards
        status={status({
          latest_collector_heartbeat: {
            observed_at: new Date().toISOString(),
            source: "edge-box-4",
            version: "1.2.3",
            running: true,
            cloud_reachable: true,
            spooled_batches: 0,
            spooled_observations: 0,
            uploaded_batches: 42,
            uploaded_observations: 8000,
            dropped_batches: 0,
            dropped_observations: 0,
            last_upload_at: null,
            last_error_code: null,
          },
        })}
      />,
    );
    expect(html).not.toContain("not reported yet");
  });
});
