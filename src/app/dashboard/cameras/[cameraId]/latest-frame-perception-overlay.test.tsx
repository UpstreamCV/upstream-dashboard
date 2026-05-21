import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { UpstreamApiError } from "@/lib/api/errors";
import type {
  LatestFrame,
  LatestPerceptionRecord,
  LatestPerceptionResponse,
} from "@/lib/api/types";

// `useUpstreamList` is an SWR hook (browser data fetching). Stub it so this
// stays a pure-snapshot test of the overlay card's state branching — no real
// network, no jsdom. The card calls the hook twice (latest-frame + perception);
// the mock routes by path. `vi.hoisted` makes the mock fn available to the
// hoisted `vi.mock`.
const { useUpstreamListMock } = vi.hoisted(() => ({
  useUpstreamListMock: vi.fn(),
}));

vi.mock("@/lib/api/use-list", () => ({
  useUpstreamList: useUpstreamListMock,
}));

// Imported AFTER the mock so the stubbed module is the one resolved.
const { LatestFramePerceptionOverlay } = await import(
  "./latest-frame-perception-overlay"
);

const FRAME: LatestFrame = {
  storage_key: "snapshots/cam-1/latest.jpg",
  bytes: 102_400,
  width: 1280,
  height: 720,
  captured_at: "2026-05-21T12:00:00Z",
  created_at: "2026-05-21T12:00:01Z",
  signed_url: "https://storage.test/frame.jpg",
  expires_at: "2026-05-21T13:00:00Z",
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

const FULL_SNAPSHOT = perceptionRecord({
  frame: { width: 1280, height: 720, frame_num: 12, fps: 1 },
  objects: [
    {
      track_id: "3",
      class_id: 0,
      label: "person",
      confidence: 0.42,
      bbox: { x: 595.95, y: 86.69, w: 340.3, h: 631.99 },
      bbox_normalized: { x: 0.46, y: 0.12, w: 0.27, h: 0.88 },
      roi_labels: ["entry-roi"],
    },
  ],
  geometry: {
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
  },
});

interface SwrShape<T> {
  data?: T;
  error?: unknown;
  isValidating?: boolean;
}

function mockSWR(opts: {
  frame?: SwrShape<LatestFrame>;
  perception?: SwrShape<LatestPerceptionResponse>;
}) {
  useUpstreamListMock.mockImplementation((path: string) => {
    const v = path.includes("perception") ? opts.perception : opts.frame;
    return {
      data: v?.data,
      error: v?.error,
      isValidating: v?.isValidating ?? false,
      mutate: vi.fn(() => Promise.resolve()),
    };
  });
}

function render() {
  return renderToStaticMarkup(
    <LatestFramePerceptionOverlay
      cameraId="cam-1"
      initialFrame={null}
      initialPerception={null}
    />,
  );
}

function notFound(code: string): UpstreamApiError {
  return new UpstreamApiError(404, { error: { code, message: "not found" } });
}

describe("LatestFramePerceptionOverlay", () => {
  test("renders the overlay when a frame and a perception snapshot exist", () => {
    mockSWR({
      frame: { data: FRAME },
      perception: { data: { snapshot: FULL_SNAPSHOT } },
    });
    const html = render();
    expect(html).toContain('aria-label="Perception overlay"');
    expect(html).toContain("<img");
    expect(html).toContain("person #3");
    expect(html).toContain("entry-line");
  });

  test("shows the empty state when there is no latest frame", () => {
    mockSWR({ frame: {}, perception: {} });
    const html = render();
    expect(html).toContain("No latest frame available");
  });

  test("shows the frame with a message when no perception snapshot exists", () => {
    mockSWR({
      frame: { data: FRAME },
      perception: { error: notFound("perception_snapshot_not_found") },
    });
    const html = render();
    expect(html).toContain("<img");
    expect(html).toContain("No perception snapshot yet");
    expect(html).not.toContain('aria-label="Perception overlay"');
  });

  test("renders geometry-only with a message when the snapshot has no objects", () => {
    const noObjects = perceptionRecord({
      frame: { width: 1280, height: 720 },
      objects: [],
      geometry: FULL_SNAPSHOT.snapshot.geometry,
    });
    mockSWR({
      frame: { data: FRAME },
      perception: { data: { snapshot: noObjects } },
    });
    const html = render();
    expect(html).toContain('aria-label="Perception overlay"');
    expect(html).toContain("No objects in latest snapshot");
  });

  test("shows an error state when the latest-frame request fails", () => {
    mockSWR({
      frame: {
        error: new UpstreamApiError(500, {
          error: { code: "internal_error", message: "boom" },
        }),
      },
      perception: {},
    });
    const html = render();
    expect(html).toContain("load the latest frame");
  });

  test("warns when the snapshot is missing frame dimensions", () => {
    const noDims = perceptionRecord({
      frame: {},
      objects: FULL_SNAPSHOT.snapshot.objects,
      geometry: FULL_SNAPSHOT.snapshot.geometry,
    });
    mockSWR({
      frame: { data: FRAME },
      perception: { data: { snapshot: noDims } },
    });
    const html = render();
    expect(html).toContain("frame dimensions are missing");
    expect(html).not.toContain('aria-label="Perception overlay"');
  });

  test("always renders the toolbar controls", () => {
    mockSWR({ frame: {}, perception: {} });
    const html = render();
    expect(html).toContain("perception overlay");
    expect(html).toContain("Boxes");
    expect(html).toContain("Labels");
    expect(html).toContain("Geometry");
    expect(html).toContain("Refresh");
  });
});
