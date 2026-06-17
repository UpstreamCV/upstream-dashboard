// Pure schema-validation helpers for the camera processing PACKAGE request
// (P5-H). No React, no I/O, so they're importable from the client panel, the
// Server Action (defense-in-depth), and node-environment vitest.
//
// Backend validation is AUTHORITATIVE. This validator exists so authoring
// errors render inline instead of round-tripping through the network — and so
// a forged payload still can't reach the api-server through the Server Action.
// It mirrors the api-server's CameraPackageRequest validators; when the server
// schema changes, update this too.
//
// Contract: ../upstream-api-server/docs/api-contracts.md and
//   ../upstream-api-server/src/upstream_api/schemas/processing_config_camera.py
//   (PUT /v1/cameras/{camera_id}/processing-config/package)
//
// Rules mirrored:
// - package must exist + not be deprecated
// - an experimental package requires explicit allow_experimental
// - selected_classes ⊆ package.supported_classes (and the package must allow
//   the "selected_classes" override; an empty supported_classes rejects any
//   explicit class)
// - a provided setting's override key must be in package.allowed_overrides
//   (target_fps maps to the processor's "processing_fps" seam)
// - confidence_threshold ∈ [0, 1]; target_fps an integer ∈ [1, 30]

import type { CameraPackageRequest, ProcessingPackage } from "@/lib/api/types";

/** One validation finding. `field` is the offending request key. */
export type PackageConfigValidationIssue = {
  field: string;
  message: string;
};

/**
 * Validate a candidate package request against the catalog package it names.
 * Returns an empty array when valid. `pkg` is the catalog entry whose
 * `package_id` matches `request.package_id`, or `undefined` if no such visible
 * package exists (itself an error).
 */
export function validatePackageRequest(
  request: CameraPackageRequest,
  pkg: ProcessingPackage | undefined,
): PackageConfigValidationIssue[] {
  const issues: PackageConfigValidationIssue[] = [];

  if (
    typeof request.package_id !== "string" ||
    request.package_id.trim().length === 0
  ) {
    issues.push({ field: "package_id", message: "Choose a package." });
    return issues;
  }
  if (pkg === undefined) {
    issues.push({
      field: "package_id",
      message: `Package "${request.package_id}" is not in the catalog.`,
    });
    return issues;
  }

  if (pkg.status === "deprecated") {
    issues.push({
      field: "package_id",
      message: `${pkg.display_name} is deprecated and can't be selected.`,
    });
  }
  if (pkg.status === "experimental" && !request.allow_experimental) {
    issues.push({
      field: "allow_experimental",
      message: `${pkg.display_name} is experimental — confirm you understand the risk before selecting it.`,
    });
  }

  const settings = request.settings ?? {};
  const allowed = new Set(pkg.allowed_overrides);

  // selected_classes — `[]`/unset is the "all supported classes" sentinel. A
  // non-empty list requires the override + must be a subset of the package's
  // supported_classes (an empty supported_classes publishes no list, so any
  // explicit class is rejected — mirrors the server's audit fix).
  const classes = settings.selected_classes ?? [];
  if (!Array.isArray(classes) || !classes.every((c) => typeof c === "string")) {
    issues.push({
      field: "selected_classes",
      message: "selected_classes must be a list of class names.",
    });
  } else if (classes.length > 0) {
    if (!allowed.has("selected_classes")) {
      issues.push({
        field: "selected_classes",
        message: `${pkg.display_name} doesn't allow choosing classes.`,
      });
    } else if (pkg.supported_classes.length === 0) {
      issues.push({
        field: "selected_classes",
        message: `${pkg.display_name} doesn't publish a class list — leave classes unset to detect all.`,
      });
    } else {
      const supported = new Set(pkg.supported_classes);
      const unsupported = classes.filter((c) => !supported.has(c));
      if (unsupported.length > 0) {
        issues.push({
          field: "selected_classes",
          message: `These classes aren't supported by ${pkg.display_name}: ${unsupported.join(", ")}.`,
        });
      }
    }
  }

  // confidence_threshold — unset/null keeps the package default. A value
  // requires the override and must be a finite number in [0, 1].
  const confidence = settings.confidence_threshold;
  if (confidence !== undefined && confidence !== null) {
    if (!allowed.has("confidence_threshold")) {
      issues.push({
        field: "confidence_threshold",
        message: `${pkg.display_name} doesn't allow a confidence override.`,
      });
    }
    if (
      typeof confidence !== "number" ||
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 1
    ) {
      issues.push({
        field: "confidence_threshold",
        message: "Confidence threshold must be between 0.0 and 1.0.",
      });
    }
  }

  // target_fps — unset/null keeps the package default. Maps to the processor's
  // "processing_fps" override seam; an integer in [1, 30].
  const fps = settings.target_fps;
  if (fps !== undefined && fps !== null) {
    if (!allowed.has("processing_fps")) {
      issues.push({
        field: "target_fps",
        message: `${pkg.display_name} doesn't allow an FPS override.`,
      });
    }
    if (typeof fps !== "number" || !Number.isInteger(fps) || fps < 1 || fps > 30) {
      issues.push({
        field: "target_fps",
        message: "Target FPS must be a whole number between 1 and 30.",
      });
    }
  }

  return issues;
}
