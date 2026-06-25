import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type {
  CollectorBatch,
  ReliabilitySource,
  SourceHealthStatus,
} from "@/lib/api/types";

vi.mock("@/components/data/relative-time", () => ({
  RelativeTime: ({ value }: { value: string | null }) => value ?? "—",
}));
// The Sources table now renders the Configure modal, which imports the server
// action + sonner — stub both so the static render doesn't pull the server-only
// API chain.
vi.mock("@/app/(dash)/(app)/(fleet)/agents/collector/actions", () => ({
  updateSourceLivenessAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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

function renderSources(
  sources: ReliabilitySource[],
  canConfigure = true,
): string {
  return renderToStaticMarkup(
    <CollectorSourcesTable
      sources={sources}
      canConfigure={canConfigure}
      onConfigured={() => {}}
    />,
  );
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
    expect(renderSources([])).toContain("No sources");
  });

  test("clarifies sources are not managed Upstream cameras", () => {
    expect(renderSources([])).toContain("not managed Upstream cameras");
  });

  test("renders an external-source row with kind, health, expected, model", () => {
    const html = renderSources([source()]);
    expect(html).toContain("edge-box-4");
    expect(html).toContain("dock-12");
    expect(html).toContain("External source");
    expect(html).toContain("Healthy"); // real M2b health badge
    expect(html).toContain("Every 10m"); // expected (600s) + grace
    expect(html).toContain("5m grace");
    expect(html).toContain("detector-v1");
  });

  test("renders a health badge for every state", () => {
    const states: SourceHealthStatus[] = [
      "healthy",
      "delayed",
      "silent",
      "collector_offline",
      "unknown",
      "disabled",
    ];
    const html = renderSources(
      states.map((h, i) => source({ id: `s-${i}`, health_status: h })),
    );
    expect(html).toContain("Healthy");
    expect(html).toContain("Delayed");
    expect(html).toContain("Silent");
    expect(html).toContain("Collector offline");
    expect(html).toContain("Unknown");
    expect(html).toContain("Disabled");
  });

  test("disabled liveness shows Off for the expected cadence", () => {
    const html = renderSources([
      source({ liveness_enabled: false, health_status: "disabled" }),
    ]);
    expect(html).toContain("Off");
  });

  test("shows a Configure action when the user can manage", () => {
    expect(renderSources([source()], true)).toContain("Configure");
  });

  test("hides the Configure action when the user cannot manage", () => {
    expect(renderSources([source()], false)).not.toContain("Configure");
  });

  test("renders a collector row cleanly (null external key, Collector kind)", () => {
    const html = renderSources([
      source({
        id: "s-2",
        external_camera_key: null,
        display_name: "edge-box-4",
        source_kind: "collector",
        last_model_name: null,
        last_model_version: null,
      }),
    ]);
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
