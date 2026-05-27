"use client";

import type { GeometryLine, GeometryRoi } from "@/lib/api/types";
import type {
  NormalizedPoint,
  SelectedGeometry,
} from "@/components/dashboard-next/geometry/geometry-editor-model";
import { OVERLAY_COLORS } from "@/lib/perception/overlay-helpers";

// P6-B1/B2 — pure SVG overlay for the geometry editor. Renders existing
// lines (with endpoint handles), editable ROI polygons (with per-vertex
// handles), and draft previews while drawing either shape.
//
// COORDINATE SYSTEM: no viewBox. Positions are percentages so they map to
// the SVG's actual render box at any aspect ratio; sizes (stroke widths,
// handle radii) are in device pixels so they read consistently regardless
// of canvas size and never stretch into ovals when the frame's aspect
// ratio differs from the canvas slot. An earlier viewBox="0 0 1 1" +
// non-scaling-stroke attempt produced invisible-thin lines plus stretched
// oval handles — see commit-log 2026-05-27 SVG rendering fix.
//
// Selection is a SelectedGeometry union, so a single panel selection
// drives styling for whichever shape is active. ROIs and lines have
// separate id namespaces server-side (Pydantic _reject_duplicate_ids), so
// "roi-1" and "line-1" coexisting is fine.

interface GeometryEditorSvgProps {
  lines: GeometryLine[];
  rois: GeometryRoi[];
  selected: SelectedGeometry;
  lineDraft: { start: NormalizedPoint; current: NormalizedPoint } | null;
  // ROI draft: placed vertices (≥ 1 once drawing starts) plus an optional
  // cursor preview point. The first vertex is rendered as a close-target
  // marker once ≥ 3 vertices exist, so clicking it finalizes the polygon.
  roiDraft:
    | { points: NormalizedPoint[]; current: NormalizedPoint | null }
    | null;
  onLineSelect: (id: string) => void;
  onRoiSelect: (id: string) => void;
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
  /** Click on the draft's first vertex when polygon has ≥ 3 points. */
  onRoiDraftClose?: () => void;
}

// Device-pixel sizes — read directly, no scaling.
const LINE_WIDTH = 3;
const LINE_WIDTH_SELECTED = 4;
const HIT_TARGET_WIDTH = 18;          // transparent, just for easier click-on-line
const ROI_STROKE = 2;
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

// Color palette. Lines = amber (OVERLAY_COLORS.line). ROIs = sage
// (OVERLAY_COLORS.box) so editable ROIs read distinctly from lines.
// Selected = a brighter variant per shape kind.
const LINE_COLOR = OVERLAY_COLORS.line;            // "#e8c06b"
const LINE_COLOR_SELECTED = "#fde68a";             // brighter amber
const ROI_COLOR = OVERLAY_COLORS.box;              // "#5fb869"
const ROI_COLOR_SELECTED = "#a7e3a8";              // brighter sage
const ROI_FILL = "rgba(95, 184, 105, 0.16)";
const ROI_FILL_SELECTED = "rgba(95, 184, 105, 0.28)";
const HANDLE_FILL = "#ffffff";
const HANDLE_INNER_FILL_SELECTED = LINE_COLOR_SELECTED;

function pct(n: number): string {
  return `${n * 100}%`;
}

function roiPointsAttr(points: NormalizedPoint[]): string {
  return points.map((p) => `${pct(p.x)},${pct(p.y)}`).join(" ");
}

export function GeometryEditorSvg({
  lines,
  rois,
  selected,
  lineDraft,
  roiDraft,
  onLineSelect,
  onRoiSelect,
  onLineEndpointPointerDown,
  onRoiVertexPointerDown,
  onRoiDraftClose,
}: GeometryEditorSvgProps) {
  const selectedLineId = selected?.kind === "line" ? selected.id : null;
  const selectedRoiId = selected?.kind === "roi" ? selected.id : null;
  const draftCanClose = (roiDraft?.points.length ?? 0) >= 3;

  return (
    <svg
      className="absolute inset-0 h-full w-full"
      // Background pointer events go to FrameCanvas (draft start /
      // deselect). Individual hit targets opt back in via inline
      // pointerEvents below.
      style={{ pointerEvents: "none" }}
      aria-label="Geometry overlay"
    >
      {/* Soft drop shadow for selected handles — gives them depth without
          a layout shift. */}
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

      {/* Editable ROI polygons. Click the polygon to select; click a
          vertex handle to start dragging that specific vertex. */}
      {rois.map((roi) => {
        const isSel = roi.id === selectedRoiId;
        const stroke = isSel ? ROI_COLOR_SELECTED : ROI_COLOR;
        return (
          <g key={`roi-${roi.id}`}>
            <polygon
              points={roiPointsAttr(roi.points)}
              fill={isSel ? ROI_FILL_SELECTED : ROI_FILL}
              stroke={stroke}
              strokeWidth={isSel ? ROI_STROKE_SELECTED : ROI_STROKE}
              strokeLinejoin="round"
              style={{ pointerEvents: "auto", cursor: "pointer" }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onRoiSelect(roi.id);
              }}
            />
            {/* Per-vertex handles. Only rendered when the ROI is selected
                to keep unselected ROIs visually quieter. */}
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
                    style={{ pointerEvents: "auto", cursor: "grab" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onRoiVertexPointerDown(roi.id, idx, e);
                    }}
                  />
                ))
              : // Render small vertex dots on unselected ROIs so the
                // shape's geometry is visible (otherwise it's just a
                // filled blob). No pointer events on these.
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

      {/* Lines — visible stroke + invisible wide hit-target so clicks near
          the stroke still register. Endpoint handles render alongside. */}
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
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
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
                    style={{ pointerEvents: "auto", cursor: "grab" }}
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

      {/* ROI draft preview. Render the polyline through placed vertices,
          add a preview segment from the last vertex to the cursor, and —
          when 3+ vertices exist — render the first vertex as a clickable
          close-target so the user can finish by closing the polygon. */}
      {roiDraft && roiDraft.points.length > 0 ? (
        <g>
          {/* Solid polyline through committed draft vertices. */}
          {roiDraft.points.length >= 2 ? (
            <polyline
              points={roiPointsAttr(roiDraft.points)}
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

          {/* Dashed close-back preview from cursor to first vertex once
              we have at least 3 placed vertices — visualizes "click here
              to close." */}
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

          {/* Vertex markers for each placed draft point. */}
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
