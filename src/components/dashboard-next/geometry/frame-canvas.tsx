"use client";

import { useCallback, useMemo } from "react";
import clsx from "clsx";
import {
  type NormalizedPoint,
  clampNormalized,
} from "@/components/dashboard-next/geometry/geometry-editor-model";

// P6-B1 — pure layout primitive for the geometry editor. Renders the
// latest-frame image as a fixed underlay and exposes a normalized
// coordinate system for SVG overlays stacked on top.
//
// This component owns NO editor state. No selected shape, no tool, no
// dirty flag, no API knowledge. It only knows: (a) how to draw an image
// at the right aspect ratio, (b) how to translate a browser pointer event
// into a normalized [0,1] x [0,1] point. Editor brains live in
// GeometryEditorPanel.

interface FrameCanvasProps {
  src: string;
  alt: string;
  frameWidth: number | null;
  frameHeight: number | null;
  onPointerDown?: (p: NormalizedPoint, e: React.PointerEvent) => void;
  onPointerMove?: (p: NormalizedPoint, e: React.PointerEvent) => void;
  children?: React.ReactNode;
  className?: string;
}

// Fallback aspect ratio when the latest-frame metadata is missing both
// dimensions — matches the live-stream player + latest-frame card.
const FALLBACK_ASPECT = "16 / 9";

export function FrameCanvas({
  src,
  alt,
  frameWidth,
  frameHeight,
  onPointerDown,
  onPointerMove,
  children,
  className,
}: FrameCanvasProps) {
  const aspectRatio = useMemo(() => {
    if (frameWidth && frameHeight && frameWidth > 0 && frameHeight > 0) {
      return `${frameWidth} / ${frameHeight}`;
    }
    return FALLBACK_ASPECT;
  }, [frameWidth, frameHeight]);

  const toNormalized = useCallback(
    (e: React.PointerEvent): NormalizedPoint => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = rect.width === 0 ? 0 : (e.clientX - rect.left) / rect.width;
      const y = rect.height === 0 ? 0 : (e.clientY - rect.top) / rect.height;
      return clampNormalized({ x, y });
    },
    [],
  );

  const handleDown = useCallback(
    (e: React.PointerEvent) => {
      if (!onPointerDown) return;
      onPointerDown(toNormalized(e), e);
    },
    [onPointerDown, toNormalized],
  );

  const handleMove = useCallback(
    (e: React.PointerEvent) => {
      if (!onPointerMove) return;
      onPointerMove(toNormalized(e), e);
    },
    [onPointerMove, toNormalized],
  );

  return (
    <div
      className={clsx(
        "relative w-full overflow-hidden bg-black",
        // touch-action: none keeps trackpad/touch dragging from panning the
        // page when the user drags an endpoint inside the canvas.
        "touch-none select-none",
        className,
      )}
      style={{ aspectRatio }}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 h-full w-full object-contain pointer-events-none"
        draggable={false}
      />
      {children}
    </div>
  );
}
