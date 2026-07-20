import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Camera, LatestFrame } from "@/lib/api/types";

// useUpstreamList is an SWR hook — stub it so this is a pure render test of the
// thumbnail wiring (no network, no jsdom).
const { useUpstreamListMock } = vi.hoisted(() => ({
  useUpstreamListMock: vi.fn(),
}));
vi.mock("@/lib/api/use-list", () => ({ useUpstreamList: useUpstreamListMock }));

// next/link → plain anchor so static render doesn't need the Next runtime.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

const { CameraGridCard } = await import("./camera-grid-card");

const CAMERA = {
  id: "cam-1",
  name: "Front Door",
  agent_id: "agt-1",
  external_id: "webcam-0",
  default_width: 1280,
  default_height: 720,
  default_fps: 30,
  default_codec: "h264",
  metadata: {},
  status: "streaming",
  updated_at: "2026-07-20T00:00:00Z",
} as unknown as Camera;

const FRAME: LatestFrame = {
  storage_key: "acct/cam-1/20260720/abc.jpg",
  bytes: 84_000,
  width: 1280,
  height: 720,
  captured_at: "2026-07-20T01:14:47Z",
  created_at: "2026-07-20T01:14:47Z",
  signed_url: "https://storage.example/sign/frame.jpg?token=abc.def-ghi",
  expires_at: "2026-07-20T01:15:47Z",
};

function render(props: Partial<Parameters<typeof CameraGridCard>[0]> = {}): string {
  return renderToStaticMarkup(
    <CameraGridCard
      camera={CAMERA}
      agentName="dock-pi-01"
      bucket="live"
      lastHeartbeat="2026-07-20T01:14:00Z"
      {...props}
    />,
  );
}

beforeEach(() => useUpstreamListMock.mockReset());

describe("CameraGridCard", () => {
  test("fetches this camera's latest-frame and uses the signed URL as the thumbnail", () => {
    useUpstreamListMock.mockReturnValue({ data: FRAME });
    const html = render();

    // The right per-camera endpoint was requested.
    expect(useUpstreamListMock.mock.calls[0][0]).toBe(
      "/v1/cameras/cam-1/latest-frame",
    );
    // The signed URL is painted as the (quoted) background image.
    expect(html).toContain("background-image");
    expect(html).toContain(FRAME.signed_url);
  });

  test("falls back to the placeholder (no background image) when there's no frame", () => {
    // 404 → SWR leaves data undefined (not retried).
    useUpstreamListMock.mockReturnValue({ data: undefined });
    const html = render();

    expect(html).not.toContain("background-image");
    // The lucide placeholder icon is rendered instead.
    expect(html).toContain("lucide-image");
  });

  test("demo mode skips the fetch (null key) and uses the bundled still", () => {
    useUpstreamListMock.mockReturnValue({ data: undefined });
    const html = render({ demo: true });

    expect(useUpstreamListMock.mock.calls[0][0]).toBeNull();
    expect(html).toContain("/demo/dock-frame.jpg");
    expect(html).toContain("background-image");
  });
});
