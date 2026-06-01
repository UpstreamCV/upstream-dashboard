// Pure schema-validation helpers for the camera processing config (M5).
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
// M5 scope: only `model_key` + `selected_classes` are authored. `tracker`,
// `confidence_threshold`, and `processing_fps` are M6 — they must be `null`
// in an M5 save, so we reject anything else defensively.

import type { CameraProcessingConfig, ModelRegistryEntry } from "@/lib/api/types";

/** One validation finding. `field` is the offending config key. */
export type ProcessingConfigValidationIssue = {
  field: string;
  message: string;
};

/** JSON schema version the dashboard authors today. */
export const PROCESSING_CONFIG_SCHEMA_VERSION = 1 as const;

/**
 * Validate a candidate processing config against the M5 rules and, when the
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

  // M5: tracker / confidence_threshold / processing_fps are M6 controls. They
  // must ride as null until then.
  if (c.tracker !== null) {
    issues.push({
      field: "tracker",
      message: "Tracker selection isn't available yet (M6).",
    });
  }
  if (c.confidence_threshold !== null) {
    issues.push({
      field: "confidence_threshold",
      message: "Confidence threshold isn't available yet (M6).",
    });
  }
  if (c.processing_fps !== null) {
    issues.push({
      field: "processing_fps",
      message: "Processing FPS isn't available yet (M6).",
    });
  }

  return issues;
}

// --- re-export for convenience ----------------------------------------------

export type { CameraProcessingConfig };
