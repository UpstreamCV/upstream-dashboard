// P5-I — package readiness checklist. Pure + unit-tested (no React, no I/O).
//
// Given the selected package, the camera's package-config state, its geometry,
// and the current editor settings, derive a checklist of what's done vs what's
// still needed before the package is useful — plus a single overall readiness
// state for the banner. All inputs are already available on the Processing page
// (no new api-server endpoints).
//
// Geometry note: there is no separate "zone" in the geometry schema — a zone /
// dwell / occupancy package needs a polygon ROI (supported_shapes
// "polygon_roi"); a line-crossing package needs a line ("line_segment"). So
// readiness checks `geometry.config.lines` / `.rois` against the package's
// `supported_shapes`.

import type {
  CameraPackageConfigResponse,
  GeometryConfigRecord,
  ProcessingPackage,
} from "@/lib/api/types";

export type ReadinessStatus = "ok" | "warn" | "todo" | "pending" | "info";

export interface ReadinessItem {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail?: string;
}

export type OverallReadiness =
  | "ready"
  | "needs_geometry"
  | "needs_save"
  | "pending_restart"
  | "experimental"
  | "failed_config";

export const OVERALL_LABEL: Record<OverallReadiness, string> = {
  ready: "Ready",
  needs_geometry: "Needs geometry",
  needs_save: "Needs save",
  pending_restart: "Pending restart",
  experimental: "Experimental",
  failed_config: "Failed config",
};

export interface ReadinessSettings {
  confidence: number | null;
  targetFps: number | null;
  allClasses: boolean;
  selectedClassCount: number;
}

export interface ReadinessInput {
  pkg: ProcessingPackage;
  config: CameraPackageConfigResponse;
  geometry: GeometryConfigRecord | null;
  allowExperimental: boolean;
  /** Whether the package currently being edited is the one already requested. */
  isSelectedSaved: boolean;
  settings: ReadinessSettings;
}

export interface ReadinessResult {
  items: ReadinessItem[];
  overall: OverallReadiness;
  overallLabel: string;
}

/** Which geometry shapes the package needs, derived from `supported_shapes`. */
export function geometryNeeds(pkg: ProcessingPackage): {
  needsLine: boolean;
  needsRoi: boolean;
} {
  return {
    needsLine: pkg.supported_shapes.includes("line_segment"),
    needsRoi: pkg.supported_shapes.includes("polygon_roi"),
  };
}

/**
 * Geometry readiness for a package: `"missing"` only when we can see the
 * geometry AND a required shape is absent; `"unknown"` when geometry data is
 * unavailable (don't block — show a soft hint); `"ok"`/`"not_required"`
 * otherwise.
 */
export function geometryReadiness(
  pkg: ProcessingPackage,
  geometry: GeometryConfigRecord | null,
): { state: "ok" | "missing" | "unknown" | "not_required"; detail: string } {
  if (!pkg.requires_geometry) {
    return { state: "not_required", detail: "No geometry required." };
  }
  const { needsLine, needsRoi } = geometryNeeds(pkg);
  if (geometry === null) {
    return {
      state: "unknown",
      detail:
        "This package needs geometry. Configure lines/zones before expecting events.",
    };
  }
  const lines = geometry.config.lines.length;
  const rois = geometry.config.rois.length;
  const missing: string[] = [];
  if (needsLine && lines === 0) missing.push("a counting line");
  if (needsRoi && rois === 0) missing.push("a zone/ROI");
  if (missing.length > 0) {
    return {
      state: "missing",
      detail: `Missing ${missing.join(" and ")}. Draw geometry before expecting events.`,
    };
  }
  return {
    state: "ok",
    detail: `${lines} line${lines === 1 ? "" : "s"}, ${rois} zone/ROI${rois === 1 ? "" : "s"} configured.`,
  };
}

export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const { pkg, config, geometry, allowExperimental, isSelectedSaved, settings } =
    input;
  const items: ReadinessItem[] = [];

  items.push({ id: "selected", label: "Package selected", status: "ok" });

  const geo = geometryReadiness(pkg, geometry);
  if (geo.state !== "not_required") {
    items.push({
      id: "geometry",
      label: "Required geometry",
      status:
        geo.state === "ok" ? "ok" : geo.state === "missing" ? "warn" : "info",
      detail: geo.detail,
    });
  }

  const allowed = new Set(pkg.allowed_overrides);
  if (allowed.has("selected_classes")) {
    items.push({
      id: "classes",
      label: "Object classes",
      status: "ok",
      detail: settings.allClasses
        ? "All supported classes."
        : `${settings.selectedClassCount} class${settings.selectedClassCount === 1 ? "" : "es"} selected.`,
    });
  }
  if (allowed.has("confidence_threshold")) {
    items.push({
      id: "confidence",
      label: "Confidence threshold",
      status: "ok",
      detail:
        settings.confidence === null
          ? "Using the package default."
          : `Set to ${settings.confidence.toFixed(2)}.`,
    });
  }
  if (allowed.has("processing_fps")) {
    items.push({
      id: "fps",
      label: "Target FPS",
      status: "ok",
      detail:
        settings.targetFps === null
          ? "Using the package default."
          : `Set to ${settings.targetFps} FPS.`,
    });
  }

  if (pkg.status === "experimental") {
    items.push({
      id: "experimental",
      label: "Experimental opt-in",
      status: allowExperimental ? "ok" : "todo",
      detail: allowExperimental
        ? "Confirmed."
        : "Confirm the experimental opt-in to save this package.",
    });
  }

  items.push({
    id: "saved",
    label: "Changes saved",
    status: isSelectedSaved ? "ok" : "todo",
    detail: isSelectedSaved
      ? "This package is the saved request."
      : "Save to request this package for the camera.",
  });

  // Applied / pending — driven by the derived server state.
  const appliedItem: ReadinessItem = {
    id: "applied",
    label: "Applied / pending",
    status: "pending",
    detail: "",
  };
  switch (config.state) {
    case "active":
    case "experimental_selected":
      appliedItem.status = "ok";
      appliedItem.detail = "Applied and active.";
      break;
    case "pending_apply":
      appliedItem.status = "pending";
      appliedItem.detail = "Saved — waiting for the first processor run.";
      break;
    case "pending_restart":
      appliedItem.status = "pending";
      appliedItem.detail =
        "Saved — applies the next time this camera session starts.";
      break;
    case "failed_config":
      appliedItem.status = "warn";
      appliedItem.detail = "The last processor run for this package failed.";
      break;
    default:
      appliedItem.status = "todo";
      appliedItem.detail = "Save and apply to start using this package.";
  }
  items.push(appliedItem);

  items.push({
    id: "processor",
    label: "Processor reported applied package",
    status: config.applied?.package_id ? "ok" : "pending",
    detail: config.applied?.package_id
      ? `Processor is running ${config.applied.package_id}.`
      : "Waiting for the processor to report an applied package.",
  });

  // Overall state (first matching, most-actionable first).
  let overall: OverallReadiness;
  if (config.state === "failed_config") {
    overall = "failed_config";
  } else if (pkg.status === "experimental" && !allowExperimental) {
    overall = "experimental";
  } else if (geo.state === "missing") {
    overall = "needs_geometry";
  } else if (!isSelectedSaved) {
    overall = "needs_save";
  } else if (
    config.state === "pending_apply" ||
    config.state === "pending_restart"
  ) {
    overall = "pending_restart";
  } else if (config.state === "active" || config.state === "experimental_selected") {
    overall = "ready";
  } else {
    overall = "needs_save";
  }

  return { items, overall, overallLabel: OVERALL_LABEL[overall] };
}
