import { describe, expect, it } from "vitest";

import type { OverlayObject } from "./overlay-helpers";
import {
  BOX_SMOOTHING_ALPHA,
  CONFIDENCE_SMOOTHING_ALPHA,
  DISAPPEAR_GRACE_MS,
  DetectionSmoother,
  passthroughDisplayObjects,
} from "./overlay-smoothing";

const FRAME = 1000 / 60;

function obj(
  trackId: string | null,
  box: { x: number; y: number; w: number; h: number },
  confidence: number | null = 0.9,
): OverlayObject {
  return {
    object: { track_id: trackId, label: "person", confidence },
    box,
  };
}

describe("DetectionSmoother — box interpolation", () => {
  it("new tracks appear exactly at their first position (no fly-in)", () => {
    const s = new DetectionSmoother();
    s.setTargets([obj("t1", { x: 50, y: 60, w: 20, h: 40 })], 0);
    const [d] = s.sample(0);
    expect(d.box).toEqual({ x: 50, y: 60, w: 20, h: 40 });
    expect(d.opacity).toBe(1);
    expect(d.key).toBe("t1");
  });

  it("moves the display box toward a new target by alpha per 60Hz frame", () => {
    const s = new DetectionSmoother();
    s.setTargets([obj("t1", { x: 0, y: 0, w: 10, h: 10 })], 0);
    s.sample(0); // settle at the origin
    s.setTargets([obj("t1", { x: 100, y: 0, w: 10, h: 10 })], 0);
    const [d] = s.sample(FRAME); // exactly one reference frame later
    expect(d.box.x).toBeCloseTo(100 * BOX_SMOOTHING_ALPHA, 5);
    expect(d.box.y).toBe(0);
  });

  it("converges onto the target and reports rest", () => {
    const s = new DetectionSmoother();
    s.setTargets([obj("t1", { x: 0, y: 0, w: 10, h: 10 })], 0);
    s.sample(0);
    s.setTargets([obj("t1", { x: 100, y: 50, w: 30, h: 20 })], 0);
    let t = 0;
    let last = { x: -1, y: -1, w: -1, h: -1 };
    for (let i = 0; i < 60; i++) {
      t += FRAME;
      [{ box: last }] = s.sample(t);
    }
    expect(last).toEqual({ x: 100, y: 50, w: 30, h: 20 }); // epsilon snap
    expect(s.hasPendingMotion()).toBe(false);
  });

  it("movement is monotonic toward the target (glide, not snap)", () => {
    const s = new DetectionSmoother();
    s.setTargets([obj("t1", { x: 0, y: 0, w: 10, h: 10 })], 0);
    s.sample(0);
    s.setTargets([obj("t1", { x: 200, y: 0, w: 10, h: 10 })], 0);
    const xs: number[] = [];
    for (let i = 1; i <= 5; i++) xs.push(s.sample(i * FRAME)[0].box.x);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1]);
      expect(xs[i]).toBeLessThan(200);
    }
  });

  it("normalizes for frame rate: one 2-frame sample ≈ two 1-frame samples", () => {
    const a = new DetectionSmoother();
    a.setTargets([obj("t1", { x: 0, y: 0, w: 10, h: 10 })], 0);
    a.sample(0);
    a.setTargets([obj("t1", { x: 100, y: 0, w: 10, h: 10 })], 0);
    a.sample(FRAME);
    const twoSteps = a.sample(2 * FRAME)[0].box.x;

    const b = new DetectionSmoother();
    b.setTargets([obj("t1", { x: 0, y: 0, w: 10, h: 10 })], 0);
    b.sample(0);
    b.setTargets([obj("t1", { x: 100, y: 0, w: 10, h: 10 })], 0);
    const oneBigStep = b.sample(2 * FRAME)[0].box.x;

    expect(oneBigStep).toBeCloseTo(twoSteps, 3);
  });
});

describe("DetectionSmoother — disappearance grace window", () => {
  it("keeps a vanished box visible and fades it during the grace window", () => {
    const s = new DetectionSmoother();
    s.setTargets([obj("t1", { x: 10, y: 10, w: 10, h: 10 })], 0);
    s.sample(0);
    s.setTargets([], 1000); // gone from the latest update
    const mid = s.sample(1000 + DISAPPEAR_GRACE_MS / 2);
    expect(mid).toHaveLength(1);
    expect(mid[0].opacity).toBeCloseTo(0.5, 1);
    expect(mid[0].box.x).toBe(10); // still where it was
  });

  it("removes the box after the grace window elapses", () => {
    const s = new DetectionSmoother();
    s.setTargets([obj("t1", { x: 10, y: 10, w: 10, h: 10 })], 0);
    s.sample(0);
    s.setTargets([], 1000);
    expect(s.sample(1000 + DISAPPEAR_GRACE_MS + 1)).toHaveLength(0);
    expect(s.hasPendingMotion()).toBe(false);
  });

  it("a track reappearing within grace returns to full opacity and glides", () => {
    const s = new DetectionSmoother();
    s.setTargets([obj("t1", { x: 10, y: 0, w: 10, h: 10 })], 0);
    s.sample(0);
    s.setTargets([], 1000);
    s.sample(1000 + 100);
    s.setTargets([obj("t1", { x: 30, y: 0, w: 10, h: 10 })], 1000 + 150);
    const [d] = s.sample(1000 + 150 + FRAME);
    expect(d.opacity).toBe(1);
    expect(d.box.x).toBeGreaterThan(10); // gliding from the old spot...
    expect(d.box.x).toBeLessThan(30); // ...not teleporting to the new one
  });

  it("a track that expired re-enters fresh at its new position (state evicted)", () => {
    const s = new DetectionSmoother();
    s.setTargets([obj("t1", { x: 10, y: 0, w: 10, h: 10 })], 0);
    s.sample(0);
    s.setTargets([], 1000);
    s.sample(1000 + DISAPPEAR_GRACE_MS + 50); // evicted
    s.setTargets([obj("t1", { x: 500, y: 0, w: 10, h: 10 })], 5000);
    const [d] = s.sample(5000);
    expect(d.box.x).toBe(500); // no lerp from the dead entry's position
  });
});

describe("DetectionSmoother — confidence label smoothing", () => {
  it("EMAs the displayed confidence without touching the raw object", () => {
    const s = new DetectionSmoother();
    const first = obj("t1", { x: 0, y: 0, w: 10, h: 10 }, 0.9);
    s.setTargets([first], 0);
    s.sample(0);
    const second = obj("t1", { x: 0, y: 0, w: 10, h: 10 }, 0.5);
    s.setTargets([second], 100);
    const [d] = s.sample(100);
    const expected = 0.9 + CONFIDENCE_SMOOTHING_ALPHA * (0.5 - 0.9);
    expect(d.object.confidence).toBeCloseTo(expected, 5);
    // Raw inputs are never mutated — display is a copy.
    expect(second.object.confidence).toBe(0.5);
    expect(d.object).not.toBe(second.object);
  });

  it("missing/non-finite confidence leaves the displayed value alone", () => {
    const s = new DetectionSmoother();
    s.setTargets([obj("t1", { x: 0, y: 0, w: 10, h: 10 }, 0.8)], 0);
    s.setTargets([obj("t1", { x: 0, y: 0, w: 10, h: 10 }, null)], 100);
    const [d] = s.sample(100);
    expect(d.object.confidence).toBe(0.8);
  });
});

describe("DetectionSmoother — untracked objects", () => {
  it("objects without a track_id pass through raw (no smoothing)", () => {
    const s = new DetectionSmoother();
    s.setTargets([obj(null, { x: 0, y: 0, w: 10, h: 10 })], 0);
    s.sample(0);
    s.setTargets([obj(null, { x: 100, y: 0, w: 10, h: 10 })], 100);
    const [d] = s.sample(100 + FRAME);
    expect(d.box.x).toBe(100); // immediate — identity-less boxes never lerp
    expect(d.opacity).toBe(1);
    expect(d.key).toBe("untracked-0");
  });
});

describe("passthroughDisplayObjects (smoothing disabled)", () => {
  it("maps raw selections 1:1 with opacity 1 and stable keys", () => {
    const raw = [
      obj("t9", { x: 1, y: 2, w: 3, h: 4 }),
      obj(null, { x: 5, y: 6, w: 7, h: 8 }),
    ];
    const out = passthroughDisplayObjects(raw);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ key: "t9", opacity: 1, box: raw[0].box });
    expect(out[1]).toMatchObject({ key: "untracked-1", opacity: 1 });
    expect(out[0].object).toBe(raw[0].object); // untouched references
  });
});
