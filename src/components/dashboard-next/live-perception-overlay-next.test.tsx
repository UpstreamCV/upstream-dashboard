// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";
import type { LatestPerceptionRecord, StreamParams } from "@/lib/api/types";
import { PLAYER_STATE_EVENT } from "@/components/stream/player-state-event";

// --- hoisted controllers shared with the vi.mock factories ------------------
const h = vi.hoisted(() => ({
  realtime: {
    subscribeCalls: 0,
    removeCalls: 0,
    statusCb: null as ((s: string) => void) | null,
    changeHandler: null as
      | ((payload: { new: unknown; errors?: unknown }) => void)
      | null,
  },
  ws: {
    connectCalls: 0,
    closeCalls: 0,
    onSnapshot: null as ((msg: unknown) => void) | null,
  },
  useUpstreamListMock: vi.fn(),
  mutateSpy: vi.fn(),
}));

vi.mock("@/lib/api/use-list", () => ({
  useUpstreamList: h.useUpstreamListMock,
}));

// Mock the WebRTC player so its `overlay` slot is observable and no real
// connection is attempted. We drive the player-connected signal ourselves via
// PLAYER_STATE_EVENT (the same channel the real player dispatches on).
vi.mock("./live-stream-player-next", () => ({
  LiveStreamPlayerNext: ({ overlay }: { overlay?: ReactNode }) => (
    <div data-testid="player">{overlay}</div>
  ),
}));

// Controllable Supabase Realtime: records subscribe/remove calls and exposes
// the status callback + the postgres_changes handler so tests can drive them.
// The overlay now loads the SDK lazily, so the client comes from an async
// getSupabaseBrowserClient() in @/lib/supabase/client-lazy (a Promise).
vi.mock("@/lib/supabase/client-lazy", () => ({
  getSupabaseBrowserClient: async () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "t" } } }),
    },
    realtime: { setAuth: async () => {} },
    channel: () => ({
      on: (
        _event: string,
        _filter: unknown,
        handler: (payload: { new: unknown; errors?: unknown }) => void,
      ) => {
        h.realtime.changeHandler = handler;
        return {
          subscribe: (cb?: (s: string) => void) => {
            h.realtime.subscribeCalls += 1;
            h.realtime.statusCb = cb ?? null;
            return {};
          },
        };
      },
    }),
    removeChannel: () => {
      h.realtime.removeCalls += 1;
    },
  }),
}));

// Controllable perception-fanout WS client: records connect/close calls and
// exposes onSnapshot so tests can push hot-path frames. The real client is
// covered by src/lib/perception/perception-ws-client.test.ts.
vi.mock("@/lib/perception/perception-ws-client", () => ({
  connectPerceptionStream: (opts: { onSnapshot: (msg: unknown) => void }) => {
    h.ws.connectCalls += 1;
    h.ws.onSnapshot = opts.onSnapshot;
    return {
      close: () => {
        h.ws.closeCalls += 1;
        h.ws.onSnapshot = null;
      },
    };
  },
}));

vi.mock("@/lib/api/perception-stream", () => ({
  fetchPerceptionStreamToken: vi.fn(async () => ({
    token: "test-token",
    ws_url: "ws://127.0.0.1:18990/v1/subscribe",
    expires_at: "2026-06-11T18:00:00Z",
  })),
}));

const { LivePerceptionOverlayNext } = await import(
  "./live-perception-overlay-next"
);

const FIXED = new Date("2026-05-29T12:00:00.000Z");
const NOW = FIXED.getTime();

const APPROVED: StreamParams = {
  width: 1280,
  height: 720,
  fps: 1,
  codec: "h264",
  bitrate_kbps: 2000,
  latency_mode: "balanced",
};
const FRAME = { width: 1280, height: 720, frame_num: 1, fps: 30 };
const PERSON = {
  track_id: "17",
  class_id: 2,
  label: "person",
  confidence: 0.82,
  bbox: { x: 10, y: 10, w: 100, h: 200 },
  bbox_normalized: null,
  roi_labels: [],
};

function snap(objects: unknown[] = []) {
  return { frame: FRAME, objects, geometry: { rois: [], lines: [] } };
}

function record(
  opts: { id?: string; observedAt?: string; snapshot?: unknown } = {},
): LatestPerceptionRecord {
  const observedAt = opts.observedAt ?? new Date(NOW).toISOString();
  return {
    id: opts.id ?? "perc-1",
    camera_id: "cam-1",
    stream_session_id: "ssn-1",
    processor_id: "proc-1",
    package_id: "pkg-1",
    observed_at: observedAt,
    updated_at: observedAt,
    snapshot: (opts.snapshot ?? snap()) as LatestPerceptionRecord["snapshot"],
  };
}

/** The functional updater handed to mutate by the newer-wins cache writes
 * (WS + Realtime). Asserts the call shape, returns the updater so tests can
 * probe its ordering decisions against arbitrary `prev` values. */
function lastMutateUpdater() {
  const call = h.mutateSpy.mock.calls.at(-1);
  expect(typeof call?.[0]).toBe("function");
  expect(call?.[1]).toEqual({ revalidate: false });
  return call![0] as (
    prev?: { snapshot: LatestPerceptionRecord },
  ) => { snapshot: LatestPerceptionRecord } | undefined;
}

function setHookData(
  data: { snapshot: LatestPerceptionRecord } | undefined,
  opts: { error?: unknown; isValidating?: boolean } = {},
): void {
  h.useUpstreamListMock.mockReturnValue({
    data,
    error: opts.error ?? null,
    isValidating: opts.isValidating ?? false,
    mutate: h.mutateSpy,
  });
}

function renderOverlay(
  opts: {
    processingEnabled?: boolean;
    initialPerception?: LatestPerceptionRecord | null;
  } = {},
) {
  return render(
    <LivePerceptionOverlayNext
      sessionId="ssn-1"
      cameraId="cam-1"
      approved={APPROVED}
      initialPerception={opts.initialPerception ?? null}
      processingEnabled={opts.processingEnabled}
    />,
  );
}

function turnOn(): void {
  fireEvent.click(screen.getByRole("button", { name: /turn on/i }));
}

function connectPlayer(kind = "connected", cameraId = "cam-1"): void {
  act(() => {
    window.dispatchEvent(
      new CustomEvent(PLAYER_STATE_EVENT, { detail: { cameraId, kind } }),
    );
  });
}

// The realtime effect is async (getSession -> setAuth -> subscribe). Flush its
// microtasks so the channel is subscribed / status + change handlers are wired
// before asserting on them.
async function flushRealtime(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function setVisibility(state: "visible" | "hidden"): void {
  act(() => {
    Object.defineProperty(document, "visibilityState", {
      value: state,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED);
  h.realtime.subscribeCalls = 0;
  h.realtime.removeCalls = 0;
  h.realtime.statusCb = null;
  h.realtime.changeHandler = null;
  h.ws.connectCalls = 0;
  h.ws.closeCalls = 0;
  h.ws.onSnapshot = null;
  h.useUpstreamListMock.mockReset();
  h.mutateSpy.mockReset();
  setHookData(undefined);
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("LivePerceptionOverlayNext — default OFF + subscription gating", () => {
  test("does not subscribe on initial render; shows off copy", () => {
    const view = renderOverlay();
    expect(h.realtime.subscribeCalls).toBe(0);
    expect(view.container.textContent).toContain("Live detections off");
    expect(view.container.textContent).toContain(
      "Live detections are off. Turn on for 15 minutes to see detection boxes",
    );
    expect(
      screen.getByRole("button", { name: /turn on live detections/i }),
    ).toBeTruthy();
  });

  test("subscribes only after enabling AND the stream connects", async () => {
    renderOverlay();
    turnOn();
    await flushRealtime();
    expect(h.realtime.subscribeCalls).toBe(0); // session on, but stream not connected
    connectPlayer();
    await flushRealtime();
    expect(h.realtime.subscribeCalls).toBe(1);
  });

  test("does not subscribe when processing is disabled", async () => {
    const view = renderOverlay({ processingEnabled: false });
    turnOn();
    connectPlayer();
    await flushRealtime();
    expect(h.realtime.subscribeCalls).toBe(0);
    expect(view.container.textContent).toContain("Processing is disabled");
  });

  test("does not subscribe when the stream is inactive", async () => {
    const view = renderOverlay();
    turnOn();
    await flushRealtime();
    expect(h.realtime.subscribeCalls).toBe(0);
    expect(view.container.textContent).toContain("Stream is not active");
  });

  test("does not subscribe when processor output is stale", async () => {
    setHookData({
      snapshot: record({
        observedAt: new Date(NOW - 60_000).toISOString(),
        snapshot: snap([PERSON]),
      }),
    });
    const view = renderOverlay();
    turnOn();
    connectPlayer();
    await flushRealtime();
    expect(h.realtime.subscribeCalls).toBe(0);
    expect(view.container.textContent).toContain("Processor output is stale");
  });
});

describe("LivePerceptionOverlayNext — auto-unsubscribe", () => {
  test("unsubscribes on unmount", async () => {
    const view = renderOverlay();
    turnOn();
    connectPlayer();
    await flushRealtime();
    expect(h.realtime.subscribeCalls).toBe(1);
    view.unmount();
    expect(h.realtime.removeCalls).toBeGreaterThanOrEqual(1);
  });

  test("unsubscribes when processing is turned off", async () => {
    const view = renderOverlay({ processingEnabled: true });
    turnOn();
    connectPlayer();
    await flushRealtime();
    expect(h.realtime.subscribeCalls).toBe(1);
    view.rerender(
      <LivePerceptionOverlayNext
        sessionId="ssn-1"
        cameraId="cam-1"
        approved={APPROVED}
        initialPerception={null}
        processingEnabled={false}
      />,
    );
    expect(h.realtime.removeCalls).toBeGreaterThanOrEqual(1);
  });

  test("unsubscribes when the tab is hidden, reconnects when visible again", async () => {
    renderOverlay();
    turnOn();
    connectPlayer();
    await flushRealtime();
    expect(h.realtime.subscribeCalls).toBe(1);
    setVisibility("hidden");
    expect(h.realtime.removeCalls).toBeGreaterThanOrEqual(1);
    setVisibility("visible");
    await flushRealtime();
    expect(h.realtime.subscribeCalls).toBe(2); // session still valid -> resubscribe
  });

  test("unsubscribes on expiry and does not reconnect afterwards", async () => {
    const view = renderOverlay();
    turnOn();
    connectPlayer();
    await flushRealtime();
    expect(h.realtime.subscribeCalls).toBe(1);
    act(() => {
      vi.advanceTimersByTime(15 * 60 * 1000 + 1000);
    });
    expect(h.realtime.removeCalls).toBeGreaterThanOrEqual(1);
    expect(view.container.textContent).toContain("Live detections expired");
    // A visibility round-trip must NOT resurrect an expired session.
    setVisibility("hidden");
    setVisibility("visible");
    await flushRealtime();
    expect(h.realtime.subscribeCalls).toBe(1);
  });
});

function emitRealtimeRow(id = "evt-1"): void {
  act(() =>
    h.realtime.changeHandler?.({
      new: {
        id,
        camera_id: "cam-1",
        observed_at: new Date(NOW).toISOString(),
        snapshot: snap([PERSON]),
      },
    }),
  );
}

describe("LivePerceptionOverlayNext — connection chip", () => {
  test("connecting -> fallback (subscribed but silent) -> connected (events flow)", async () => {
    const view = renderOverlay();
    turnOn();
    connectPlayer();
    await flushRealtime();
    expect(view.container.textContent).toContain("Connecting");
    // Subscribed but no events yet: the poll fallback is doing the work, so we
    // must NOT claim "Realtime connected".
    act(() => h.realtime.statusCb?.("SUBSCRIBED"));
    expect(view.container.textContent).toContain("Fallback polling");
    // Once an actual row event arrives, it's genuinely live.
    emitRealtimeRow();
    expect(view.container.textContent).toContain("Realtime connected");
  });

  test("falls back to polling on a CLOSED channel", async () => {
    const view = renderOverlay();
    turnOn();
    connectPlayer();
    await flushRealtime();
    act(() => h.realtime.statusCb?.("SUBSCRIBED"));
    emitRealtimeRow();
    expect(view.container.textContent).toContain("Realtime connected");
    act(() => h.realtime.statusCb?.("CLOSED"));
    expect(view.container.textContent).toContain("Fallback polling");
  });

  test("shows Processing disabled in the chip when enabled but blocked", () => {
    const view = renderOverlay({ processingEnabled: false });
    turnOn();
    expect(view.container.textContent).toContain("Processing disabled");
  });

  test("polls fast while active and is NOT slowed by a SUBSCRIBED channel", async () => {
    renderOverlay();
    turnOn();
    connectPlayer();
    await flushRealtime();
    act(() => h.realtime.statusCb?.("SUBSCRIBED"));
    const calls = h.useUpstreamListMock.mock.calls;
    const lastOpts = calls[calls.length - 1][1] as { refreshInterval: number };
    expect(lastOpts.refreshInterval).toBe(250);
  });
});

describe("LivePerceptionOverlayNext — perception-fanout WS hot path", () => {
  function emitWsFrame(cameraId = "cam-1", seq = 7): void {
    act(() =>
      h.ws.onSnapshot?.({
        type: "snapshot",
        seq,
        camera_id: cameraId,
        stream_session_id: "ssn-1",
        processor_id: "proc-1",
        package_id: "pkg-1",
        observed_at: new Date(NOW).toISOString(),
        snapshot: snap([PERSON]),
      }),
    );
  }

  test("connects under the same gate as Realtime and closes on unmount", async () => {
    const view = renderOverlay();
    expect(h.ws.connectCalls).toBe(0);
    turnOn();
    await flushRealtime();
    expect(h.ws.connectCalls).toBe(0); // session on, stream not connected yet
    connectPlayer();
    await flushRealtime();
    expect(h.ws.connectCalls).toBe(1);
    view.unmount();
    expect(h.ws.closeCalls).toBe(1);
  });

  test("a WS frame writes a synthetic record straight into the SWR cache", async () => {
    renderOverlay();
    turnOn();
    connectPlayer();
    await flushRealtime();
    emitWsFrame();
    // Newer-wins guard: mutate now receives a functional updater. Empty
    // cache and older cached snapshots are replaced; a fresher cached
    // snapshot is kept (prev identity returned — SWR sees no change).
    const updater = lastMutateUpdater();
    expect(updater(undefined)?.snapshot.id).toBe("ws:cam-1:7");
    const older = {
      snapshot: record({ observedAt: new Date(NOW - 5_000).toISOString() }),
    };
    expect(updater(older)?.snapshot.id).toBe("ws:cam-1:7");
    const fresher = {
      snapshot: record({ observedAt: new Date(NOW + 5_000).toISOString() }),
    };
    expect(updater(fresher)).toBe(fresher);
  });

  test("ignores WS frames for a different camera", async () => {
    renderOverlay();
    turnOn();
    connectPlayer();
    await flushRealtime();
    emitWsFrame("cam-OTHER");
    expect(h.mutateSpy).not.toHaveBeenCalled();
  });

  test("chip says Live stream connected while WS frames arrive", async () => {
    const view = renderOverlay();
    turnOn();
    connectPlayer();
    await flushRealtime();
    emitWsFrame();
    expect(view.container.textContent).toContain("Live stream connected");
  });

  test("poll downshifts to keep-warm while WS delivers, restores 250ms when silent", async () => {
    renderOverlay();
    turnOn();
    connectPlayer();
    await flushRealtime();

    const lastInterval = () => {
      const calls = h.useUpstreamListMock.mock.calls;
      return (calls[calls.length - 1][1] as { refreshInterval: number })
        .refreshInterval;
    };
    expect(lastInterval()).toBe(250);

    emitWsFrame();
    expect(lastInterval()).toBe(2000);

    // WS goes silent: once the delivering window passes, the next render
    // computes wsDelivering=false and the fast poll resumes.
    act(() => {
      vi.setSystemTime(new Date(NOW + 3_000));
    });
    act(() => h.realtime.statusCb?.("SUBSCRIBED")); // any re-render trigger
    expect(lastInterval()).toBe(250);
  });
});

describe("LivePerceptionOverlayNext — disclaimer", () => {
  test("renders the exact reassurance wording and no path jargon", () => {
    const view = renderOverlay();
    const text = view.container.textContent ?? "";
    expect(text).toContain(
      "Live detections show what Upstream is seeing from the camera.",
    );
    expect(text).toContain(
      "This does not mean the processor is delayed or out of sync",
    );
    expect(text).toContain(
      "detections and events are still created from the actual camera stream",
    );
    // Must not leak the overly-technical framing the spec forbids.
    expect(text).not.toContain("WebRTC and metadata paths are separate");
  });
});

describe("LivePerceptionOverlayNext — realtime event + regressions", () => {
  test("a postgres_changes event writes the row into the SWR cache", async () => {
    renderOverlay();
    turnOn();
    connectPlayer();
    await flushRealtime();
    act(() =>
      h.realtime.changeHandler?.({
        new: {
          id: "p2",
          camera_id: "cam-1",
          observed_at: new Date(NOW).toISOString(),
          snapshot: snap([PERSON]),
        },
      }),
    );
    const updater = lastMutateUpdater();
    expect(updater(undefined)?.snapshot.id).toBe("p2");
  });

  test("an older realtime row never replaces a fresher cached snapshot", async () => {
    // The ~1 Hz cold path (realtime rows, keep-warm polls) races the
    // 6-15 Hz WS frames; without newer-wins ordering it shoves the overlay
    // backward in time every couple of seconds (the periodic hitch).
    renderOverlay();
    turnOn();
    connectPlayer();
    await flushRealtime();
    act(() =>
      h.realtime.changeHandler?.({
        new: {
          id: "p-old",
          camera_id: "cam-1",
          observed_at: new Date(NOW - 2_000).toISOString(),
          snapshot: snap([PERSON]),
        },
      }),
    );
    const updater = lastMutateUpdater();
    const fresher = { snapshot: record({ id: "ws-fresh" }) }; // observed_at = NOW
    expect(updater(fresher)).toBe(fresher); // kept by identity — no churn
    const older = {
      snapshot: record({ observedAt: new Date(NOW - 10_000).toISOString() }),
    };
    expect(updater(older)?.snapshot.id).toBe("p-old"); // genuinely newer applies
  });

  test("ignores realtime events for a different camera (client-side filter)", async () => {
    // The subscription has no server-side camera_id filter (it can't, on
    // UPDATEs), so account-scoped rows for other cameras arrive and must be
    // dropped in the handler.
    renderOverlay();
    turnOn();
    connectPlayer();
    await flushRealtime();
    h.mutateSpy.mockClear();
    act(() =>
      h.realtime.changeHandler?.({
        new: {
          id: "other",
          camera_id: "cam-2",
          observed_at: new Date(NOW).toISOString(),
          snapshot: snap([PERSON]),
        },
      }),
    );
    expect(h.mutateSpy).not.toHaveBeenCalled();
  });

  test("stripped broadcast row (no usable fields) falls back to a refetch", async () => {
    // In prod the row can arrive without camera_id/id (perceptionRecordFromRealtimeRow
    // -> null). We can't direct-write it, so we refetch the authoritative latest.
    renderOverlay();
    turnOn();
    connectPlayer();
    await flushRealtime();
    h.mutateSpy.mockClear();
    act(() => h.realtime.changeHandler?.({ new: {} }));
    expect(h.mutateSpy).toHaveBeenCalledWith();
  });

  test("ignores errored (401) change events — no refetch, no thrash", async () => {
    // Realtime emits unauthorized changes as empty rows with `errors`, in
    // bursts during reconnects. They must be dropped entirely so they can't
    // thrash the component / starve the poll.
    const view = renderOverlay();
    turnOn();
    connectPlayer();
    await flushRealtime();
    act(() => h.realtime.statusCb?.("SUBSCRIBED"));
    h.mutateSpy.mockClear();
    act(() => {
      h.realtime.changeHandler?.({
        new: {},
        errors: ["Error 401: Unauthorized"],
      });
      h.realtime.changeHandler?.({
        new: {},
        errors: ["Error 401: Unauthorized"],
      });
    });
    expect(h.mutateSpy).not.toHaveBeenCalled();
    // Subscribed but no *usable* events -> honestly still polling.
    expect(view.container.textContent).toContain("Fallback polling");
  });

  test("boxes + labels + object count render when on", () => {
    setHookData({ snapshot: record({ snapshot: snap([PERSON]) }) });
    const view = renderOverlay();
    turnOn();
    expect(
      view.container.querySelector('[data-testid="player"] svg'),
    ).toBeTruthy();
    expect(view.container.textContent).toContain("1 object");
    expect(view.container.textContent).toContain("person");
  });

  test("minimum confidence filter drops low-confidence objects", async () => {
    setHookData({
      snapshot: record({ snapshot: snap([{ ...PERSON, confidence: 0.5 }]) }),
    });
    const view = renderOverlay();
    turnOn();
    connectPlayer(); // stream active so the message reaches the filter branch
    await flushRealtime();
    fireEvent.change(screen.getByLabelText("Minimum object confidence"), {
      target: { value: "0.75" },
    });
    expect(view.container.textContent).toContain("No objects to draw");
  });

  test("manual refresh triggers a revalidation", () => {
    setHookData({ snapshot: record({ snapshot: snap([PERSON]) }) });
    renderOverlay();
    turnOn();
    h.mutateSpy.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    expect(h.mutateSpy).toHaveBeenCalled();
  });

  test("empty state when on, stream connected, but no snapshot", async () => {
    setHookData(undefined);
    const view = renderOverlay();
    turnOn();
    connectPlayer();
    await flushRealtime();
    expect(view.container.textContent).toContain("No perception data yet");
  });

  test("no secrets leak into the DOM", () => {
    setHookData({ snapshot: record({ snapshot: snap([PERSON]) }) });
    const view = renderOverlay();
    turnOn();
    const html = view.container.innerHTML;
    for (const secret of [
      "storage_key",
      "signed_url",
      "service_role",
      "rtsp://",
      "srt://",
      "Authorization",
    ]) {
      expect(html).not.toContain(secret);
    }
  });
});
