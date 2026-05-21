import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { PerceptionObject } from "@/lib/api/types";
import type { NormalizedSnapshot } from "./perception-overlay";
import { PerceptionOverlaySvg } from "./perception-overlay-svg";

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

function snap(over: Partial<NormalizedSnapshot> = {}): NormalizedSnapshot {
  return {
    frameWidth: 1280,
    frameHeight: 720,
    frameNum: 1,
    fps: 1,
    objects: [],
    rois: [],
    lines: [],
    ...over,
  };
}

const PERSON = obj({
  track_id: "3",
  label: "person",
  confidence: 0.42,
  bbox: { x: 595.95, y: 86.69, w: 340.3, h: 631.99 },
  roi_labels: ["entry-roi"],
});

const ENTRY_ROI = {
  id: "entry-roi",
  label: "entry-roi",
  points: [
    { x: 100, y: 100 },
    { x: 400, y: 100 },
    { x: 400, y: 400 },
    { x: 100, y: 400 },
  ],
};

const ENTRY_LINE = {
  id: "entry-line",
  label: "entry-line",
  points: [
    { x: 0, y: 360 },
    { x: 1280, y: 360 },
  ],
};

function render(props: Partial<Parameters<typeof PerceptionOverlaySvg>[0]> = {}) {
  return renderToStaticMarkup(
    <PerceptionOverlaySvg
      snapshot={snap({ objects: [PERSON], rois: [ENTRY_ROI], lines: [ENTRY_LINE] })}
      showBoxes
      showLabels
      showGeometry
      minConfidence={0}
      {...props}
    />,
  );
}

describe("PerceptionOverlaySvg", () => {
  test("draws an object box, its label, the ROI polygon and the entry line", () => {
    const html = render();
    expect(html).toContain("<svg");
    expect(html).toContain("viewBox=\"0 0 1280 720\"");
    expect(html).toContain("<rect"); // object bounding box
    expect(html).toContain("<polygon"); // ROI
    expect(html).toContain("<polyline"); // entry line
    expect(html).toContain("person #3 · entry-roi · 42%");
    expect(html).toContain("entry-line");
  });

  test("hides object boxes when showBoxes is off", () => {
    const html = render({ showBoxes: false });
    expect(html).not.toContain("<rect");
    // Geometry is independent of the boxes toggle.
    expect(html).toContain("<polygon");
  });

  test("hides every label when showLabels is off", () => {
    const html = render({ showLabels: false });
    expect(html).not.toContain("<text");
    // The box itself still draws.
    expect(html).toContain("<rect");
  });

  test("hides ROI polygons and lines when showGeometry is off", () => {
    const html = render({ showGeometry: false });
    expect(html).not.toContain("<polygon");
    expect(html).not.toContain("<polyline");
    // The object box still draws.
    expect(html).toContain("<rect");
  });

  test("filters out objects below the confidence threshold", () => {
    expect(render({ minConfidence: 0.75 })).not.toContain("<rect");
    expect(render({ minConfidence: 0.25 })).toContain("<rect");
  });

  test("draws a box from bbox_normalized when no pixel bbox is present", () => {
    const normalized = obj({
      label: "person",
      bbox_normalized: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
    });
    const html = renderToStaticMarkup(
      <PerceptionOverlaySvg
        snapshot={snap({ frameWidth: 1000, frameHeight: 1000, objects: [normalized] })}
        showBoxes
        showLabels
        showGeometry
        minConfidence={0}
      />,
    );
    expect(html).toContain("<rect");
    expect(html).toContain('width="200"');
  });

  test("skips an object with no bounding box without throwing", () => {
    const html = renderToStaticMarkup(
      <PerceptionOverlaySvg
        snapshot={snap({ objects: [obj({ label: "ghost" })] })}
        showBoxes
        showLabels
        showGeometry
        minConfidence={0}
      />,
    );
    expect(html).toContain("<svg");
    expect(html).not.toContain("<rect");
  });

  test("renders nothing when the snapshot has no frame dimensions", () => {
    const html = renderToStaticMarkup(
      <PerceptionOverlaySvg
        snapshot={snap({ frameWidth: null, frameHeight: null, objects: [PERSON] })}
        showBoxes
        showLabels
        showGeometry
        minConfidence={0}
      />,
    );
    expect(html).toBe("");
  });
});
