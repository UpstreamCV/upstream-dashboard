// P6-B1 — pure helpers for the latest-frame geometry editor. No React, no
// I/O, no DOM. Importable from server code, client editor state, and
// node-environment vitest.
//
// THE PERSISTENCE BOUNDARY. Editor-local working state (selection, drag
// origin, dirty flag, draft line, tool, etc.) lives in the editor
// component. The ONLY shape that ever round-trips to the api-server is
// `GeometryConfig` from src/lib/api/types.ts — schema source of truth at
// ../upstream-api-server/src/upstream_api/schemas/geometry.py. These
// helpers are the conversion layer; the api-server rejects unknown fields
// with 422, so anything outside `GeometryConfig` MUST NOT make it through
// `editorStateToGeometryConfig`.

import type {
  GeometryConfig,
  GeometryFrame,
  GeometryLine,
  GeometryRoi,
} from "@/lib/api/types";
import { GEOMETRY_LIMITS } from "@/lib/perception/geometry-schema";

/**
 * Active editor tool. P6-B1 added "draw" (line authoring); P6-B2 adds
 * "draw-roi" (polygon ROI authoring). Future tools (exclusion zones,
 * direction-aware lines) extend this union.
 */
export type EditorTool = "select" | "draw" | "draw-roi";

/**
 * What's currently selected. Selection is shape-typed because line and
 * ROI use different edit affordances (line endpoints "a"/"b", ROI vertex
 * indices) and the toolbar copy needs to differ ("Delete line" vs
 * "Delete ROI"). Drag state is tracked separately via window-level
 * pointer listeners; the selection just means "this shape is highlighted
 * and is the target for the Delete button."
 */
export type SelectedGeometry =
  | { kind: "line"; id: string }
  | { kind: "roi"; id: string }
  | null;

/** Normalized canvas-space point; both axes clamped to [0, 1]. */
export interface NormalizedPoint {
  x: number;
  y: number;
}

/**
 * Shapes-only slice of the editor's state. Mirrors the parts of
 * `GeometryConfig` that the editor either reads or writes:
 *  - `lines` — fully editable in P6-B1 (add / select / drag / delete).
 *  - `rois` — read-only passthrough. The editor renders them dim and never
 *    touches them. P6-B2 lifts this restriction.
 *  - `frame` — read-only passthrough. Drawn from the latest-frame source
 *    at editor load time.
 */
export interface EditorShapesState {
  lines: GeometryLine[];
  rois: GeometryRoi[];
  frame: GeometryFrame;
}

// --- load: GeometryConfig → editor state ------------------------------------

/**
 * Initialize editor shapes from a `GeometryConfig`. When `opts.ignoreDefault`
 * is true (typically when the server returned `is_default: true`), the probe
 * default's synthesized lines and rois are dropped so the operator starts
 * from an empty canvas instead of inheriting scaffolding as starter
 * geometry. The frame is always passed through, because its
 * width/height/coordinate_space describe the reference resolution the
 * geometry will be authored against.
 */
export function geometryConfigToEditorState(
  config: GeometryConfig,
  opts: { ignoreDefault?: boolean } = {},
): EditorShapesState {
  if (opts.ignoreDefault) {
    return { lines: [], rois: [], frame: { ...config.frame } };
  }
  return {
    lines: config.lines.map((line) => ({ ...line, points: [...line.points] })),
    rois: config.rois.map((roi) => ({ ...roi, points: [...roi.points] })),
    frame: { ...config.frame },
  };
}

// --- save: editor state → GeometryConfig ------------------------------------

/**
 * Build the `GeometryConfig` to PUT. `rois` and `frame` pass through
 * verbatim — the editor must never mutate them in P6-B1, but this helper
 * is the boundary that documents and enforces the invariant. Any new
 * editor-only field MUST be filtered out here, not silently included.
 */
export function editorStateToGeometryConfig(
  state: EditorShapesState,
): GeometryConfig {
  return {
    version: GEOMETRY_LIMITS.schemaVersion,
    frame: state.frame,
    rois: state.rois,
    lines: state.lines,
  };
}

// --- id / label generators --------------------------------------------------

/**
 * Yield a unique `line-N` slug that does not collide with any existing line
 * id and passes `GEOMETRY_LIMITS.slugPattern`. The rule is "smallest
 * positive integer N for which `line-N` is unused" — `["line-1", "line-3"]`
 * returns `"line-2"` so gaps fill before tails grow. Deterministic across
 * renders for a given existing-set.
 */
export function createLineId(existing: GeometryLine[]): string {
  const used = new Set<number>();
  for (const line of existing) {
    const match = /^line-(\d+)$/.exec(line.id);
    if (match) used.add(Number.parseInt(match[1], 10));
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return `line-${n}`;
}

/**
 * Yield a friendly `Line N` label that mirrors `createLineId`'s counter
 * so id + label stay in sync at creation time. Operator can still rename
 * later (P6-B3 — label editing).
 */
export function createDefaultLineLabel(existing: GeometryLine[]): string {
  const id = createLineId(existing);
  const n = id.slice("line-".length);
  return `Line ${n}`;
}

/**
 * Build a fresh `GeometryLine` from two endpoints. Assigns a unique id +
 * default label, `direction: "any"`, `enabled: true`. The two points are
 * stored verbatim — callers must ensure they're already normalized to
 * [0, 1] (the editor uses `clampNormalized` at the pointer boundary).
 */
export function createLine(
  start: NormalizedPoint,
  end: NormalizedPoint,
  existing: GeometryLine[],
): GeometryLine {
  return {
    id: createLineId(existing),
    label: createDefaultLineLabel(existing),
    points: [start, end],
    direction: "any",
    enabled: true,
  };
}

// --- ROI id / label generators ---------------------------------------------

/**
 * Yield a unique `roi-N` slug for a new ROI. Same gap-filling rule as
 * `createLineId` — `["roi-1", "roi-3"]` returns `"roi-2"`. ROIs and lines
 * are separate id namespaces server-side (per the Pydantic
 * `_reject_duplicate_ids` validator), so a `line-1` doesn't reserve a
 * `roi-1`.
 */
export function createRoiId(existing: GeometryRoi[]): string {
  const used = new Set<number>();
  for (const roi of existing) {
    const match = /^roi-(\d+)$/.exec(roi.id);
    if (match) used.add(Number.parseInt(match[1], 10));
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return `roi-${n}`;
}

/** Mirror of `createRoiId` for the friendly label — `roi-2` → `ROI 2`. */
export function createDefaultRoiLabel(existing: GeometryRoi[]): string {
  const id = createRoiId(existing);
  const n = id.slice("roi-".length);
  return `ROI ${n}`;
}

/**
 * Build a fresh `GeometryRoi` from at least three vertices. Assigns a
 * unique id + default label, `type: "polygon"`, `enabled: true`. Vertices
 * are stored verbatim — callers must ensure they're normalized.
 */
export function createRoi(
  points: NormalizedPoint[],
  existing: GeometryRoi[],
): GeometryRoi {
  return {
    id: createRoiId(existing),
    label: createDefaultRoiLabel(existing),
    type: "polygon",
    points,
    enabled: true,
  };
}

/**
 * Replace a single vertex on the named ROI. Returns a new shapes state;
 * other ROIs, all lines, and the frame pass through unchanged. The ROI's
 * id / label / type / enabled are preserved — vertex edits never change
 * the ROI's identity (so observation lineage tied to roi-N survives an
 * edit, which matters once reliability features land in P6-D+).
 *
 * Out-of-range vertexIndex is a silent no-op — the caller (the SVG drag
 * handler) is the only producer of these indices and always sources them
 * from the ROI's current vertex count.
 */
export function updateRoiPoint(
  state: EditorShapesState,
  roiId: string,
  vertexIndex: number,
  p: NormalizedPoint,
): EditorShapesState {
  return {
    ...state,
    rois: state.rois.map((roi) => {
      if (roi.id !== roiId) return roi;
      if (vertexIndex < 0 || vertexIndex >= roi.points.length) return roi;
      const points = roi.points.map((existing, idx) =>
        idx === vertexIndex ? p : existing,
      );
      return { ...roi, points };
    }),
  };
}

// --- coordinate helpers -----------------------------------------------------

/**
 * Clamp both axes of a candidate point to [0, 1]. Used at the pointer
 * boundary so a pointer that escapes the canvas yields an in-range
 * normalized point instead of pushing the geometry off-frame.
 */
export function clampNormalized(p: {
  x: number;
  y: number;
}): NormalizedPoint {
  return {
    x: Math.min(1, Math.max(0, p.x)),
    y: Math.min(1, Math.max(0, p.y)),
  };
}
