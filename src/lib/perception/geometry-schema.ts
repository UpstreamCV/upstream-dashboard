// Pure schema-validation helpers for the camera geometry config (P6-A).
// No React, no I/O, so they're importable from server code, client editor
// state, and node-environment vitest.
//
// These rules MIRROR the api-server Pydantic models exactly. The server is
// the source of truth: any divergence here either lets a 422 round-trip
// (UX regression) or rejects a save the server would have accepted
// (functional regression). When the server's schema changes, update both.
//
// Pydantic source:
//   ../upstream-api-server/src/upstream_api/schemas/geometry.py
// Contract:
//   ../upstream-api-server/docs/api-contracts.md
//   (GET/PUT /v1/cameras/{camera_id}/geometry-config, ~line 818)
//
// The dashboard's editor (P6-B) calls validateGeometryConfig BEFORE the
// upstream PUT so authoring errors render inline instead of round-tripping
// through the network.

import type {
  GeometryConfig,
  GeometryLine,
  GeometryLineDirection,
  GeometryPoint,
  GeometryRoi,
} from "@/lib/api/types";

/** Numeric + pattern limits, mirroring `_MAX_*` constants in geometry.py. */
export const GEOMETRY_LIMITS = {
  maxShapes: 20,
  minRoiPoints: 3,
  maxRoiPoints: 64,
  lineExactPoints: 2,
  maxLabelLen: 80,
  schemaVersion: 1 as const,
  coordinateSpace: "normalized" as const,
  /** Slug pattern from GeometrySlug — IDs embed in observation idempotency keys. */
  slugPattern: /^[a-z0-9][a-z0-9-]{0,63}$/,
} as const;

/** Allowed line direction values (Literal["any", "in", "out"]). */
export const LINE_DIRECTIONS: readonly GeometryLineDirection[] = [
  "any",
  "in",
  "out",
] as const;

/**
 * One validation finding. `path` uses dot notation (e.g.
 * `"rois[2].points[0].x"`) so the editor can highlight the offending shape.
 * Severity is currently always "error" — the api-server has no warnings —
 * but the field exists so the editor can mark client-side soft warnings
 * (e.g. "ROI very small") without conflating them with hard 422 causes.
 */
export interface GeometryValidationIssue {
  code: string;
  message: string;
  path?: string;
  severity: "error" | "warning";
}

function err(
  code: string,
  message: string,
  path?: string,
): GeometryValidationIssue {
  return { code, message, path, severity: "error" };
}

// --- field validators --------------------------------------------------------

export function validateNormalizedPoint(
  p: unknown,
  path: string,
): GeometryValidationIssue[] {
  const issues: GeometryValidationIssue[] = [];
  if (p === null || typeof p !== "object" || Array.isArray(p)) {
    issues.push(err("point_not_object", "Point must be an object", path));
    return issues;
  }
  const pt = p as Record<string, unknown>;
  const x = pt.x;
  const y = pt.y;
  if (typeof x !== "number" || !Number.isFinite(x)) {
    issues.push(err("point_x_not_number", "Point x must be a number", `${path}.x`));
  } else if (x < 0 || x > 1) {
    issues.push(
      err("point_x_out_of_range", "Point x must be in [0, 1]", `${path}.x`),
    );
  }
  if (typeof y !== "number" || !Number.isFinite(y)) {
    issues.push(err("point_y_not_number", "Point y must be a number", `${path}.y`));
  } else if (y < 0 || y > 1) {
    issues.push(
      err("point_y_out_of_range", "Point y must be in [0, 1]", `${path}.y`),
    );
  }
  return issues;
}

export function validateGeometrySlug(
  id: unknown,
  path: string,
): GeometryValidationIssue[] {
  if (typeof id !== "string" || id.length === 0) {
    return [err("id_missing", "ID is required", path)];
  }
  if (!GEOMETRY_LIMITS.slugPattern.test(id)) {
    return [
      err(
        "id_pattern",
        "ID must match ^[a-z0-9][a-z0-9-]{0,63}$ (lowercase letters, digits, dashes; cannot start with a dash; ≤ 64 chars)",
        path,
      ),
    ];
  }
  return [];
}

export function validateGeometryLabel(
  label: unknown,
  path: string,
): GeometryValidationIssue[] {
  // Server allows None. An empty string is a valid string (mapped to None
  // semantically by readers); we leave it to UI to surface "no label" copy.
  if (label === null || label === undefined) return [];
  if (typeof label !== "string") {
    return [err("label_not_string", "Label must be a string", path)];
  }
  if (label.length > GEOMETRY_LIMITS.maxLabelLen) {
    return [
      err(
        "label_too_long",
        `Label must be ≤ ${GEOMETRY_LIMITS.maxLabelLen} characters`,
        path,
      ),
    ];
  }
  return [];
}

// --- shape validators --------------------------------------------------------

export function validateGeometryRoi(
  roi: unknown,
  path: string,
): GeometryValidationIssue[] {
  const issues: GeometryValidationIssue[] = [];
  if (roi === null || typeof roi !== "object" || Array.isArray(roi)) {
    issues.push(err("roi_not_object", "ROI must be an object", path));
    return issues;
  }
  const r = roi as Record<string, unknown>;
  issues.push(...validateGeometrySlug(r.id, `${path}.id`));
  issues.push(...validateGeometryLabel(r.label, `${path}.label`));

  if (r.type !== "polygon") {
    issues.push(
      err(
        "roi_type_invalid",
        'ROI type must be "polygon"',
        `${path}.type`,
      ),
    );
  }

  if (typeof r.enabled !== "boolean") {
    issues.push(
      err("roi_enabled_missing", "ROI enabled must be a boolean", `${path}.enabled`),
    );
  }

  const points = r.points;
  if (!Array.isArray(points)) {
    issues.push(err("roi_points_not_array", "ROI points must be an array", `${path}.points`));
  } else {
    if (points.length < GEOMETRY_LIMITS.minRoiPoints) {
      issues.push(
        err(
          "roi_points_too_few",
          `ROI must have at least ${GEOMETRY_LIMITS.minRoiPoints} points`,
          `${path}.points`,
        ),
      );
    }
    if (points.length > GEOMETRY_LIMITS.maxRoiPoints) {
      issues.push(
        err(
          "roi_points_too_many",
          `ROI must have at most ${GEOMETRY_LIMITS.maxRoiPoints} points`,
          `${path}.points`,
        ),
      );
    }
    points.forEach((pt, idx) => {
      issues.push(...validateNormalizedPoint(pt, `${path}.points[${idx}]`));
    });
  }

  return issues;
}

export function validateGeometryLine(
  line: unknown,
  path: string,
): GeometryValidationIssue[] {
  const issues: GeometryValidationIssue[] = [];
  if (line === null || typeof line !== "object" || Array.isArray(line)) {
    issues.push(err("line_not_object", "Line must be an object", path));
    return issues;
  }
  const l = line as Record<string, unknown>;
  issues.push(...validateGeometrySlug(l.id, `${path}.id`));
  issues.push(...validateGeometryLabel(l.label, `${path}.label`));

  if (typeof l.enabled !== "boolean") {
    issues.push(
      err("line_enabled_missing", "Line enabled must be a boolean", `${path}.enabled`),
    );
  }

  const direction = l.direction;
  if (
    typeof direction !== "string" ||
    !LINE_DIRECTIONS.includes(direction as GeometryLineDirection)
  ) {
    issues.push(
      err(
        "line_direction_invalid",
        `Line direction must be one of ${LINE_DIRECTIONS.join(", ")}`,
        `${path}.direction`,
      ),
    );
  }

  const points = l.points;
  if (!Array.isArray(points)) {
    issues.push(err("line_points_not_array", "Line points must be an array", `${path}.points`));
  } else {
    if (points.length !== GEOMETRY_LIMITS.lineExactPoints) {
      issues.push(
        err(
          "line_points_wrong_count",
          `Line must have exactly ${GEOMETRY_LIMITS.lineExactPoints} points`,
          `${path}.points`,
        ),
      );
    }
    points.forEach((pt, idx) => {
      issues.push(...validateNormalizedPoint(pt, `${path}.points[${idx}]`));
    });
  }

  return issues;
}

// --- top-level config validator ---------------------------------------------

export function validateGeometryConfig(
  config: unknown,
): GeometryValidationIssue[] {
  const issues: GeometryValidationIssue[] = [];
  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    issues.push(err("config_not_object", "Config must be an object"));
    return issues;
  }
  const c = config as Record<string, unknown>;

  if (c.version !== GEOMETRY_LIMITS.schemaVersion) {
    issues.push(
      err(
        "config_version_invalid",
        `Schema version must be ${GEOMETRY_LIMITS.schemaVersion}`,
        "version",
      ),
    );
  }

  const frame = c.frame;
  if (frame === null || typeof frame !== "object" || Array.isArray(frame)) {
    issues.push(err("frame_not_object", "Frame must be an object", "frame"));
  } else {
    const f = frame as Record<string, unknown>;
    if (f.coordinate_space !== GEOMETRY_LIMITS.coordinateSpace) {
      issues.push(
        err(
          "frame_coordinate_space_invalid",
          `Coordinate space must be "${GEOMETRY_LIMITS.coordinateSpace}"`,
          "frame.coordinate_space",
        ),
      );
    }
    // width/height are optional and bounded server-side; we don't enforce
    // the 7680/4320 caps here because that's a server-only concern (the
    // editor never authors those — it reads the latest-frame dimensions).
  }

  const rois = c.rois;
  if (!Array.isArray(rois)) {
    issues.push(err("rois_not_array", "rois must be an array", "rois"));
  } else {
    if (rois.length > GEOMETRY_LIMITS.maxShapes) {
      issues.push(
        err(
          "rois_too_many",
          `At most ${GEOMETRY_LIMITS.maxShapes} ROIs allowed`,
          "rois",
        ),
      );
    }
    rois.forEach((roi, idx) => {
      issues.push(...validateGeometryRoi(roi, `rois[${idx}]`));
    });
    // Duplicate id check — ROIs and lines are separate namespaces server-side.
    const roiIds = rois
      .map((r) => (r && typeof r === "object" ? (r as Record<string, unknown>).id : undefined))
      .filter((id): id is string => typeof id === "string");
    const seenRoi = new Set<string>();
    for (const id of roiIds) {
      if (seenRoi.has(id)) {
        issues.push(
          err("roi_id_duplicate", `Duplicate ROI id "${id}"`, "rois"),
        );
        break;
      }
      seenRoi.add(id);
    }
  }

  const lines = c.lines;
  if (!Array.isArray(lines)) {
    issues.push(err("lines_not_array", "lines must be an array", "lines"));
  } else {
    if (lines.length > GEOMETRY_LIMITS.maxShapes) {
      issues.push(
        err(
          "lines_too_many",
          `At most ${GEOMETRY_LIMITS.maxShapes} lines allowed`,
          "lines",
        ),
      );
    }
    lines.forEach((line, idx) => {
      issues.push(...validateGeometryLine(line, `lines[${idx}]`));
    });
    const lineIds = lines
      .map((l) => (l && typeof l === "object" ? (l as Record<string, unknown>).id : undefined))
      .filter((id): id is string => typeof id === "string");
    const seenLine = new Set<string>();
    for (const id of lineIds) {
      if (seenLine.has(id)) {
        issues.push(
          err("line_id_duplicate", `Duplicate line id "${id}"`, "lines"),
        );
        break;
      }
      seenLine.add(id);
    }
  }

  return issues;
}

// --- summary helper ---------------------------------------------------------

export interface GeometryValidationSummary {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  firstError?: GeometryValidationIssue;
}

export function createGeometryValidationSummary(
  issues: GeometryValidationIssue[],
): GeometryValidationSummary {
  let errorCount = 0;
  let warningCount = 0;
  let firstError: GeometryValidationIssue | undefined;
  for (const issue of issues) {
    if (issue.severity === "error") {
      errorCount += 1;
      if (!firstError) firstError = issue;
    } else {
      warningCount += 1;
    }
  }
  return {
    ok: errorCount === 0,
    errorCount,
    warningCount,
    firstError,
  };
}

// --- re-exports for convenience ---------------------------------------------

export type {
  GeometryConfig,
  GeometryLine,
  GeometryLineDirection,
  GeometryPoint,
  GeometryRoi,
};
