import { describe, expect, test } from "vitest";
import type { PerceptionObject } from "@/lib/api/types";
import {
  buildLatestPerceptionPath,
  centroid,
  confidencePercent,
  formatObjectLabel,
  hasFrameDimensions,
  normalizeSnapshot,
  objectName,
  pointsToAttr,
  resolveBBox,
  selectOverlayObjects,
} from "./perception-overlay";

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
