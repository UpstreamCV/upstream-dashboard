"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { GeometryLine, GeometryRoi } from "@/lib/api/types";
import type {
  NormalizedPoint,
  SelectedGeometry,
} from "@/components/dashboard-next/geometry/geometry-editor-model";
import { OVERLAY_COLORS } from "@/lib/perception/overlay-helpers";

// P6-B1 / B2 / B3 — pure SVG overlay for the geometry editor.
//
// COORDINATE SYSTEM: no viewBox. Positions for <line> + <circle> use
// percentage strings (their x1/y1/cx/cy attrs accept them and resolve
// against the SVG's actual viewport). Sizes (stroke widths, handle
// radii) are device pixels.
//
// POLYGON CAVEAT (P6-B3 fix): <polygon>'s `points` attribute is defined
// by SVG as a list of <number> coordinates — percentages are NOT valid
// syntax there. P6-B2 erroneously used percentages on `points`; browsers
// silently parsed the numeric prefix ("10%,10%" → "10,10"), placing
// polygons at near-origin device pixels (~10×10 px). The result: no
// visible polygon border, no fill, no hover (no rendered shape to hit),
// no whole-shape drag. Fix: measure the SVG's actual size via
// ResizeObserver + useLayoutEffect, then compute polygon points in
// device pixels = (normalized × measured size). Re-renders on container
// resize. Lines + circles are unaffected (their attrs accept percentages).
//
// P6-B3 additions: three-tier ROI fill (normal / hovered / selected);
// draft polygon gets a translucent fill once ≥ 3 vertices exist; an
// `interactive` flag gates pointer-events on every existing-shape hit
// target. When false (any non-Select tool), clicks pass through to the
// canvas so the operator can place a draw-mode vertex on top of an
// existing ROI without accidentally selecting it. Draft hit targets
// (close-target on the first vertex) stay interactive regardless.

interface GeometryEditorSvgProps {
  lines: GeometryLine[];
  rois: GeometryRoi[];
  selected: SelectedGeometry;
  hoveredRoiId: string | null;
  /** False during draw modes — existing shapes pass through clicks. */
  interactive: boolean;
  lineDraft: { start: NormalizedPoint; current: NormalizedPoint } | null;
  roiDraft:
    | { points: NormalizedPoint[]; current: NormalizedPoint | null }
    | null;
  onLineSelect: (id: string) => void;
  /**
   * Polygon interior pointerdown. The panel decides whether this just
   * selects or also starts a whole-ROI drag based on the active tool.
   * Renamed from onRoiSelect in P6-B3 because the polygon now drives
   * drag, not just selection.
   */
  onRoiPointerDown: (id: string, e: React.PointerEvent) => void;
  onLineEndpointPointerDown: (
    lineId: string,
    endpoint: "a" | "b",
    e: React.PointerEvent,
  ) => void;
  onRoiVertexPointerDown: (
    roiId: string,
    vertexIndex: number,
    e: React.PointerEvent,
  ) => void;
  onRoiHoverChange: (id: string | null) => void;
  onRoiDraftClose?: () => void;
}

// Device-pixel sizes — read directly, no scaling.
const LINE_WIDTH = 3;
const LINE_WIDTH_SELECTED = 4;
const HIT_TARGET_WIDTH = 18;          // transparent, just for easier click-on-line
const ROI_STROKE = 2;
const ROI_STROKE_HOVERED = 2.5;
const ROI_STROKE_SELECTED = 3;
const HANDLE_RADIUS = 9;
const HANDLE_RADIUS_SELECTED = 11;
const HANDLE_STROKE = 2.5;
const HANDLE_STROKE_SELECTED = 3.5;
const HANDLE_INNER_RADIUS = 3;
const ROI_VERTEX_RADIUS = 7;
const ROI_VERTEX_RADIUS_SELECTED = 9;
const ROI_VERTEX_STROKE = 2;
const ROI_VERTEX_STROKE_SELECTED = 3;
const ROI_CLOSE_TARGET_RADIUS = 10;

// Color palette. Lines = amber (OVERLAY_COLORS.line); ROIs = sage
// (OVERLAY_COLORS.box). Three ROI fill tiers — single hue, varying
// alpha — communicate "this polygon has an interior" at every state.
const LINE_COLOR = OVERLAY_COLORS.line;            // "#e8c06b"
const LINE_COLOR_SELECTED = "#fde68a";             // brighter amber
const ROI_COLOR = OVERLAY_COLORS.box;              // "#5fb869"
const ROI_COLOR_SELECTED = "#a7e3a8";              // brighter sage
const ROI_FILL_NORMAL = "rgba(95, 184, 105, 0.10)";
const ROI_FILL_HOVERED = "rgba(95, 184, 105, 0.22)";
const ROI_FILL_SELECTED = "rgba(95, 184, 105, 0.34)";
const ROI_FILL_DRAFT = "rgba(95, 184, 105, 0.18)";
const HANDLE_FILL = "#ffffff";
const HANDLE_INNER_FILL_SELECTED = LINE_COLOR_SELECTED;

function pct(n: number): string {
  return `${n * 100}%`;
}

// Polygon points must be NUMBERS (device pixels). See header note.
// `w` / `h` are the SVG's actual rendered size from the ResizeObserver.
function roiPointsAttr(
  points: NormalizedPoint[],
  w: number,
  h: number,
): string {
  return points.map((p) => `${p.x * w},${p.y * h}`).join(" ");
}

export function GeometryEditorSvg({
  lines,
  rois,
  selected,
  hoveredRoiId,
  interactive,
  lineDraft,
  roiDraft,
  onLineSelect,
  onRoiPointerDown,
  onLineEndpointPointerDown,
  onRoiVertexPointerDown,
  onRoiHoverChange,
  onRoiDraftClose,
}: GeometryEditorSvgProps) {
  const selectedLineId = selected?.kind === "line" ? selected.id : null;
  const selectedRoiId = selected?.kind === "roi" ? selected.id : null;
  const draftCanClose = (roiDraft?.points.length ?? 0) >= 3;

  // Hit-target enablement. Existing shapes opt back into pointer events
  // only when the operator is in Select mode (otherwise clicks pass
  // through to the canvas for placing draw-mode vertices).
  const shapePointerEvents: React.CSSProperties["pointerEvents"] = interactive
    ? "auto"
    : "none";

  // Measure the SVG's rendered size in device pixels so polygon points
  // (which must be numbers, not percentages — see header note) can be
  // computed correctly. useLayoutEffect + initial getBoundingClientRect
  // guarantees the size is known before first paint, so polygons don't
  // briefly render at (0, 0). ResizeObserver keeps them in sync if the
  // container reshapes (responsive layout, window resize, etc).
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Until we've measured at least once, polygon coords would all be 0.
  // Hide polygons in that first paint (other shapes still render).
  const polygonsReady = size.w > 0 && size.h > 0;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 h-full w-full"
      // SVG root never eats events — individual hit targets opt in.
      style={{ pointerEvents: "none" }}
      aria-label="Geometry overlay"
    >
      {/* Soft drop shadow for selected handles. */}
      <defs>
        <filter id="handle-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" />
          <feOffset dx="0" dy="1" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.35" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Editable ROI polygons. Three fill states by selected/hover/normal.
          Per-vertex handles render only when the ROI is selected.
          Polygon rendering is gated on `polygonsReady` so we don't briefly
          render at (0, 0) before the ResizeObserver fires. */}
      {polygonsReady && rois.map((roi) => {
        const isSel = roi.id === selectedRoiId;
        const isHov = roi.id === hoveredRoiId;
        const stroke = isSel ? ROI_COLOR_SELECTED : ROI_COLOR;
        const fill = isSel
          ? ROI_FILL_SELECTED
          : isHov
            ? ROI_FILL_HOVERED
            : ROI_FILL_NORMAL;
        const strokeWidth = isSel
          ? ROI_STROKE_SELECTED
          : isHov
            ? ROI_STROKE_HOVERED
            : ROI_STROKE;
        return (
          <g key={`roi-${roi.id}`}>
            <polygon
              points={roiPointsAttr(roi.points, size.w, size.h)}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
              style={{
                pointerEvents: shapePointerEvents,
                // `move` cursor signals draggability when interactive;
                // otherwise the cursor reflects whatever tool is active
                // (the FrameCanvas / panel set it via className).
                cursor: interactive ? "move" : "default",
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onRoiPointerDown(roi.id, e);
              }}
              onPointerEnter={() => onRoiHoverChange(roi.id)}
              onPointerLeave={() => onRoiHoverChange(null)}
            />
            {/* Per-vertex handles on selected ROIs. Pointer events also
                gated by `interactive` so they don't capture during draw. */}
            {isSel
              ? roi.points.map((p, idx) => (
                  <circle
                    key={`v-${idx}`}
                    cx={pct(p.x)}
                    cy={pct(p.y)}
                    r={ROI_VERTEX_RADIUS_SELECTED}
                    fill={HANDLE_FILL}
                    stroke={ROI_COLOR_SELECTED}
                    strokeWidth={ROI_VERTEX_STROKE_SELECTED}
                    filter="url(#handle-shadow)"
                    style={{
                      pointerEvents: shapePointerEvents,
                      cursor: interactive ? "grab" : "default",
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onRoiVertexPointerDown(roi.id, idx, e);
                    }}
                  />
                ))
              : // Quiet vertex dots on unselected ROIs — purely visual,
                // no pointer events.
                roi.points.map((p, idx) => (
                  <circle
                    key={`v-${idx}`}
                    cx={pct(p.x)}
                    cy={pct(p.y)}
                    r={ROI_VERTEX_RADIUS}
                    fill={HANDLE_FILL}
                    stroke={ROI_COLOR}
                    strokeWidth={ROI_VERTEX_STROKE}
                    style={{ pointerEvents: "none" }}
                  />
                ))}
          </g>
        );
      })}

      {/* Lines — visible stroke + invisible wide hit-target + endpoint
          handles. All hit-targets gated by `interactive`. */}
      {lines.map((line) => {
        const [a, b] = line.points;
        if (!a || !b) return null;
        const isSel = line.id === selectedLineId;
        const color = isSel ? LINE_COLOR_SELECTED : LINE_COLOR;
        return (
          <g key={`line-${line.id}`}>
            <line
              x1={pct(a.x)}
              y1={pct(a.y)}
              x2={pct(b.x)}
              y2={pct(b.y)}
              stroke="transparent"
              strokeWidth={HIT_TARGET_WIDTH}
              strokeLinecap="round"
              style={{
                pointerEvents: interactive ? "stroke" : "none",
                cursor: interactive ? "pointer" : "default",
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onLineSelect(line.id);
              }}
            />
            <line
              x1={pct(a.x)}
              y1={pct(a.y)}
              x2={pct(b.x)}
              y2={pct(b.y)}
              stroke={color}
              strokeWidth={isSel ? LINE_WIDTH_SELECTED : LINE_WIDTH}
              strokeLinecap="round"
              style={{ pointerEvents: "none" }}
            />
            {(["a", "b"] as const).map((endpoint, idx) => {
              const p = idx === 0 ? a : b;
              const r = isSel ? HANDLE_RADIUS_SELECTED : HANDLE_RADIUS;
              const sw = isSel ? HANDLE_STROKE_SELECTED : HANDLE_STROKE;
              return (
                <g key={endpoint}>
                  <circle
                    cx={pct(p.x)}
                    cy={pct(p.y)}
                    r={r}
                    fill={HANDLE_FILL}
                    stroke={color}
                    strokeWidth={sw}
                    filter={isSel ? "url(#handle-shadow)" : undefined}
                    style={{
                      pointerEvents: shapePointerEvents,
                      cursor: interactive ? "grab" : "default",
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onLineEndpointPointerDown(line.id, endpoint, e);
                    }}
                  />
                  {isSel ? (
                    <circle
                      cx={pct(p.x)}
                      cy={pct(p.y)}
                      r={HANDLE_INNER_RADIUS}
                      fill={HANDLE_INNER_FILL_SELECTED}
                      style={{ pointerEvents: "none" }}
                    />
                  ) : null}
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Line draft preview. */}
      {lineDraft ? (
        <g style={{ pointerEvents: "none" }}>
          <line
            x1={pct(lineDraft.start.x)}
            y1={pct(lineDraft.start.y)}
            x2={pct(lineDraft.current.x)}
            y2={pct(lineDraft.current.y)}
            stroke={LINE_COLOR}
            strokeWidth={LINE_WIDTH}
            strokeDasharray="8 6"
            strokeLinecap="round"
          />
          <circle
            cx={pct(lineDraft.start.x)}
            cy={pct(lineDraft.start.y)}
            r={HANDLE_RADIUS - 1}
            fill={HANDLE_FILL}
            stroke={LINE_COLOR}
            strokeWidth={HANDLE_STROKE}
          />
        </g>
      ) : null}

      {/* ROI draft preview. At 3+ vertices, fill the polygon's interior
          with a draft-tier fill so the operator sees the shape they'd
          commit if they hit Finish ROI right now. The fill sits UNDER
          the polyline + cursor preview. */}
      {roiDraft && roiDraft.points.length > 0 ? (
        <g>
          {/* Translucent fill for the in-progress polygon, ≥ 3 vertices.
              Gated on `polygonsReady` for the same reason as saved ROIs. */}
          {polygonsReady && roiDraft.points.length >= 3 ? (
            <polygon
              points={roiPointsAttr(roiDraft.points, size.w, size.h)}
              fill={ROI_FILL_DRAFT}
              stroke="none"
              style={{ pointerEvents: "none" }}
            />
          ) : null}

          {/* Solid polyline through committed draft vertices. */}
          {polygonsReady && roiDraft.points.length >= 2 ? (
            <polyline
              points={roiPointsAttr(roiDraft.points, size.w, size.h)}
              fill="none"
              stroke={ROI_COLOR}
              strokeWidth={ROI_STROKE}
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{ pointerEvents: "none" }}
            />
          ) : null}

          {/* Dashed preview from last placed vertex to cursor. */}
          {roiDraft.current ? (
            <line
              x1={pct(roiDraft.points[roiDraft.points.length - 1].x)}
              y1={pct(roiDraft.points[roiDraft.points.length - 1].y)}
              x2={pct(roiDraft.current.x)}
              y2={pct(roiDraft.current.y)}
              stroke={ROI_COLOR}
              strokeWidth={ROI_STROKE}
              strokeDasharray="8 6"
              strokeLinecap="round"
              style={{ pointerEvents: "none" }}
            />
          ) : null}

          {/* Faint close-back preview from cursor to first vertex once
              ≥ 3 vertices exist — visualizes "click here to close." */}
          {draftCanClose && roiDraft.current ? (
            <line
              x1={pct(roiDraft.current.x)}
              y1={pct(roiDraft.current.y)}
              x2={pct(roiDraft.points[0].x)}
              y2={pct(roiDraft.points[0].y)}
              stroke={ROI_COLOR}
              strokeWidth={ROI_STROKE}
              strokeDasharray="3 4"
              strokeOpacity={0.55}
              strokeLinecap="round"
              style={{ pointerEvents: "none" }}
            />
          ) : null}

          {/* Vertex markers. First vertex grows into a close-target at
              ≥ 3 vertices — that hit-target is ALWAYS interactive
              regardless of `interactive`, because it belongs to the
              active draft, not an existing shape. */}
          {roiDraft.points.map((p, idx) => {
            const isFirst = idx === 0;
            const isCloseTarget = isFirst && draftCanClose;
            return (
              <circle
                key={`d-v-${idx}`}
                cx={pct(p.x)}
                cy={pct(p.y)}
                r={isCloseTarget ? ROI_CLOSE_TARGET_RADIUS : ROI_VERTEX_RADIUS}
                fill={HANDLE_FILL}
                stroke={ROI_COLOR}
                strokeWidth={isCloseTarget ? ROI_VERTEX_STROKE_SELECTED : ROI_VERTEX_STROKE}
                style={{
                  pointerEvents: isCloseTarget ? "auto" : "none",
                  cursor: isCloseTarget ? "pointer" : "default",
                }}
                onPointerDown={
                  isCloseTarget && onRoiDraftClose
                    ? (e) => {
                        e.stopPropagation();
                        onRoiDraftClose();
                      }
                    : undefined
                }
              />
            );
          })}
        </g>
      ) : null}
    </svg>
  );
}
