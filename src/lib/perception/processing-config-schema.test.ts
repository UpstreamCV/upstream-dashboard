import { describe, expect, test } from "vitest";
import type { CameraProcessingConfig, ModelRegistryEntry } from "@/lib/api/types";
import {
  PROCESSING_CONFIG_SCHEMA_VERSION,
  validateProcessingConfig,
} from "./processing-config-schema";

// Pure validator — no I/O, runs in the default node environment. Backend
// validation is authoritative; this guards authoring/forged-payload cases so
// they render inline instead of round-tripping. M6: tracker /
// confidence_threshold / processing_fps are authored controls — `null` means
// "use the runtime/model default", otherwise each must satisfy the same bounds
// the api-server enforces (tracker ∈ model.supported_trackers; confidence in
// [0,1]; fps an integer in [1,30]).

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

  test("accepts every M6 field set to a real, in-bounds value", () => {
    const m = model({ supported_trackers: ["nvdcf"] });
    expect(
      validateProcessingConfig(
        config({
          tracker: "nvdcf",
          confidence_threshold: 0.5,
          processing_fps: 10,
        }),
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

describe("validateProcessingConfig — tracker (M6)", () => {
  test("accepts a null tracker (the runtime-default sentinel)", () => {
    const m = model();
    expect(validateProcessingConfig(config({ tracker: null }), m)).toEqual([]);
  });

  test("accepts a tracker that's in the model's supported_trackers", () => {
    const m = model({ supported_trackers: ["nvdcf", "iou"] });
    expect(validateProcessingConfig(config({ tracker: "iou" }), m)).toEqual([]);
  });

  test("rejects a tracker the model doesn't support", () => {
    const m = model({ supported_trackers: ["nvdcf"] });
    const issues = validateProcessingConfig(config({ tracker: "missing" }), m);
    expect(issues.map((i) => i.field)).toContain("tracker");
    expect(issues.find((i) => i.field === "tracker")?.message).toContain(
      "missing",
    );
  });

  test("rejects a non-string, non-null tracker", () => {
    const m = model();
    const bad = { ...config(), tracker: 7 } as unknown;
    expect(fieldsWithIssues(bad, m)).toContain("tracker");
  });

  test("does not check tracker membership when the model is undefined", () => {
    // No registry entry → model-scoped membership is unchecked; only type is.
    const issues = validateProcessingConfig(
      // model_key resolves, so the only candidate field issue would be tracker.
      { ...config(), tracker: "anything" } as unknown,
      undefined,
    );
    expect(issues.map((i) => i.field)).not.toContain("tracker");
  });
});

describe("validateProcessingConfig — confidence_threshold (M6)", () => {
  test("accepts a null confidence_threshold (the default sentinel)", () => {
    const m = model();
    expect(
      validateProcessingConfig(config({ confidence_threshold: null }), m),
    ).toEqual([]);
  });

  test("accepts confidence at the [0, 1] bounds and in between", () => {
    const m = model();
    for (const value of [0, 0.55, 1]) {
      expect(
        validateProcessingConfig(config({ confidence_threshold: value }), m),
      ).toEqual([]);
    }
  });

  test("rejects confidence above 1.0", () => {
    const m = model();
    const bad = { ...config(), confidence_threshold: 1.5 } as unknown;
    expect(fieldsWithIssues(bad, m)).toContain("confidence_threshold");
  });

  test("rejects confidence below 0.0", () => {
    const m = model();
    const bad = { ...config(), confidence_threshold: -0.1 } as unknown;
    expect(fieldsWithIssues(bad, m)).toContain("confidence_threshold");
  });

  test("rejects a non-number, non-null confidence_threshold", () => {
    const m = model();
    const bad = { ...config(), confidence_threshold: "0.5" } as unknown;
    expect(fieldsWithIssues(bad, m)).toContain("confidence_threshold");
  });
});

describe("validateProcessingConfig — processing_fps (M6)", () => {
  test("accepts a null processing_fps (the default sentinel)", () => {
    const m = model();
    expect(
      validateProcessingConfig(config({ processing_fps: null }), m),
    ).toEqual([]);
  });

  test("accepts integer FPS at the [1, 30] bounds and in between", () => {
    const m = model();
    for (const value of [1, 5, 30]) {
      expect(
        validateProcessingConfig(config({ processing_fps: value }), m),
      ).toEqual([]);
    }
  });

  test("rejects FPS below 1", () => {
    const m = model();
    const bad = { ...config(), processing_fps: 0 } as unknown;
    expect(fieldsWithIssues(bad, m)).toContain("processing_fps");
  });

  test("rejects FPS above 30", () => {
    const m = model();
    const bad = { ...config(), processing_fps: 31 } as unknown;
    expect(fieldsWithIssues(bad, m)).toContain("processing_fps");
  });

  test("rejects a non-integer FPS", () => {
    const m = model();
    const bad = { ...config(), processing_fps: 2.5 } as unknown;
    expect(fieldsWithIssues(bad, m)).toContain("processing_fps");
  });

  test("rejects a non-number, non-null processing_fps", () => {
    const m = model();
    const bad = { ...config(), processing_fps: "10" } as unknown;
    expect(fieldsWithIssues(bad, m)).toContain("processing_fps");
  });
});

describe("validateProcessingConfig — shape guards", () => {
  test("rejects a non-object config", () => {
    expect(fieldsWithIssues(null, model())).toContain("config");
    expect(fieldsWithIssues([], model())).toContain("config");
  });
});
