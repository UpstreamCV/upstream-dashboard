import type { ProcessorStatusRecord } from "@/lib/api/types";

/**
 * Display variant for the Applied Geometry chip — pure, no React, no styling.
 * The component reads the tagged union and emits copy/colors per variant.
 *
 * Variants are listed in priority order; see `formatAppliedGeometryStatus`
 * for the resolution rules.
 */
export type AppliedGeometryDisplay =
  | {
      kind: "operator_saved";
      revision: number;
      lineCount: number;
      roiCount: number;
    }
  | { kind: "default"; lineCount: number; roiCount: number }
  | {
      kind: "fallback";
      revision: number | null;
      errorReason: string | null;
    }
  | { kind: "geometry_invalid"; errorMessage: string | null }
  | { kind: "no_status" }
  | { kind: "missing_applied_geometry" }
  | { kind: "unknown_source"; sourceLabel: string };

/**
 * Map a `ProcessorStatusRecord` (or `null` when the processor hasn't
 * reported yet) into the display variant the chip should render.
 *
 * Resolution order (first match wins):
 *   1. `null`                                              → no_status
 *   2. row.error_code === "geometry_invalid"               → geometry_invalid
 *      (P6-C stamps this at the row level alongside `source =
 *      fallback_default_on_error` so callers see the degrade explicitly;
 *      surfacing it first gives the chip the strongest signal).
 *   3. payload.applied_geometry not an object              → missing_applied_geometry
 *   4. source === "operator_saved"                         → operator_saved
 *   5. source === "default"                                → default
 *   6. source === "fallback_default_on_error"              → fallback
 *   7. anything else                                       → unknown_source
 *      (forward-compat for a future api-server source value the dashboard
 *      doesn't recognize yet).
 */
export function formatAppliedGeometryStatus(
  status: ProcessorStatusRecord | null,
): AppliedGeometryDisplay {
  if (status === null) {
    return { kind: "no_status" };
  }

  if (status.error_code === "geometry_invalid") {
    return { kind: "geometry_invalid", errorMessage: status.error_message };
  }

  const applied = status.payload?.applied_geometry;
  if (!applied || typeof applied !== "object") {
    return { kind: "missing_applied_geometry" };
  }

  const lineCount = typeof applied.line_count === "number" ? applied.line_count : 0;
  const roiCount = typeof applied.roi_count === "number" ? applied.roi_count : 0;

  switch (applied.source) {
    case "operator_saved":
      // `revision` should always be a number for operator-saved; coerce a
      // null defensively to 0 so the union stays `number` (the chip will
      // render "r0" which is obviously wrong — and that's the point: a
      // visible signal that the api-server drifted).
      return {
        kind: "operator_saved",
        revision: typeof applied.revision === "number" ? applied.revision : 0,
        lineCount,
        roiCount,
      };
    case "default":
      return { kind: "default", lineCount, roiCount };
    case "fallback_default_on_error":
      return {
        kind: "fallback",
        revision: typeof applied.revision === "number" ? applied.revision : null,
        errorReason: applied.error_reason ?? null,
      };
    default:
      return { kind: "unknown_source", sourceLabel: String(applied.source) };
  }
}
