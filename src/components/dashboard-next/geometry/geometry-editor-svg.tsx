"use client";

import type { GeometryLine, GeometryRoi } from "@/lib/api/types";
import type { NormalizedPoint } from "@/components/dashboard-next/geometry/geometry-editor-model";
import { OVERLAY_COLORS } from "@/lib/perception/overlay-helpers";

// P6-B1 — pure SVG overlay for the geometry editor. Renders existing
// lines (with endpoint handles), read-only ROI polygons (dimmer styling
// since they're not editable in this milestone), and a dashed draft line
// while drawing.
//
// No state of its own. Emits onLineSelect + onEndpointPointerDown so the
// parent panel can drive selection + drag logic. Background pointer
// interactions (start a draft line, deselect) are handled by FrameCanvas
// + GeometryEditorPanel, not here.
//
// vectorEffect="non-scaling-stroke" everywhere so stroke widths stay
// constant on screen regardless of zoom/aspect-ratio scaling.

interface GeometryEditorSvgProps {
  lines: GeometryLine[];
  rois: GeometryRoi[];
  selectedLineId: string | null;
  draft: { start: NormalizedPoint; current: NormalizedPoint } | null;
  onLineSelect: (id: string) => void;
  onEndpointPointerDown: (
    lineId: string,
    endpoint: "a" | "b",
    e: React.PointerEvent,
  ) => void;
  /** Normalized viewBox is fixed at 1x1 so coordinates map directly. */
}

// Drawing the SVG in normalized [0,1] x [0,1] coords removes any need to
// shuffle pixel dimensions through props. The container (FrameCanvas)
// preserves the image's real aspect ratio, so a normalized SVG stretched
// over it draws in the same physical space.
const VIEW_W = 1;
const VIEW_H = 1;
const LINE_STROKE = 0.004;          // ~3px at typical sizes via non-scaling-stroke
const LINE_STROKE_SELECTED = 0.006;
const HANDLE_RADIUS = 0.014;
const DRAFT_DASH = "8 6";

export function GeometryEditorSvg({
  lines,
  rois,
  selectedLineId,
  draft,
  onLineSelect,
  onEndpointPointerDown,
}: GeometryEditorSvgProps) {
  return (
    <svg
      // Absolute over the FrameCanvas image. Stroke widths use
      // non-scaling-stroke so they read consistently regardless of how the
      // container scales the 1x1 viewBox.
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      // The SVG must not eat background pointer events — FrameCanvas
      // handles those for draft/deselect. Only the actual <line>/<circle>
      // hit targets opt back in.
      style={{ pointerEvents: "none" }}
      aria-label="Geometry overlay"
    >
      {/* ROI polygons — read-only in P6-B1. Dim styling signals
          "this is data you can't edit yet." */}
      {rois.map((roi) => (
        <polygon
          key={`roi-${roi.id}`}
          points={roi.points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill={OVERLAY_COLORS.roiFill}
          stroke={OVERLAY_COLORS.roiStroke}
          strokeWidth={LINE_STROKE}
          strokeOpacity={0.5}
          fillOpacity={0.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* Existing lines. Each line is a <line> hit target plus two
          endpoint <circle> handles. Selected line highlights both. */}
      {lines.map((line) => {
        const [a, b] = line.points;
        if (!a || !b) return null;
        const selected = line.id === selectedLineId;
        return (
          <g key={`line-${line.id}`}>
            {/* Wide invisible hit-target line so clicking near the stroke
                still selects without forcing pixel-perfect aim. */}
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="transparent"
              strokeWidth={HANDLE_RADIUS * 1.4}
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onPointerDown={(e) => {
                // Background draft / deselect handlers live on FrameCanvas;
                // stop the event so a select doesn't also start a draft.
                e.stopPropagation();
                onLineSelect(line.id);
              }}
            />
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={selected ? "#e8c06b" : OVERLAY_COLORS.line}
              strokeWidth={selected ? LINE_STROKE_SELECTED : LINE_STROKE}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: "none" }}
            />
            {/* Endpoint handles. Slightly larger when selected so the
                drag target is comfortable. */}
            {(["a", "b"] as const).map((endpoint, idx) => {
              const p = idx === 0 ? a : b;
              return (
                <circle
                  key={endpoint}
                  cx={p.x}
                  cy={p.y}
                  r={selected ? HANDLE_RADIUS * 1.2 : HANDLE_RADIUS}
                  fill="#ffffff"
                  stroke={selected ? "#e8c06b" : OVERLAY_COLORS.line}
                  strokeWidth={LINE_STROKE_SELECTED}
                  vectorEffect="non-scaling-stroke"
                  style={{
                    pointerEvents: "auto",
                    cursor: "grab",
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onEndpointPointerDown(line.id, endpoint, e);
                  }}
                />
              );
            })}
          </g>
        );
      })}

      {/* Draft preview while drawing. Dashed so it reads as "not committed
          yet." Pointer-events: none so it never blocks the next click. */}
      {draft ? (
        <line
          x1={draft.start.x}
          y1={draft.start.y}
          x2={draft.current.x}
          y2={draft.current.y}
          stroke={OVERLAY_COLORS.line}
          strokeWidth={LINE_STROKE}
          strokeDasharray={DRAFT_DASH}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: "none" }}
        />
      ) : null}
    </svg>
  );
}
