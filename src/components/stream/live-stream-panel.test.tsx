import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { StreamSession, StreamSessionState } from "@/lib/api/types";

// `LiveStreamPanel` is a Server Component but it imports `LiveStreamPlayer`,
// which is `"use client"` and pulls in React hooks + browser globals. Stub it
// out so this test stays a pure-snapshot of the state-branching logic.
vi.mock("./live-stream-player", () => ({
  LiveStreamPlayer: (props: { sessionId: string }) =>
    `<live-stream-player sessionId=${props.sessionId}/>`,
}));

// Imported AFTER the mock above so the stubbed module is the one resolved.
const { LiveStreamPanel } = await import("./live-stream-panel");

function makeSession(state: StreamSessionState): StreamSession {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    account_id: "00000000-0000-0000-0000-000000000000",
    agent_id: "22222222-2222-2222-2222-222222222222",
    camera_id: "33333333-3333-3333-3333-333333333333",
    state,
    srt_url: "srt://localhost:18890?streamid=publish:sess_abc",
    streamid: "publish:sess_abc",
    expires_at: "2030-01-01T00:00:00Z",
    started_at: null,
    ended_at: null,
    requested: {
      width: 1280,
      height: 720,
      fps: 30,
      codec: "h264",
      bitrate_kbps: 3000,
      latency_mode: "balanced",
    },
    approved: {
      width: 1280,
      height: 720,
      fps: 30,
      codec: "h264",
      bitrate_kbps: 3000,
      latency_mode: "balanced",
    },
  };
}

describe("LiveStreamPanel", () => {
  test("null session → 'No session yet' with POST hint", () => {
    const html = renderToStaticMarkup(<LiveStreamPanel session={null} />);
    expect(html).toContain("No");
    expect(html).toContain("session");
    expect(html).toContain("POST /v1/stream-sessions/start");
    // Critically: must NOT render the player when there's no session.
    expect(html).not.toContain("live-stream-player");
  });

  test("approved (not yet streaming) → 'Waiting for stream'", () => {
    const html = renderToStaticMarkup(
      <LiveStreamPanel session={makeSession("approved")} />,
    );
    expect(html).toContain("Waiting for");
    expect(html).toContain("stream");
    expect(html).not.toContain("live-stream-player");
  });

  test("streaming → renders LiveStreamPlayer with sessionId", () => {
    const html = renderToStaticMarkup(
      <LiveStreamPanel session={makeSession("streaming")} />,
    );
    expect(html).toContain(
      "live-stream-player sessionId=11111111-1111-1111-1111-111111111111",
    );
  });

  test.each<StreamSessionState>(["ended", "expired", "failed"])(
    "%s → 'Stream ended/expired/failed' state, no player",
    (state) => {
      const html = renderToStaticMarkup(
        <LiveStreamPanel session={makeSession(state)} />,
      );
      expect(html).toContain("Stream");
      expect(html).toContain(state);
      expect(html).not.toContain("live-stream-player");
    },
  );

  test("failed includes the validation-panel hint", () => {
    const html = renderToStaticMarkup(
      <LiveStreamPanel session={makeSession("failed")} />,
    );
    expect(html).toContain("validation panel");
  });
});
