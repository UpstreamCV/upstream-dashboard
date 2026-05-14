import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  WhepNetworkError,
  WhepNotFoundError,
  WhepRejectedError,
  closeWhepSession,
  connectWhep,
} from "./whep-client";

// Minimal RTCPeerConnection mock. Only the surface the whep-client touches —
// adding more would obscure the test, not make it more correct.
class MockRTCPeerConnection {
  static instances: MockRTCPeerConnection[] = [];

  ontrack: ((e: RTCTrackEvent) => void) | null = null;
  setLocalDescription = vi.fn(async () => {});
  setRemoteDescription = vi.fn(async () => {});
  addTransceiver = vi.fn(() => ({}));
  createOffer = vi.fn(async () => ({ type: "offer", sdp: "v=0\r\no=offer\r\n" }));
  close = vi.fn();

  constructor() {
    MockRTCPeerConnection.instances.push(this);
  }
}

class MockMediaStream {
  tracks: MediaStreamTrack[] = [];
  addTrack(track: MediaStreamTrack) {
    this.tracks.push(track);
  }
  getTracks() {
    return this.tracks;
  }
}

beforeEach(() => {
  MockRTCPeerConnection.instances = [];
  // @ts-expect-error — patching the globals for the duration of the test.
  globalThis.RTCPeerConnection = MockRTCPeerConnection;
  // @ts-expect-error — see above.
  globalThis.MediaStream = MockMediaStream;
});

afterEach(() => {
  vi.restoreAllMocks();
  // @ts-expect-error — clean up the patched globals.
  delete globalThis.RTCPeerConnection;
  // @ts-expect-error — see above.
  delete globalThis.MediaStream;
  delete (globalThis as { fetch?: unknown }).fetch;
});

function mockFetch(response: Response | Error): void {
  globalThis.fetch = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  }) as typeof fetch;
}

function sdpResponse(
  status: number,
  body: string,
  location: string | null,
): Response {
  const headers: Record<string, string> = { "Content-Type": "application/sdp" };
  if (location !== null) headers["Location"] = location;
  return new Response(body, { status, headers });
}

describe("connectWhep — happy path", () => {
  test("returns pc + stream + resourceUrl when MediaMTX answers", async () => {
    mockFetch(sdpResponse(201, "v=0\r\no=answer\r\n", "abc-123"));

    const { pc, stream, resourceUrl } = await connectWhep({
      url: "/api/upstream/v1/stream-sessions/sess1/whep",
    });

    expect(MockRTCPeerConnection.instances).toHaveLength(1);
    const mock = MockRTCPeerConnection.instances[0];
    expect(mock.addTransceiver).toHaveBeenCalledTimes(2);
    expect(mock.addTransceiver).toHaveBeenNthCalledWith(1, "video", {
      direction: "recvonly",
    });
    expect(mock.addTransceiver).toHaveBeenNthCalledWith(2, "audio", {
      direction: "recvonly",
    });
    expect(mock.createOffer).toHaveBeenCalledOnce();
    expect(mock.setLocalDescription).toHaveBeenCalledOnce();
    expect(mock.setRemoteDescription).toHaveBeenCalledOnce();
    expect(mock.setRemoteDescription).toHaveBeenCalledWith({
      type: "answer",
      sdp: "v=0\r\no=answer\r\n",
    });
    expect(mock.close).not.toHaveBeenCalled();

    expect(pc).toBe(mock);
    expect(stream).toBeInstanceOf(MockMediaStream);
    expect(resourceUrl).toBe("/api/upstream/v1/stream-sessions/sess1/whep/abc-123");
  });

  test("trailing slash on URL is normalized when building resourceUrl", async () => {
    mockFetch(sdpResponse(201, "v=0", "xyz"));
    const { resourceUrl } = await connectWhep({
      url: "/api/upstream/v1/stream-sessions/sess1/whep/",
    });
    expect(resourceUrl).toBe("/api/upstream/v1/stream-sessions/sess1/whep/xyz");
  });

  test("missing Location header → resourceUrl is null", async () => {
    mockFetch(sdpResponse(201, "v=0", null));
    const { resourceUrl } = await connectWhep({
      url: "/api/upstream/v1/stream-sessions/sess1/whep",
    });
    expect(resourceUrl).toBeNull();
  });

  test("Location is URI-encoded so weird characters can't break the URL", async () => {
    mockFetch(sdpResponse(201, "v=0", "abc/123"));
    const { resourceUrl } = await connectWhep({
      url: "/api/upstream/v1/stream-sessions/sess1/whep",
    });
    expect(resourceUrl).toBe(
      "/api/upstream/v1/stream-sessions/sess1/whep/abc%2F123",
    );
  });
});

describe("connectWhep — typed errors", () => {
  test("404 throws WhepNotFoundError + closes the peer connection", async () => {
    mockFetch(new Response(null, { status: 404 }));
    await expect(
      connectWhep({ url: "/whep" }),
    ).rejects.toBeInstanceOf(WhepNotFoundError);
    expect(MockRTCPeerConnection.instances[0].close).toHaveBeenCalledOnce();
  });

  test("500 throws WhepRejectedError carrying the status + body", async () => {
    mockFetch(new Response("upstream broke", { status: 500 }));
    const err = await connectWhep({ url: "/whep" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WhepRejectedError);
    const rejected = err as WhepRejectedError;
    expect(rejected.status).toBe(500);
    expect(rejected.body).toBe("upstream broke");
    expect(MockRTCPeerConnection.instances[0].close).toHaveBeenCalledOnce();
  });

  test("fetch throwing produces WhepNetworkError", async () => {
    mockFetch(new TypeError("Failed to fetch"));
    const err = await connectWhep({ url: "/whep" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WhepNetworkError);
    expect(MockRTCPeerConnection.instances[0].close).toHaveBeenCalledOnce();
  });
});

describe("connectWhep — AbortSignal", () => {
  test("aborted before fetch returns → AbortError, no remote description set", async () => {
    // Resolve the fetch but signal abort before our post-fetch check.
    const controller = new AbortController();
    mockFetch(sdpResponse(201, "v=0", "abc"));
    controller.abort();

    const err = await connectWhep({
      url: "/whep",
      signal: controller.signal,
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(DOMException);
    expect((err as DOMException).name).toBe("AbortError");
    expect(MockRTCPeerConnection.instances[0].setRemoteDescription).not.toHaveBeenCalled();
    expect(MockRTCPeerConnection.instances[0].close).toHaveBeenCalledOnce();
  });

  test("abort during in-flight fetch surfaces as AbortError", async () => {
    const controller = new AbortController();
    globalThis.fetch = vi.fn(async (_url, init) => {
      // Simulate fetch reacting to abort by throwing AbortError.
      if ((init as RequestInit | undefined)?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      throw new DOMException("Aborted", "AbortError");
    }) as typeof fetch;
    controller.abort();

    const err = await connectWhep({
      url: "/whep",
      signal: controller.signal,
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(DOMException);
    expect((err as DOMException).name).toBe("AbortError");
  });
});

describe("closeWhepSession", () => {
  test("null is a no-op (no fetch call)", () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as typeof fetch;
    closeWhepSession(null);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("fires DELETE with keepalive when given a URL", () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    globalThis.fetch = fetchSpy as typeof fetch;
    closeWhepSession("/api/upstream/v1/stream-sessions/x/whep/abc");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/upstream/v1/stream-sessions/x/whep/abc",
      expect.objectContaining({ method: "DELETE", keepalive: true }),
    );
  });

  test("swallows fetch errors so we don't crash on teardown", () => {
    globalThis.fetch = vi.fn(() => {
      throw new Error("network down");
    }) as typeof fetch;
    expect(() => closeWhepSession("/whep/abc")).not.toThrow();
  });
});
