// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  connectPerceptionStream,
  parsePerceptionWsSnapshot,
  type PerceptionStreamStatus,
} from "./perception-ws-client";

// --- fake WebSocket -----------------------------------------------------------

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  url: string;
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  // test drivers
  serverOpen() {
    this.onopen?.();
  }
  serverSend(data: unknown) {
    this.onmessage?.({ data });
  }
  serverClose(code: number) {
    this.onclose?.({ code });
  }
}

const factory = (url: string) =>
  new FakeWebSocket(url) as unknown as WebSocket;

const SNAPSHOT_FRAME = JSON.stringify({
  type: "snapshot",
  seq: 1,
  camera_id: "cam-1",
  stream_session_id: "sess-1",
  processor_id: "proc-1",
  package_id: "pkg-1",
  observed_at: "2026-06-11T17:03:22.142Z",
  snapshot: { frame: { width: 1280, height: 720 }, objects: [] },
});

function makeCreds(token = "tok-1") {
  return { token, wsUrl: "ws://127.0.0.1:18990/v1/subscribe" };
}

/** Let queued microtasks (the async connect loop) run. */
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeWebSocket.instances = [];
});

afterEach(() => {
  vi.useRealTimers();
});

// --- parsePerceptionWsSnapshot --------------------------------------------------

describe("parsePerceptionWsSnapshot", () => {
  test("parses a valid snapshot frame", () => {
    const msg = parsePerceptionWsSnapshot(SNAPSHOT_FRAME);
    expect(msg).not.toBeNull();
    expect(msg!.seq).toBe(1);
    expect(msg!.camera_id).toBe("cam-1");
    expect(msg!.snapshot).toEqual({
      frame: { width: 1280, height: 720 },
      objects: [],
    });
  });

  test.each([
    ["non-string", 42],
    ["malformed json", "{nope"],
    ["hello frame", JSON.stringify({ type: "hello", camera_id: "cam-1" })],
    ["bye frame", JSON.stringify({ type: "bye", code: "token_expired" })],
    ["missing seq", JSON.stringify({ type: "snapshot", camera_id: "c", observed_at: "t", snapshot: {} })],
    ["missing camera", JSON.stringify({ type: "snapshot", seq: 1, observed_at: "t", snapshot: {} })],
    ["non-object snapshot", JSON.stringify({ type: "snapshot", seq: 1, camera_id: "c", observed_at: "t", snapshot: 7 })],
  ])("returns null for %s", (_name, raw) => {
    expect(parsePerceptionWsSnapshot(raw)).toBeNull();
  });
});

// --- connectPerceptionStream -----------------------------------------------------

describe("connectPerceptionStream", () => {
  test("mints a token, connects with it, and forwards snapshot frames", async () => {
    const onSnapshot = vi.fn();
    const statuses: PerceptionStreamStatus[] = [];
    const getToken = vi.fn().mockResolvedValue(makeCreds("secret-token"));

    const handle = connectPerceptionStream({
      getToken,
      onSnapshot,
      onStatus: (s) => statuses.push(s),
      webSocketFactory: factory,
    });
    await flush();

    expect(getToken).toHaveBeenCalledTimes(1);
    const ws = FakeWebSocket.instances[0];
    expect(ws.url).toBe(
      "ws://127.0.0.1:18990/v1/subscribe?token=secret-token",
    );

    ws.serverOpen();
    ws.serverSend(SNAPSHOT_FRAME);
    ws.serverSend(JSON.stringify({ type: "hello", camera_id: "cam-1" })); // ignored

    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(onSnapshot.mock.calls[0][0].camera_id).toBe("cam-1");
    expect(statuses).toEqual(["connecting", "open"]);

    handle.close();
    expect(ws.closed).toBe(true);
  });

  test("token rotation close (1000) reconnects with a fresh token, no backoff growth", async () => {
    const getToken = vi
      .fn()
      .mockResolvedValueOnce(makeCreds("tok-1"))
      .mockResolvedValueOnce(makeCreds("tok-2"));
    const handle = connectPerceptionStream({
      getToken,
      onSnapshot: vi.fn(),
      webSocketFactory: factory,
    });
    await flush();

    FakeWebSocket.instances[0].serverOpen();
    FakeWebSocket.instances[0].serverClose(1000); // bye(token_expired) path

    await vi.advanceTimersByTimeAsync(600); // first-rung backoff is <= 500ms
    expect(getToken).toHaveBeenCalledTimes(2);
    expect(FakeWebSocket.instances[1].url).toContain("token=tok-2");
    handle.close();
  });

  test("4401 (invalid token) also re-mints", async () => {
    const getToken = vi.fn().mockResolvedValue(makeCreds());
    const handle = connectPerceptionStream({
      getToken,
      onSnapshot: vi.fn(),
      webSocketFactory: factory,
    });
    await flush();
    FakeWebSocket.instances[0].serverClose(4401);
    await vi.advanceTimersByTimeAsync(600);
    expect(getToken).toHaveBeenCalledTimes(2);
    handle.close();
  });

  test("getToken resolving null stops permanently with status unavailable", async () => {
    const statuses: PerceptionStreamStatus[] = [];
    const getToken = vi.fn().mockResolvedValue(null);
    const handle = connectPerceptionStream({
      getToken,
      onSnapshot: vi.fn(),
      onStatus: (s) => statuses.push(s),
      webSocketFactory: factory,
    });
    await flush();

    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(statuses).toEqual(["connecting", "unavailable"]);

    // No retries, ever — advance far past any backoff rung.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(getToken).toHaveBeenCalledTimes(1);
    handle.close();
  });

  test("getToken throwing is transient: retried with backoff", async () => {
    const getToken = vi
      .fn()
      .mockRejectedValueOnce(new Error("network blip"))
      .mockResolvedValue(makeCreds());
    const handle = connectPerceptionStream({
      getToken,
      onSnapshot: vi.fn(),
      webSocketFactory: factory,
    });
    await flush();
    expect(FakeWebSocket.instances).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(600);
    expect(getToken).toHaveBeenCalledTimes(2);
    expect(FakeWebSocket.instances).toHaveLength(1);
    handle.close();
  });

  test("abnormal closes back off exponentially (bounded), and a delivered frame resets the ladder", async () => {
    const getToken = vi.fn().mockResolvedValue(makeCreds());
    const handle = connectPerceptionStream({
      getToken,
      onSnapshot: vi.fn(),
      webSocketFactory: factory,
    });
    await flush();

    // Ladder up: each abnormal close doubles the base (500ms -> 1s -> 2s...).
    FakeWebSocket.instances[0].serverClose(1006);
    await vi.advanceTimersByTimeAsync(600);
    expect(FakeWebSocket.instances).toHaveLength(2);

    FakeWebSocket.instances[1].serverClose(1006);
    // Second rung base is 1000ms; jitter floor is 500ms. 400ms is too soon...
    await vi.advanceTimersByTimeAsync(400);
    const countBefore = FakeWebSocket.instances.length;
    await vi.advanceTimersByTimeAsync(800); // ...but by 1.2s it must have fired
    expect(FakeWebSocket.instances.length).toBeGreaterThan(countBefore);

    // A delivered frame resets the ladder: next close retries fast again.
    const ws = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
    ws.serverOpen();
    ws.serverSend(SNAPSHOT_FRAME);
    ws.serverClose(1006);
    const count = FakeWebSocket.instances.length;
    await vi.advanceTimersByTimeAsync(600); // back at the 500ms rung
    expect(FakeWebSocket.instances.length).toBe(count + 1);
    handle.close();
  });

  test("close() during the token fetch never opens a socket", async () => {
    let resolveToken: (v: ReturnType<typeof makeCreds>) => void = () => {};
    const getToken = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveToken = resolve;
      }),
    );
    const handle = connectPerceptionStream({
      getToken,
      onSnapshot: vi.fn(),
      webSocketFactory: factory,
    });
    await flush();
    handle.close();
    resolveToken(makeCreds());
    await flush();
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  test("no callbacks after close()", async () => {
    const onSnapshot = vi.fn();
    const statuses: PerceptionStreamStatus[] = [];
    const handle = connectPerceptionStream({
      getToken: vi.fn().mockResolvedValue(makeCreds()),
      onSnapshot,
      onStatus: (s) => statuses.push(s),
      webSocketFactory: factory,
    });
    await flush();
    const ws = FakeWebSocket.instances[0];
    ws.serverOpen();
    handle.close();
    const statusCount = statuses.length;
    ws.serverSend(SNAPSHOT_FRAME);
    ws.serverClose(1006);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(statuses.length).toBe(statusCount);
    expect(FakeWebSocket.instances).toHaveLength(1); // no reconnect attempts
  });
});
