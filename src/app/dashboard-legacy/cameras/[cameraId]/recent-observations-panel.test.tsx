import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { ObservationRecord } from "@/lib/api/types";

// `useUpstreamList` is an SWR hook (browser data fetching). Stub it so this
// stays a pure-snapshot test of the panel's state branching — no real network,
// no jsdom. `vi.hoisted` makes the mock fn available to the hoisted `vi.mock`.
const { useUpstreamListMock } = vi.hoisted(() => ({
  useUpstreamListMock: vi.fn(),
}));

vi.mock("@/lib/api/use-list", () => ({
  useUpstreamList: useUpstreamListMock,
}));

// Imported AFTER the mock so the stubbed module is the one resolved.
const { RecentObservationsPanel } = await import("./recent-observations-panel");

function makeObservation(
  over: Partial<ObservationRecord> = {},
): ObservationRecord {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    camera_id: "cam-1",
    stream_session_id: "22222222-2222-2222-2222-222222222222",
    processor_id: "proc-9",
    package_id: "pkg-1",
    type: "processor.line_crossing",
    payload: { line_label: "entry-line", cumulative_count: 2, count_delta: 1 },
    observed_at: "2026-05-21T12:00:00Z",
    created_at: "2026-05-21T12:00:01Z",
    ...over,
  };
}

function mockSWR(value: {
  data?: { observations: ObservationRecord[] };
  error?: unknown;
  isValidating?: boolean;
}) {
  useUpstreamListMock.mockReturnValue({
    data: value.data,
    error: value.error,
    isValidating: value.isValidating ?? false,
    mutate: vi.fn(() => Promise.resolve()),
  });
}

function render() {
  return renderToStaticMarkup(
    <RecentObservationsPanel cameraId="cam-1" initialObservations={[]} />,
  );
}

describe("RecentObservationsPanel", () => {
  test("renders observation rows with type + summary + short ids", () => {
    mockSWR({ data: { observations: [makeObservation()] } });
    const html = render();
    expect(html).toContain("line_crossing");
    expect(html).toContain("total 2");
    expect(html).toContain("22222222"); // short stream_session_id
  });

  test("renders the empty state when there are no observations", () => {
    mockSWR({ data: { observations: [] } });
    const html = render();
    expect(html).toContain("No processor observations");
  });

  test("renders the error state with a retry control", () => {
    mockSWR({ data: undefined, error: new Error("boom") });
    const html = render();
    expect(html).toContain("load recent observations");
    expect(html).toContain("Retry");
  });

  test("always renders the toolbar controls", () => {
    mockSWR({ data: { observations: [] } });
    const html = render();
    expect(html).toContain("All types");
    expect(html).toContain("Refresh");
  });
});
