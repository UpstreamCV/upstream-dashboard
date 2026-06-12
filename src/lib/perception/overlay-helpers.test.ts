import { describe, expect, test } from "vitest";
import type { PerceptionObject } from "@/lib/api/types";
import {
  buildLatestPerceptionPath,
  centroid,
  computeRealtimeGate,
  confidencePercent,
  deriveOverlayConnectionState,
  formatCountdown,
  formatObjectLabel,
  hasFrameDimensions,
  isSessionExpired,
  LIVE_SESSION_DURATION_MS,
  normalizeSnapshot,
  objectName,
  pointsToAttr,
  resolveBBox,
  selectOverlayObjects,
} from "@/lib/perception/overlay-helpers";

function obj(over: Partial<PerceptionObject> = {}): PerceptionObject {
  return {
    track_id: null,
    class_id: null,
    label: null,
    confidence: null,
    bbox: null,
    bbox_normalized: null,
    roi_labels: [],
    ...over,
  };
}

describe("buildLatestPerceptionPath", () => {
  test("builds the proxy-relative P5-C path", () => {
    expect(buildLatestPerceptionPath("cam-9")).toBe(
      "/v1/cameras/cam-9/perception/latest",
    );
  });
});

describe("resolveBBox", () => {
  test("uses the pixel bbox when present", () => {
    const box = { x: 595.95, y: 86.69, w: 340.3, h: 631.99 };
    expect(resolveBBox(obj({ bbox: box }), 1280, 720)).toEqual(box);
  });

  test("falls back to bbox_normalized scaled by frame dimensions", () => {
    const result = resolveBBox(
      obj({ bbox_normalized: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } }),
      1000,
      500,
    );
    expect(result).toEqual({ x: 100, y: 100, w: 300, h: 200 });
  });

  test("prefers the pixel bbox over bbox_normalized", () => {
    const box = { x: 1, y: 2, w: 3, h: 4 };
    const result = resolveBBox(
      obj({ bbox: box, bbox_normalized: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } }),
      1000,
      1000,
    );
    expect(result).toEqual(box);
  });

  test("returns null for a normalized-only object without frame dimensions", () => {
    expect(
      resolveBBox(
        obj({ bbox_normalized: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } }),
        null,
        null,
      ),
    ).toBeNull();
  });

  test("returns null when the object has no bbox at all", () => {
    expect(resolveBBox(obj(), 1280, 720)).toBeNull();
  });
});

describe("selectOverlayObjects", () => {
  test("returns only objects that have a resolvable box", () => {
    const withBox = obj({ bbox: { x: 0, y: 0, w: 10, h: 10 } });
    const result = selectOverlayObjects([withBox, obj()], 1280, 720, 0);
    expect(result).toHaveLength(1);
    expect(result[0].box).toEqual({ x: 0, y: 0, w: 10, h: 10 });
  });

  test("drops objects below the confidence threshold", () => {
    const low = obj({ bbox: { x: 0, y: 0, w: 1, h: 1 }, confidence: 0.2 });
    const high = obj({ bbox: { x: 0, y: 0, w: 1, h: 1 }, confidence: 0.8 });
    const result = selectOverlayObjects([low, high], 1280, 720, 0.5);
    expect(result).toHaveLength(1);
    expect(result[0].object.confidence).toBe(0.8);
  });

  test("keeps objects with unknown confidence (an unknown is not a 'below')", () => {
    const unknown = obj({ bbox: { x: 0, y: 0, w: 1, h: 1 }, confidence: null });
    expect(selectOverlayObjects([unknown], 1280, 720, 0.5)).toHaveLength(1);
  });
});

describe("confidencePercent", () => {
  test("formats a fraction as a rounded percentage", () => {
    expect(confidencePercent(0.42)).toBe("42%");
    expect(confidencePercent(0.999)).toBe("100%");
  });

  test("returns null for missing or non-finite input", () => {
    expect(confidencePercent(null)).toBeNull();
    expect(confidencePercent(undefined)).toBeNull();
    expect(confidencePercent(Number.NaN)).toBeNull();
  });
});

describe("objectName", () => {
  test("prefers the label", () => {
    expect(objectName(obj({ label: "person" }))).toBe("person");
  });

  test("falls back to the class id, then to a generic name", () => {
    expect(objectName(obj({ class_id: 7 }))).toBe("class 7");
    expect(objectName(obj())).toBe("object");
  });
});

describe("formatObjectLabel", () => {
  test("combines name, track id and confidence", () => {
    const label = formatObjectLabel(
      obj({ label: "person", track_id: "3", confidence: 0.42 }),
    );
    expect(label).toBe("person #3 · 42%");
  });

  test("includes ROI labels only when showRoi is set", () => {
    const o = obj({
      label: "person",
      track_id: "3",
      confidence: 0.42,
      roi_labels: ["entry-roi"],
    });
    expect(formatObjectLabel(o)).toBe("person #3 · 42%");
    expect(formatObjectLabel(o, { showRoi: true })).toBe(
      "person #3 · entry-roi · 42%",
    );
  });

  test("is safe when label, track id and confidence are all missing", () => {
    expect(formatObjectLabel(obj())).toBe("object");
    expect(formatObjectLabel(obj({ class_id: 2 }))).toBe("class 2");
  });

  test("drops the confidence segment when confidence is missing", () => {
    expect(formatObjectLabel(obj({ label: "car", track_id: "8" }))).toBe(
      "car #8",
    );
  });
});

describe("pointsToAttr & centroid", () => {
  test("pointsToAttr builds an SVG points string", () => {
    expect(
      pointsToAttr([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ]),
    ).toBe("1,2 3,4");
  });

  test("centroid averages a point set, null on empty", () => {
    expect(
      centroid([
        { x: 0, y: 0 },
        { x: 10, y: 20 },
      ]),
    ).toEqual({ x: 5, y: 10 });
    expect(centroid([])).toBeNull();
  });
});

describe("normalizeSnapshot", () => {
  test("yields safe empties for a non-object payload", () => {
    for (const garbage of [null, undefined, "x", 7, []]) {
      const s = normalizeSnapshot(garbage);
      expect(s.frameWidth).toBeNull();
      expect(s.frameHeight).toBeNull();
      expect(s.objects).toEqual([]);
      expect(s.rois).toEqual([]);
      expect(s.lines).toEqual([]);
      expect(hasFrameDimensions(s)).toBe(false);
    }
  });

  test("extracts frame dimensions, objects and geometry", () => {
    const s = normalizeSnapshot({
      frame: { width: 1280, height: 720, frame_num: 5, fps: 1 },
      objects: [
        {
          track_id: "3",
          label: "person",
          confidence: 0.42,
          bbox: { x: 1, y: 2, w: 3, h: 4 },
        },
      ],
      geometry: {
        rois: [
          {
            id: "entry-roi",
            label: "entry",
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 10 },
            ],
          },
        ],
        lines: [
          {
            id: "entry-line",
            label: "entry",
            points: [
              { x: 0, y: 5 },
              { x: 10, y: 5 },
            ],
          },
        ],
      },
    });
    expect(s.frameWidth).toBe(1280);
    expect(s.frameHeight).toBe(720);
    expect(hasFrameDimensions(s)).toBe(true);
    expect(s.objects).toHaveLength(1);
    expect(s.objects[0].track_id).toBe("3");
    expect(s.rois).toHaveLength(1);
    expect(s.rois[0].points).toHaveLength(3);
    expect(s.lines).toHaveLength(1);
  });

  test("treats a zero/negative frame dimension as missing", () => {
    const s = normalizeSnapshot({ frame: { width: 0, height: -1 } });
    expect(s.frameWidth).toBeNull();
    expect(s.frameHeight).toBeNull();
  });

  test("drops geometry items with no usable points", () => {
    const s = normalizeSnapshot({
      geometry: {
        rois: [
          { id: "a", points: [] },
          { id: "b" },
          { id: "c", points: [{ x: 1, y: 1 }] },
        ],
      },
    });
    expect(s.rois).toHaveLength(1);
    expect(s.rois[0].id).toBe("c");
  });

  test("skips non-object entries inside the objects array", () => {
    const s = normalizeSnapshot({
      frame: { width: 100, height: 100 },
      objects: ["nope", 5, null, { label: "person" }],
    });
    expect(s.objects).toHaveLength(1);
    expect(s.objects[0].label).toBe("person");
  });
});

import {
  formatOverlayAge,
  observedAtAgeSeconds,
} from "./overlay-helpers";

describe("observedAtAgeSeconds", () => {
  test("returns positive seconds for an observation in the past", () => {
    const now = Date.parse("2026-05-28T12:00:30Z");
    expect(observedAtAgeSeconds("2026-05-28T12:00:00Z", now)).toBeCloseTo(30, 3);
  });

  test("returns null for missing / malformed timestamps", () => {
    expect(observedAtAgeSeconds(null, Date.now())).toBeNull();
    expect(observedAtAgeSeconds(undefined, Date.now())).toBeNull();
    expect(observedAtAgeSeconds("", Date.now())).toBeNull();
    expect(observedAtAgeSeconds("not-a-date", Date.now())).toBeNull();
  });
});

describe("formatOverlayAge", () => {
  test("sub-minute age renders with one decimal", () => {
    const now = Date.parse("2026-05-28T12:00:00.800Z");
    expect(formatOverlayAge("2026-05-28T12:00:00.000Z", now)).toBe(
      "overlay 0.8s old",
    );
  });

  test("ages near 1 second round to one decimal, no surprises", () => {
    const now = Date.parse("2026-05-28T12:00:01.000Z");
    expect(formatOverlayAge("2026-05-28T12:00:00.000Z", now)).toBe(
      "overlay 1.0s old",
    );
  });

  test("ages between 1 and 60 minutes use rounded minutes", () => {
    const now = Date.parse("2026-05-28T12:05:30Z");
    expect(formatOverlayAge("2026-05-28T12:00:00Z", now)).toBe(
      "overlay 6 min old",
    );
  });

  test("ages over an hour use rounded hours", () => {
    const now = Date.parse("2026-05-28T14:30:00Z");
    expect(formatOverlayAge("2026-05-28T12:00:00Z", now)).toBe(
      "overlay 3 h old",
    );
  });

  test("future-clock skew clamps to 0 rather than emitting negative ages", () => {
    const now = Date.parse("2026-05-28T11:59:59.800Z");
    expect(formatOverlayAge("2026-05-28T12:00:00.000Z", now)).toBe(
      "overlay 0.0s old",
    );
  });

  test("null for missing / unparseable observedAt", () => {
    expect(formatOverlayAge(null, Date.now())).toBeNull();
    expect(formatOverlayAge(undefined, Date.now())).toBeNull();
    expect(formatOverlayAge("not-a-date", Date.now())).toBeNull();
  });
});

import {
  perceptionRecordFromRealtimeRow,
  perceptionRecordFromWsMessage,
} from "./overlay-helpers";

describe("perceptionRecordFromWsMessage", () => {
  const fullMessage = {
    type: "snapshot",
    seq: 42,
    camera_id: "22222222-2222-2222-2222-222222222222",
    stream_session_id: "33333333-3333-3333-3333-333333333333",
    processor_id: "proc-1",
    package_id: "pkg-1",
    observed_at: "2026-06-11T17:03:22.142Z",
    snapshot: {
      frame: { width: 1280, height: 720 },
      objects: [{ label: "person", confidence: 0.91 }],
      geometry: { rois: [], lines: [] },
    },
  };

  test("maps a full WS snapshot frame to a LatestPerceptionRecord", () => {
    const rec = perceptionRecordFromWsMessage(fullMessage);
    expect(rec).not.toBeNull();
    expect(rec!.camera_id).toBe(fullMessage.camera_id);
    expect(rec!.observed_at).toBe(fullMessage.observed_at);
    expect(rec!.snapshot).toEqual(fullMessage.snapshot);
    // No DB row exists on the hot path: id is synthesized from camera + seq,
    // and updated_at mirrors observed_at.
    expect(rec!.id).toBe(`ws:${fullMessage.camera_id}:42`);
    expect(rec!.updated_at).toBe(fullMessage.observed_at);
  });

  test("returns null for non-snapshot or incomplete envelopes", () => {
    expect(perceptionRecordFromWsMessage(null)).toBeNull();
    expect(perceptionRecordFromWsMessage({})).toBeNull();
    expect(
      perceptionRecordFromWsMessage({ ...fullMessage, type: "hello" }),
    ).toBeNull();
    expect(
      perceptionRecordFromWsMessage({ ...fullMessage, seq: undefined }),
    ).toBeNull();
    expect(
      perceptionRecordFromWsMessage({ ...fullMessage, camera_id: "" }),
    ).toBeNull();
    expect(
      perceptionRecordFromWsMessage({ ...fullMessage, observed_at: undefined }),
    ).toBeNull();
  });

  test("tolerates a garbage snapshot payload (coerced downstream)", () => {
    const rec = perceptionRecordFromWsMessage({
      ...fullMessage,
      snapshot: "not-an-object",
    });
    expect(rec).not.toBeNull();
    expect(rec!.snapshot).toEqual({});
  });

  test("nullable processor/package/session fields", () => {
    const rec = perceptionRecordFromWsMessage({
      type: "snapshot",
      seq: 1,
      camera_id: "cam",
      observed_at: "2026-06-11T17:03:22Z",
      snapshot: {},
    });
    expect(rec!.processor_id).toBeNull();
    expect(rec!.package_id).toBeNull();
    expect(rec!.stream_session_id).toBe("");
  });
});

describe("perceptionRecordFromRealtimeRow", () => {
  const fullRow = {
    id: "11111111-1111-1111-1111-111111111111",
    account_id: "secret-account-uuid",
    camera_id: "22222222-2222-2222-2222-222222222222",
    stream_session_id: "33333333-3333-3333-3333-333333333333",
    processor_id: "proc-1",
    package_id: "pkg-1",
    observed_at: "2026-05-28T18:09:00Z",
    updated_at: "2026-05-28T18:09:00Z",
    snapshot: {
      frame: { width: 1280, height: 720 },
      objects: [{ label: "person", confidence: 0.8 }],
      geometry: { rois: [], lines: [] },
    },
  };

  test("maps a full realtime row to a LatestPerceptionRecord", () => {
    const rec = perceptionRecordFromRealtimeRow(fullRow);
    expect(rec).not.toBeNull();
    expect(rec!.id).toBe(fullRow.id);
    expect(rec!.camera_id).toBe(fullRow.camera_id);
    expect(rec!.observed_at).toBe(fullRow.observed_at);
    expect(rec!.snapshot).toEqual(fullRow.snapshot);
  });

  test("drops account_id (never surfaced to the overlay record)", () => {
    const rec = perceptionRecordFromRealtimeRow(fullRow);
    expect(JSON.stringify(rec)).not.toContain("secret-account-uuid");
    expect(rec as unknown as Record<string, unknown>).not.toHaveProperty(
      "account_id",
    );
  });

  test("returns null when identity/timestamp fields are missing", () => {
    expect(perceptionRecordFromRealtimeRow(null)).toBeNull();
    expect(perceptionRecordFromRealtimeRow({})).toBeNull();
    expect(
      perceptionRecordFromRealtimeRow({ id: "x", camera_id: "y" }),
    ).toBeNull(); // no observed_at
    expect(
      perceptionRecordFromRealtimeRow({
        camera_id: "y",
        observed_at: "2026-05-28T18:09:00Z",
      }),
    ).toBeNull(); // no id
  });

  test("tolerates a missing/garbage snapshot (coerced downstream)", () => {
    const rec = perceptionRecordFromRealtimeRow({
      id: "a",
      camera_id: "b",
      observed_at: "2026-05-28T18:09:00Z",
    });
    expect(rec).not.toBeNull();
    expect(rec!.snapshot).toEqual({});
    // updated_at falls back to observed_at when absent.
    expect(rec!.updated_at).toBe("2026-05-28T18:09:00Z");
  });

  test("nullable processor/package fields map to null", () => {
    const rec = perceptionRecordFromRealtimeRow({
      id: "a",
      camera_id: "b",
      observed_at: "2026-05-28T18:09:00Z",
      snapshot: {},
    });
    expect(rec!.processor_id).toBeNull();
    expect(rec!.package_id).toBeNull();
    expect(rec!.stream_session_id).toBe("");
  });
});

// --- M5: session + realtime gating ------------------------------------------

describe("isSessionExpired", () => {
  test("null expiry is never expired", () => {
    expect(isSessionExpired(null, 1_000_000)).toBe(false);
  });
  test("future expiry is not expired", () => {
    expect(isSessionExpired(2_000, 1_000)).toBe(false);
  });
  test("expiry exactly now, and in the past, is expired", () => {
    expect(isSessionExpired(1_000, 1_000)).toBe(true);
    expect(isSessionExpired(1_000, 1_500)).toBe(true);
  });
});

describe("formatCountdown", () => {
  test("15 minutes -> 15:00", () => {
    expect(formatCountdown(LIVE_SESSION_DURATION_MS)).toBe("15:00");
  });
  test("zero and negative clamp to 00:00", () => {
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-5_000)).toBe("00:00");
  });
  test("pads minutes and seconds, floors sub-second", () => {
    expect(formatCountdown(62_000)).toBe("01:02");
    expect(formatCountdown(9_400)).toBe("00:09");
  });
});

describe("computeRealtimeGate", () => {
  const ALL_OPEN = {
    liveDetectionsEnabled: true,
    isExpired: false,
    streamActive: true,
    processingEnabled: true,
    processorOutputFresh: true,
    pageVisible: true,
  } as const;

  test("subscribes only when every condition holds", () => {
    expect(computeRealtimeGate(ALL_OPEN)).toBe(true);
  });

  test.each([
    ["liveDetectionsEnabled", { liveDetectionsEnabled: false }],
    ["isExpired", { isExpired: true }],
    ["streamActive", { streamActive: false }],
    ["processingEnabled", { processingEnabled: false }],
    ["processorOutputFresh", { processorOutputFresh: false }],
    ["pageVisible", { pageVisible: false }],
  ])("a single closed gate (%s) blocks the subscription", (_name, override) => {
    expect(computeRealtimeGate({ ...ALL_OPEN, ...override })).toBe(false);
  });
});

describe("deriveOverlayConnectionState", () => {
  const CONNECTED = {
    processingEnabled: true,
    liveDetectionsEnabled: true,
    isExpired: false,
    streamActive: true,
    isStale: false,
    shouldUseRealtime: true,
    realtimeStatus: "SUBSCRIBED" as const,
    realtimeDelivering: true,
    wsDelivering: false,
  };

  test("connected when the gate is open, subscribed, AND delivering events", () => {
    expect(deriveOverlayConnectionState(CONNECTED)).toEqual({
      mode: "connected",
      label: "Realtime connected",
    });
  });

  test("WS hot path delivering outranks every Realtime state", () => {
    expect(
      deriveOverlayConnectionState({ ...CONNECTED, wsDelivering: true }),
    ).toEqual({ mode: "ws_connected", label: "Live stream connected" });
    // Even with Realtime errored/silent, delivered WS frames are the truth.
    expect(
      deriveOverlayConnectionState({
        ...CONNECTED,
        wsDelivering: true,
        realtimeDelivering: false,
        realtimeStatus: "CHANNEL_ERROR",
      }).mode,
    ).toBe("ws_connected");
  });

  test("WS delivering does NOT outrank session/stream/freshness blockers", () => {
    expect(
      deriveOverlayConnectionState({
        ...CONNECTED,
        wsDelivering: true,
        isStale: true,
      }).mode,
    ).toBe("processor_stale");
    expect(
      deriveOverlayConnectionState({
        ...CONNECTED,
        wsDelivering: true,
        streamActive: false,
      }).mode,
    ).toBe("stream_inactive");
  });

  test("subscribed but silent (no events) -> fallback polling", () => {
    expect(
      deriveOverlayConnectionState({
        ...CONNECTED,
        realtimeDelivering: false,
      }),
    ).toEqual({ mode: "fallback_polling", label: "Fallback polling" });
  });

  test("expired ranks first (user session state)", () => {
    expect(
      deriveOverlayConnectionState({
        ...CONNECTED,
        isExpired: true,
        liveDetectionsEnabled: false,
        // even with a deeper blocker also set, expired wins
        processingEnabled: false,
      }).mode,
    ).toBe("expired");
  });

  test("off when no session and not expired", () => {
    expect(
      deriveOverlayConnectionState({
        ...CONNECTED,
        liveDetectionsEnabled: false,
      }),
    ).toEqual({ mode: "off", label: "Live detections off" });
  });

  test("processing disabled ranks above stream/freshness once enabled", () => {
    expect(
      deriveOverlayConnectionState({
        ...CONNECTED,
        processingEnabled: false,
        streamActive: false,
      }).mode,
    ).toBe("processing_disabled");
  });

  test("stream inactive", () => {
    expect(
      deriveOverlayConnectionState({ ...CONNECTED, streamActive: false }),
    ).toEqual({ mode: "stream_inactive", label: "Stream inactive" });
  });

  test("processor stale", () => {
    expect(
      deriveOverlayConnectionState({ ...CONNECTED, isStale: true }).mode,
    ).toBe("processor_stale");
  });

  test("connecting (subscribe requested, no status yet)", () => {
    expect(
      deriveOverlayConnectionState({ ...CONNECTED, realtimeStatus: null }).mode,
    ).toBe("connecting");
  });

  test.each(["CHANNEL_ERROR", "TIMED_OUT"] as const)(
    "%s -> reconnecting",
    (status) => {
      expect(
        deriveOverlayConnectionState({ ...CONNECTED, realtimeStatus: status })
          .mode,
      ).toBe("reconnecting");
    },
  );

  test("CLOSED -> fallback polling", () => {
    expect(
      deriveOverlayConnectionState({ ...CONNECTED, realtimeStatus: "CLOSED" })
        .mode,
    ).toBe("fallback_polling");
  });

  test("gate closed but otherwise fine -> fallback polling", () => {
    expect(
      deriveOverlayConnectionState({
        ...CONNECTED,
        shouldUseRealtime: false,
        realtimeStatus: null,
      }),
    ).toEqual({ mode: "fallback_polling", label: "Fallback polling" });
  });
});
