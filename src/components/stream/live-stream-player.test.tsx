import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { StreamParams } from "@/lib/api/types";
import { LiveStreamPlayer } from "./live-stream-player";

const APPROVED: StreamParams = {
  width: 1280,
  height: 720,
  fps: 30,
  codec: "h264",
  bitrate_kbps: 3000,
  latency_mode: "balanced",
};

describe("LiveStreamPlayer", () => {
  test("server-renders the video tree deterministically (hydration-safe init)", () => {
    // Regression guard for React #418: the initial render must not branch on
    // `typeof RTCPeerConnection`. In a node env that global is absent — the
    // player must still render the video tree, not the "unsupported" message,
    // so the server render and the first client render agree.
    const html = renderToStaticMarkup(
      <LiveStreamPlayer
        sessionId="sess-1"
        cameraId="cam-1"
        approved={APPROVED}
      />,
    );
    expect(html).toContain("<video");
    expect(html).not.toContain("unavailable");
  });

  test("renders the overlay slot over the video", () => {
    const html = renderToStaticMarkup(
      <LiveStreamPlayer
        sessionId="sess-1"
        cameraId="cam-1"
        approved={APPROVED}
        overlay={<svg aria-label="test-overlay" />}
      />,
    );
    expect(html).toContain("<video");
    expect(html).toContain('aria-label="test-overlay"');
  });
});
