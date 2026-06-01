// Pure schema-validation helpers for the camera processing config (M5/M6).
// No React, no I/O, so they're importable from the client editor, the Server
// Action (defense-in-depth), and node-environment vitest.
//
// Backend validation is AUTHORITATIVE. This validator exists so authoring
// errors render inline instead of round-tripping through the network — and so
// a forged payload still can't reach the api-server through the Server Action.
// When the server's schema changes, update this too.
//
// Contract: ../upstream-api-server/docs/api-contracts.md
//   (GET/PUT /v1/cameras/{camera_id}/processing-config)
//
// Authored fields: `model_key`, `selected_classes`, and (M6) `tracker`,
// `confidence_threshold`, `processing_fps`. Each of the three M6 fields is
// optional — `null` means "use the runtime/model default" — and otherwise must
// satisfy the same bounds the api-server enforces.

import type { CameraProcessingConfig, ModelRegistryEntry } from "@/lib/api/types";

/** One validation finding. `field` is the offending config key. */
export type ProcessingConfigValidationIssue = {
  field: string;
  message: string;
};

/** JSON schema version the dashboard authors today. */
export const PROCESSING_CONFIG_SCHEMA_VERSION = 1 as const;

/**
 * Validate a candidate processing config against the schema rules and, when the
 * chosen model is known, against that model's registry facts. Returns an empty
 * array when the config is valid. `model` is the registry entry whose
 * `model_key` matches `config.model_key`, or `undefined` if no such entry was
 * found (which is itself an error when a model_key is present).
 */
export function validateProcessingConfig(
  config: unknown,
  model: ModelRegistryEntry | undefined,
): ProcessingConfigValidationIssue[] {
  const issues: ProcessingConfigValidationIssue[] = [];

  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    issues.push({ field: "config", message: "Config must be an object." });
    return issues;
  }
  const c = config as Record<string, unknown>;

  if (c.version !== PROCESSING_CONFIG_SCHEMA_VERSION) {
    issues.push({
      field: "version",
      message: `Schema version must be ${PROCESSING_CONFIG_SCHEMA_VERSION}.`,
    });
  }

  // model_key — non-empty string and, when the registry is available, an entry
  // that exists and is enabled.
  const modelKey = c.model_key;
  if (typeof modelKey !== "string" || modelKey.trim().length === 0) {
    issues.push({ field: "model_key", message: "Choose a detection model." });
  } else if (model === undefined) {
    issues.push({
      field: "model_key",
      message: `Model "${modelKey}" is not in the registry.`,
    });
  } else if (!model.enabled) {
    issues.push({
      field: "model_key",
      message: `Model "${model.display_name}" is not currently available.`,
    });
  }

  // selected_classes — must be a string array. `[]` is the "all supported
  // classes" sentinel and always valid. A non-empty list must be a subset of
  // the chosen model's supported_classes (only checkable when the model is
  // known).
  const selectedClasses = c.selected_classes;
  if (
    !Array.isArray(selectedClasses) ||
    !selectedClasses.every((item) => typeof item === "string")
  ) {
    issues.push({
      field: "selected_classes",
      message: "selected_classes must be a list of class names.",
    });
  } else if (selectedClasses.length > 0 && model !== undefined) {
    const supported = new Set(model.supported_classes);
    const unsupported = selectedClasses.filter((item) => !supported.has(item));
    if (unsupported.length > 0) {
      issues.push({
        field: "selected_classes",
        message: `These classes aren't supported by ${model.display_name}: ${unsupported.join(", ")}.`,
      });
    }
  }

  // tracker — null is the "use runtime default" sentinel and always valid. A
  // string must be one of the chosen model's supported_trackers (only checkable
  // when the model is known). Any other type is malformed.
  const tracker = c.tracker;
  if (tracker !== null) {
    if (typeof tracker !== "string") {
      issues.push({
        field: "tracker",
        message: "tracker must be a tracker name or null.",
      });
    } else if (
      model !== undefined &&
      !model.supported_trackers.includes(tracker)
    ) {
      issues.push({
        field: "tracker",
        message: `Tracker "${tracker}" isn't supported by ${model.display_name}.`,
      });
    }
  }

  // confidence_threshold — null is the "use model/runtime default" sentinel and
  // always valid. A number must be finite and in [0.0, 1.0]. Any other type is
  // malformed.
  const confidence = c.confidence_threshold;
  if (confidence !== null) {
    if (typeof confidence !== "number") {
      issues.push({
        field: "confidence_threshold",
        message: "confidence_threshold must be a number or null.",
      });
    } else if (
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

  // processing_fps — null is the "use runtime/source default" sentinel and
  // always valid. A number must be an integer in [1, 30]. Any other type is
  // malformed.
  const fps = c.processing_fps;
  if (fps !== null) {
    if (typeof fps !== "number") {
      issues.push({
        field: "processing_fps",
        message: "processing_fps must be a number or null.",
      });
    } else if (!Number.isInteger(fps) || fps < 1 || fps > 30) {
      issues.push({
        field: "processing_fps",
        message: "Processing FPS must be a whole number between 1 and 30.",
      });
    }
  }

  return issues;
}

// --- re-export for convenience ----------------------------------------------

export type { CameraProcessingConfig };
