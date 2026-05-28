import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type {
  LatestPerceptionRecord,
  StreamParams,
} from "@/lib/api/types";

// SWR + WebRTC + Server Action stubs. Same pattern as the legacy overlay's
// vitest setup: mock @/lib/api/use-list so the hook returns deterministic
// data; mock the player so the overlay SVG slot is observable.

const { useUpstreamListMock } = vi.hoisted(() => ({
  useUpstreamListMock: vi.fn(),
}));
vi.mock("@/lib/api/use-list", () => ({
  useUpstreamList: useUpstreamListMock,
}));

vi.mock("./live-stream-player-next", () => ({
  LiveStreamPlayerNext: ({ overlay }: { overlay?: React.ReactNode }) => (
    <div data-mock-player="">{overlay}</div>
  ),
}));

// The Realtime subscription effect never runs under renderToStaticMarkup
// (effects don't fire on the server), but importing the supabase client pulls
// in @/lib/env, which throws when NEXT_PUBLIC_* are absent in the test env.
// Stub the module so the import is inert.
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
    }),
    removeChannel: () => {},
  }),
}));

const { LivePerceptionOverlayNext } = await import("./live-perception-overlay-next");

const APPROVED: StreamParams = {
  width: 1280,
  height: 720,
  fps: 1,
  codec: "h264",
  bitrate_kbps: 2000,
  latency_mode: "balanced",
};

function record(
  snapshot: LatestPerceptionRecord["snapshot"],
  observedAt = "2026-05-28T12:00:00Z",
): LatestPerceptionRecord {
  return {
    id: "perception-1",
    camera_id: "cam-1",
    stream_session_id: "ssn-1",
    processor_id: "proc-1",
    package_id: "pkg-1",
    observed_at: observedAt,
    updated_at: observedAt,
    snapshot,
  };
}

const FRAME = { width: 1280, height: 720, frame_num: 1, fps: 1 };

beforeEach(() => {
  useUpstreamListMock.mockReset();
});

function setHookData(data: unknown, error: unknown = null): void {
  useUpstreamListMock.mockReturnValue({
    data,
    error,
    isValidating: false,
    mutate: vi.fn(),
  });
}

function render(opts: {
  initialPerception?: LatestPerceptionRecord | null;
  processingEnabled?: boolean;
  staleAfterSeconds?: number;
  now?: number;
}): string {
  return renderToStaticMarkup(
    <LivePerceptionOverlayNext
      sessionId="ssn-1"
      cameraId="cam-1"
      approved={APPROVED}
      initialPerception={opts.initialPerception ?? null}
      processingEnabled={opts.processingEnabled}
      staleAfterSeconds={opts.staleAfterSeconds}
      now={opts.now !== undefined ? () => opts.now! : undefined}
    />,
  );
}

import { beforeEach } from "vitest";

describe("LivePerceptionOverlayNext — happy path", () => {
  test("renders 'overlay 0.8s old' style age + object/geometry count", () => {
    const snap = {
      frame: FRAME,
      objects: [
        { label: "person", confidence: 0.82, track_id: "17", bbox: { x: 10, y: 10, w: 100, h: 200 } },
        { label: "person", confidence: 0.55, track_id: "18", bbox: { x: 200, y: 10, w: 80, h: 200 } },
      ],
      geometry: { rois: [], lines: [] },
    };
    const observedAt = "2026-05-28T12:00:00.000Z";
    const now = Date.parse("2026-05-28T12:00:00.800Z");
    setHookData({ snapshot: record(snap, observedAt) });
    const html = render({ now });
    expect(html).toContain("overlay 0.8s old");
    expect(html).toContain("2 objects");
    expect(html).toContain("0 geometry");
  });

  test("renders track id + confidence on box label via formatObjectLabel", () => {
    const snap = {
      frame: FRAME,
      objects: [
        { label: "person", confidence: 0.82, track_id: "17", bbox: { x: 10, y: 10, w: 100, h: 200 } },
      ],
      geometry: { rois: [], lines: [] },
    };
    setHookData({ snapshot: record(snap) });
    const html = render({ now: Date.parse("2026-05-28T12:00:01Z") });
    expect(html).toContain("person #17");
    expect(html).toContain("82%");
  });
});

describe("LivePerceptionOverlayNext — gap-polish empty states", () => {
  test("processing disabled + no snapshot -> 'Enable processing in Settings'", () => {
    setHookData(undefined);
    const html = render({ processingEnabled: false });
    expect(html).toContain(
      "Processing is disabled. Enable processing in Settings to see detections.",
    );
    // Must NOT fall back to the generic empty-state copy on this branch.
    expect(html).not.toContain("No perception data yet. Start processing");
  });

  test("processing enabled + no snapshot -> 'Start processing to see detections'", () => {
    setHookData(undefined);
    const html = render({ processingEnabled: true });
    expect(html).toContain(
      "No perception data yet. Start processing to see detections.",
    );
  });

  test("snapshot age > staleAfterSeconds -> stale warning", () => {
    const observedAt = "2026-05-28T12:00:00Z";
    const now = Date.parse("2026-05-28T12:00:30Z"); // 30s ago
    setHookData({ snapshot: record({ frame: FRAME, objects: [], geometry: {} }, observedAt) });
    const html = render({ now, staleAfterSeconds: 10 });
    expect(html).toContain(
      "Processor output is stale. Overlay may not reflect the current scene.",
    );
  });

  test("snapshot age <= staleAfterSeconds -> no stale warning", () => {
    const observedAt = "2026-05-28T12:00:00Z";
    const now = Date.parse("2026-05-28T12:00:08Z"); // 8s ago
    setHookData({ snapshot: record({ frame: FRAME, objects: [], geometry: {} }, observedAt) });
    const html = render({ now, staleAfterSeconds: 10 });
    expect(html).not.toContain("Processor output is stale");
  });

  test("recent snapshot with no objects -> 'No detections in latest perception snapshot.'", () => {
    setHookData({ snapshot: record({ frame: FRAME, objects: [], geometry: {} }) });
    const html = render({ now: Date.parse("2026-05-28T12:00:01Z") });
    expect(html).toContain("No detections in latest perception snapshot.");
  });

  test("processing-disabled gate beats stale gate when no snapshot exists", () => {
    setHookData(undefined);
    const html = render({ processingEnabled: false });
    expect(html).toContain("Enable processing in Settings");
    expect(html).not.toContain("Processor output is stale");
  });
});

describe("LivePerceptionOverlayNext — operator copy guard", () => {
  test("no runtime jargon leaks", () => {
    setHookData(undefined);
    const html = render({ processingEnabled: false }).toLowerCase();
    expect(html).not.toContain("deepstream");
    expect(html).not.toContain("nvdsanalytics");
    expect(html).not.toContain("gstreamer");
    expect(html).not.toContain("pyds");
  });
});
