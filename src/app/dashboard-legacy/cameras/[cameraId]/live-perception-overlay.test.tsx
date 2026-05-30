import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { UpstreamApiError } from "@/lib/api/errors";
import type {
  LatestPerceptionRecord,
  LatestPerceptionResponse,
  StreamParams,
} from "@/lib/api/types";

// `useUpstreamList` is an SWR hook — stub it so this is a pure-snapshot test of
// the live overlay's state branching (no network, no jsdom).
const { useUpstreamListMock } = vi.hoisted(() => ({
  useUpstreamListMock: vi.fn(),
}));

vi.mock("@/lib/api/use-list", () => ({
  useUpstreamList: useUpstreamListMock,
}));

// Stub the WebRTC player. The real one does RTCPeerConnection work and, in a
// node env, renders an "unsupported" branch that drops the overlay slot. The
// stub just echoes the `overlay` prop so the SVG layer is observable here.
vi.mock("@/components/stream/live-stream-player", () => ({
  LiveStreamPlayer: ({ overlay }: { overlay?: React.ReactNode }) => (
    <div data-mock-player="">{overlay}</div>
  ),
}));

const { LivePerceptionOverlay } = await import("./live-perception-overlay");

const APPROVED: StreamParams = {
  width: 1280,
  height: 720,
  fps: 1,
  codec: "h264",
  bitrate_kbps: 2000,
  latency_mode: "balanced",
};

function perceptionRecord(
  snapshot: LatestPerceptionRecord["snapshot"],
): LatestPerceptionRecord {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    camera_id: "cam-1",
    stream_session_id: "00000000-0000-0000-0000-000000000002",
    processor_id: "proc-1",
    package_id: "pkg-1",
    observed_at: "2026-05-21T12:00:00Z",
    updated_at: "2026-05-21T12:00:01Z",
    snapshot,
  };
}

const GEOMETRY = {
  rois: [
    {
      id: "entry-roi",
      label: "entry-roi",
      points: [
        { x: 100, y: 100 },
        { x: 400, y: 100 },
        { x: 400, y: 400 },
      ],
    },
  ],
  lines: [
    {
      id: "entry-line",
      label: "entry-line",
      points: [
        { x: 0, y: 360 },
        { x: 1280, y: 360 },
      ],
    },
  ],
};

const FULL = perceptionRecord({
  frame: { width: 1280, height: 720, frame_num: 12, fps: 1 },
  objects: [
    {
      track_id: "3",
      class_id: 2,
      label: "person",
      confidence: 0.42,
      bbox: { x: 595.95, y: 86.69, w: 340.3, h: 631.99 },
      bbox_normalized: null,
      roi_labels: ["entry-roi"],
    },
  ],
  geometry: GEOMETRY,
});

interface SwrShape {
  data?: LatestPerceptionResponse;
  error?: unknown;
  isValidating?: boolean;
}

function mockSWR(v: SwrShape) {
  useUpstreamListMock.mockReturnValue({
    data: v.data,
    error: v.error,
    isValidating: v.isValidating ?? false,
    mutate: vi.fn(() => Promise.resolve()),
  });
}

function render() {
  return renderToStaticMarkup(
    <LivePerceptionOverlay
      sessionId="sess-1"
      cameraId="cam-1"
      approved={APPROVED}
      initialPerception={null}
    />,
  );
}

function notFound(): UpstreamApiError {
  return new UpstreamApiError(404, {
    error: { code: "perception_snapshot_not_found", message: "not found" },
  });
}

beforeEach(() => {
  useUpstreamListMock.mockClear();
});

describe("LivePerceptionOverlay", () => {
  test("renders the live player and the SVG overlay when a snapshot is present", () => {
    mockSWR({ data: { snapshot: FULL } });
    const html = render();
    expect(html).toContain("data-mock-player");
    expect(html).toContain('aria-label="Perception overlay"');
    expect(html).toContain("person #3");
  });

  test("keeps the live player and shows a message when no snapshot exists", () => {
    mockSWR({ error: notFound() });
    const html = render();
    expect(html).toContain("data-mock-player");
    expect(html).not.toContain('aria-label="Perception overlay"');
    expect(html).toContain("No perception snapshot yet");
  });

  test("draws geometry-only with a message when the snapshot has no objects", () => {
    const noObjects = perceptionRecord({
      frame: { width: 1280, height: 720 },
      objects: [],
      geometry: GEOMETRY,
    });
    mockSWR({ data: { snapshot: noObjects } });
    const html = render();
    expect(html).toContain('aria-label="Perception overlay"');
    expect(html).toContain("No objects in latest snapshot");
  });

  test("disables the overlay with a warning when frame dimensions are missing", () => {
    const noDims = perceptionRecord({
      frame: {},
      objects: FULL.snapshot.objects,
      geometry: GEOMETRY,
    });
    mockSWR({ data: { snapshot: noDims } });
    const html = render();
    expect(html).toContain("data-mock-player");
    expect(html).not.toContain('aria-label="Perception overlay"');
    expect(html).toContain("frame dimensions are missing");
  });

  test("shows a non-blocking error when the perception request fails", () => {
    mockSWR({
      error: new UpstreamApiError(500, {
        error: { code: "internal_error", message: "boom" },
      }),
    });
    const html = render();
    // Live video unaffected — the player still renders.
    expect(html).toContain("data-mock-player");
    expect(html).toContain("load the perception snapshot");
  });

  test("always renders the overlay controls", () => {
    mockSWR({});
    const html = render();
    expect(html).toContain("live perception overlay");
    expect(html).toContain("Boxes");
    expect(html).toContain("Labels");
    expect(html).toContain("Geometry");
    expect(html).toContain("All confidence");
    expect(html).toContain("Refresh");
  });

  test("requests the latest-perception endpoint through the proxy path", () => {
    mockSWR({ data: { snapshot: FULL } });
    render();
    expect(useUpstreamListMock).toHaveBeenCalled();
    expect(useUpstreamListMock.mock.calls[0][0]).toBe(
      "/v1/cameras/cam-1/perception/latest",
    );
  });
});
