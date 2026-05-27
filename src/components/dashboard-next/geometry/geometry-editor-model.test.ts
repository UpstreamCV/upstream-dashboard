import { describe, expect, test } from "vitest";
import type { GeometryConfig, GeometryLine, GeometryRoi } from "@/lib/api/types";
import { GEOMETRY_LIMITS } from "@/lib/perception/geometry-schema";
import {
  clampNormalized,
  createDefaultLineLabel,
  createLine,
  createLineId,
  editorStateToGeometryConfig,
  geometryConfigToEditorState,
} from "@/components/dashboard-next/geometry/geometry-editor-model";

// Fixture helpers — small factories so each test only states what differs.

function line(over: Partial<GeometryLine> = {}): GeometryLine {
  return {
    id: "line-1",
    label: "Line 1",
    points: [
      { x: 0.1, y: 0.5 },
      { x: 0.9, y: 0.5 },
    ],
    direction: "any",
    enabled: true,
    ...over,
  };
}

function roi(over: Partial<GeometryRoi> = {}): GeometryRoi {
  return {
    id: "entry-roi",
    label: "Entry ROI",
    type: "polygon",
    points: [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.5, y: 0.9 },
    ],
    enabled: true,
    ...over,
  };
}

function config(over: Partial<GeometryConfig> = {}): GeometryConfig {
  return {
    version: 1,
    frame: { width: 1280, height: 720, coordinate_space: "normalized" },
    rois: [roi()],
    lines: [line()],
    ...over,
  };
}

describe("geometryConfigToEditorState", () => {
  test("shallow-copies lines / rois / frame by default", () => {
    const c = config();
    const s = geometryConfigToEditorState(c);
    expect(s.lines).toEqual(c.lines);
    expect(s.rois).toEqual(c.rois);
    expect(s.frame).toEqual(c.frame);
    // Mutating the editor state must not mutate the source config — the
    // helper copies arrays + objects so the editor can edit in place.
    s.lines.push(line({ id: "line-2" }));
    expect(c.lines).toHaveLength(1);
  });

  test("ignoreDefault drops lines and rois but keeps the frame", () => {
    const c = config();
    const s = geometryConfigToEditorState(c, { ignoreDefault: true });
    expect(s.lines).toEqual([]);
    expect(s.rois).toEqual([]);
    expect(s.frame).toEqual(c.frame);
  });
});

describe("editorStateToGeometryConfig", () => {
  test("returns a valid GeometryConfig with schemaVersion + frame intact", () => {
    const c = config();
    const s = geometryConfigToEditorState(c);
    const out = editorStateToGeometryConfig(s);
    expect(out.version).toBe(GEOMETRY_LIMITS.schemaVersion);
    expect(out.frame.coordinate_space).toBe("normalized");
    expect(out.frame).toEqual(c.frame);
  });

  test("round-trip with no edits preserves the whole config", () => {
    const c = config({
      rois: [
        roi({ id: "roi-a" }),
        roi({ id: "roi-b", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }),
      ],
      lines: [
        line({ id: "line-1" }),
        line({ id: "line-2", points: [{ x: 0, y: 0.25 }, { x: 1, y: 0.25 }] }),
      ],
    });
    const out = editorStateToGeometryConfig(geometryConfigToEditorState(c));
    expect(out).toEqual(c);
  });

  test("ROI passthrough survives line edits — the load-bearing safety guarantee", () => {
    const c = config({
      rois: [roi({ id: "roi-a" }), roi({ id: "roi-b" })],
      lines: [line({ id: "line-1" })],
    });
    const s = geometryConfigToEditorState(c);

    // Simulate the editor: delete the existing line, draw a new one.
    s.lines = [];
    const fresh = createLine(
      { x: 0.2, y: 0.7 },
      { x: 0.8, y: 0.7 },
      s.lines,
    );
    s.lines.push(fresh);

    const out = editorStateToGeometryConfig(s);
    expect(out.rois).toEqual(c.rois);     // both ROIs untouched
    expect(out.rois).toHaveLength(2);
    expect(out.lines).toHaveLength(1);
    expect(out.lines[0].id).toBe(fresh.id);
  });

  test("deleting a single line removes only that line", () => {
    const c = config({
      lines: [
        line({ id: "line-1" }),
        line({ id: "line-2", points: [{ x: 0, y: 0.3 }, { x: 1, y: 0.3 }] }),
        line({ id: "line-3", points: [{ x: 0, y: 0.7 }, { x: 1, y: 0.7 }] }),
      ],
    });
    const s = geometryConfigToEditorState(c);
    s.lines = s.lines.filter((l) => l.id !== "line-2");
    const out = editorStateToGeometryConfig(s);
    expect(out.lines.map((l) => l.id)).toEqual(["line-1", "line-3"]);
  });
});

describe("createLineId", () => {
  test("returns line-1 for an empty set", () => {
    expect(createLineId([])).toBe("line-1");
  });

  test("matches the GeometrySlug pattern", () => {
    const id = createLineId([line()]);
    expect(GEOMETRY_LIMITS.slugPattern.test(id)).toBe(true);
  });

  test("fills numeric gaps before tail growth", () => {
    const existing = [
      line({ id: "line-1" }),
      line({ id: "line-3" }),
    ];
    expect(createLineId(existing)).toBe("line-2");
  });

  test("grows past the highest existing number when no gap exists", () => {
    const existing = [
      line({ id: "line-1" }),
      line({ id: "line-2" }),
      line({ id: "line-3" }),
    ];
    expect(createLineId(existing)).toBe("line-4");
  });

  test("ignores non-conforming existing ids when deciding next", () => {
    // A line with a custom slug like "entry-line" doesn't reserve any
    // line-N number; the helper still issues line-1.
    expect(createLineId([line({ id: "entry-line" })])).toBe("line-1");
  });
});

describe("createDefaultLineLabel", () => {
  test("mirrors createLineId — id `line-2` ↔ label `Line 2`", () => {
    const existing = [line({ id: "line-1" }), line({ id: "line-3" })];
    expect(createDefaultLineLabel(existing)).toBe("Line 2");
  });

  test("label is non-empty and ≤ maxLabelLen", () => {
    const label = createDefaultLineLabel([]);
    expect(label.length).toBeGreaterThan(0);
    expect(label.length).toBeLessThanOrEqual(GEOMETRY_LIMITS.maxLabelLen);
  });
});

describe("createLine", () => {
  test("produces a valid line with normalized endpoints + defaults", () => {
    const fresh = createLine({ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }, []);
    expect(fresh.id).toBe("line-1");
    expect(fresh.label).toBe("Line 1");
    expect(fresh.direction).toBe("any");
    expect(fresh.enabled).toBe(true);
    expect(fresh.points).toEqual([
      { x: 0.1, y: 0.5 },
      { x: 0.9, y: 0.5 },
    ]);
  });

  test("does not collide with existing ids", () => {
    const existing = [line({ id: "line-1" })];
    const fresh = createLine({ x: 0, y: 0 }, { x: 1, y: 1 }, existing);
    expect(fresh.id).not.toBe("line-1");
    expect(GEOMETRY_LIMITS.slugPattern.test(fresh.id)).toBe(true);
  });
});

describe("clampNormalized", () => {
  test("passes through in-range points unchanged", () => {
    expect(clampNormalized({ x: 0.25, y: 0.75 })).toEqual({ x: 0.25, y: 0.75 });
    expect(clampNormalized({ x: 0, y: 1 })).toEqual({ x: 0, y: 1 });
  });

  test("clamps negative axes to 0 and >1 axes to 1", () => {
    expect(clampNormalized({ x: -0.3, y: 1.7 })).toEqual({ x: 0, y: 1 });
    expect(clampNormalized({ x: 5, y: -5 })).toEqual({ x: 1, y: 0 });
  });
});
