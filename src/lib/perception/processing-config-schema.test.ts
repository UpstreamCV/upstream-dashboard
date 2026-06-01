import { describe, expect, test } from "vitest";
import type { CameraProcessingConfig, ModelRegistryEntry } from "@/lib/api/types";
import {
  PROCESSING_CONFIG_SCHEMA_VERSION,
  validateProcessingConfig,
} from "./processing-config-schema";

// Pure validator — no I/O, runs in the default node environment. Backend
// validation is authoritative; this guards authoring/forged-payload cases so
// they render inline instead of round-tripping. M5: tracker /
// confidence_threshold / processing_fps must be null (M6 controls).

function model(over: Partial<ModelRegistryEntry> = {}): ModelRegistryEntry {
  return {
    model_key: "yolo-v8",
    display_name: "YOLO v8",
    description: null,
    task_type: "detection",
    runtime: "deepstream",
    default_confidence_threshold: 0.4,
    supported_classes: ["person", "car", "truck"],
    supported_trackers: ["nvdcf"],
    model_version: null,
    detector_version: null,
    resource_profile: null,
    enabled: true,
    notes: null,
    limitations: null,
    ...over,
  };
}

function config(
  over: Partial<CameraProcessingConfig> = {},
): CameraProcessingConfig {
  return {
    version: 1,
    model_key: "yolo-v8",
    selected_classes: [],
    tracker: null,
    confidence_threshold: null,
    processing_fps: null,
    ...over,
  };
}

function fieldsWithIssues(
  cfg: unknown,
  m: ModelRegistryEntry | undefined,
): string[] {
  return validateProcessingConfig(cfg, m).map((i) => i.field);
}

describe("validateProcessingConfig — valid configs", () => {
  test("accepts [] selected_classes (the all-supported sentinel)", () => {
    const m = model();
    expect(validateProcessingConfig(config({ selected_classes: [] }), m)).toEqual(
      [],
    );
  });

  test("accepts a subset of the model's supported_classes", () => {
    const m = model();
    expect(
      validateProcessingConfig(config({ selected_classes: ["person"] }), m),
    ).toEqual([]);
  });

  test("accepts a multi-class subset that is fully supported", () => {
    const m = model();
    expect(
      validateProcessingConfig(
        config({ selected_classes: ["person", "truck"] }),
        m,
      ),
    ).toEqual([]);
  });
});

describe("validateProcessingConfig — version", () => {
  test("schema version constant is 1", () => {
    expect(PROCESSING_CONFIG_SCHEMA_VERSION).toBe(1);
  });

  test("rejects a version other than 1", () => {
    const m = model();
    // Cast through unknown — the validator takes `unknown` so it can guard
    // forged payloads whose version isn't the literal 1.
    const bad = { ...config(), version: 2 } as unknown;
    expect(fieldsWithIssues(bad, m)).toContain("version");
  });
});

describe("validateProcessingConfig — selected_classes", () => {
  test("rejects a class not in the model's supported_classes", () => {
    const m = model();
    const issues = validateProcessingConfig(
      config({ selected_classes: ["person", "unicorn"] }),
      m,
    );
    expect(issues.map((i) => i.field)).toContain("selected_classes");
    expect(issues.find((i) => i.field === "selected_classes")?.message).toContain(
      "unicorn",
    );
  });

  test("rejects a non-array selected_classes", () => {
    const m = model();
    const bad = { ...config(), selected_classes: "person" } as unknown;
    expect(fieldsWithIssues(bad, m)).toContain("selected_classes");
  });
});

describe("validateProcessingConfig — model_key", () => {
  test("rejects a model_key absent from the registry (model undefined)", () => {
    const issues = validateProcessingConfig(
      config({ model_key: "ghost" }),
      undefined,
    );
    expect(issues.map((i) => i.field)).toContain("model_key");
  });

  test("rejects a disabled model", () => {
    const m = model({ enabled: false });
    expect(fieldsWithIssues(config(), m)).toContain("model_key");
  });

  test("rejects an empty model_key", () => {
    const m = model();
    expect(fieldsWithIssues(config({ model_key: "" }), m)).toContain("model_key");
  });
});

describe("validateProcessingConfig — M6 fields must ride as null", () => {
  test("rejects a non-null tracker", () => {
    const m = model();
    const bad = { ...config(), tracker: "nvdcf" } as unknown;
    expect(fieldsWithIssues(bad, m)).toContain("tracker");
  });

  test("rejects a non-null confidence_threshold", () => {
    const m = model();
    const bad = { ...config(), confidence_threshold: 0.5 } as unknown;
    expect(fieldsWithIssues(bad, m)).toContain("confidence_threshold");
  });

  test("rejects a non-null processing_fps", () => {
    const m = model();
    const bad = { ...config(), processing_fps: 10 } as unknown;
    expect(fieldsWithIssues(bad, m)).toContain("processing_fps");
  });
});

describe("validateProcessingConfig — shape guards", () => {
  test("rejects a non-object config", () => {
    expect(fieldsWithIssues(null, model())).toContain("config");
    expect(fieldsWithIssues([], model())).toContain("config");
  });
});
