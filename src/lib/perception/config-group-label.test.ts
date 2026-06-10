import { describe, expect, test } from "vitest";

import type { ConfidenceTrendConfigGroup } from "@/lib/api/types";
import {
  FPS_OUTPUT_CADENCE_WARNING,
  SELECTED_CLASSES_ANALYTICS_WARNING,
  configGroupKey,
  hasOutputCadenceCaveat,
  formatConfigGroupLabel,
  formatConfigGroupStatus,
  hasAnalyticsCountsCaveat,
  isNoMetadataGroup,
} from "./config-group-label";

function group(
  over: Partial<ConfidenceTrendConfigGroup> = {},
): ConfidenceTrendConfigGroup {
  return {
    processing_config_source: "operator_saved",
    processing_config_revision: 4,
    processing_config_status: "applied",
    applied_model_key: "trafficcamnet_v1",
    applied_selected_classes_key: "all",
    applied_confidence_threshold: null,
    requested_processing_fps: null,
    applied_processing_fps: null,
    processing_config_warnings: null,
    points: [],
    summary: {
      point_count: 0,
      latest_avg_confidence: null,
      lowest_avg_confidence: null,
      highest_avg_confidence: null,
      total_confidence_samples: 0,
      latest_bucket_start: null,
    },
    ...over,
  };
}

const NO_METADATA = group({
  processing_config_source: null,
  processing_config_revision: null,
  processing_config_status: null,
  applied_model_key: null,
  applied_selected_classes_key: null,
  applied_confidence_threshold: null,
  requested_processing_fps: null,
  applied_processing_fps: null,
  processing_config_warnings: null,
});

describe("formatConfigGroupLabel", () => {
  test('"all" classes + null threshold -> "All classes · default confidence"', () => {
    expect(formatConfigGroupLabel(group())).toBe(
      "All classes · default confidence · default FPS",
    );
  });

  test('person-only with threshold 0.2 -> "person · confidence 0.20"', () => {
    expect(
      formatConfigGroupLabel(
        group({
          applied_selected_classes_key: "person",
          applied_confidence_threshold: 0.2,
        }),
      ),
    ).toBe("person · confidence 0.20 · default FPS");
  });

  test("multi-class key passes through as-is", () => {
    expect(
      formatConfigGroupLabel(
        group({
          applied_selected_classes_key: "car,person",
          applied_confidence_threshold: 0.2,
        }),
      ),
    ).toBe("car,person · confidence 0.20 · default FPS");
  });

  test('malformed metadata -> "unknown config"', () => {
    expect(
      formatConfigGroupLabel(group({ applied_selected_classes_key: "unknown" })),
    ).toBe("unknown config");
  });

  test('all-null dimensions (pre-M8 history) -> "No config metadata"', () => {
    expect(formatConfigGroupLabel(NO_METADATA)).toBe("No config metadata");
  });
});

describe("M9.1 FPS label segment", () => {
  test("applied fps 5 renders as 5 FPS", () => {
    expect(
      formatConfigGroupLabel(
        group({ requested_processing_fps: 5, applied_processing_fps: 5 }),
      ),
    ).toBe("All classes · default confidence · 5 FPS");
  });

  test("fps requested but not applied stays default FPS (honest)", () => {
    expect(
      formatConfigGroupLabel(
        group({ requested_processing_fps: 5, applied_processing_fps: null }),
      ),
    ).toBe("All classes · default confidence · default FPS");
  });

  test("hasOutputCadenceCaveat detects the M7E warning", () => {
    expect(
      hasOutputCadenceCaveat(
        group({ processing_config_warnings: [FPS_OUTPUT_CADENCE_WARNING] }),
      ),
    ).toBe(true);
    expect(hasOutputCadenceCaveat(group())).toBe(false);
  });

  test("fps distinguishes group keys", () => {
    expect(configGroupKey(group({ applied_processing_fps: 5 }))).not.toBe(
      configGroupKey(group()),
    );
  });
});

describe("formatConfigGroupStatus", () => {
  test("applied with revision", () => {
    expect(formatConfigGroupStatus(group())).toBe("applied · r4");
  });

  test("partially_applied humanised", () => {
    expect(
      formatConfigGroupStatus(
        group({ processing_config_status: "partially_applied" }),
      ),
    ).toBe("partially applied · r4");
  });

  test('applied_defaults -> "default config" (no revision when null)', () => {
    expect(
      formatConfigGroupStatus(
        group({
          processing_config_status: "applied_defaults",
          processing_config_revision: null,
        }),
      ),
    ).toBe("default config");
  });

  test('fallback_default_on_error -> "fallback default"', () => {
    expect(
      formatConfigGroupStatus(
        group({ processing_config_status: "fallback_default_on_error" }),
      ),
    ).toBe("fallback default · r4");
  });

  test("no-metadata group says so", () => {
    expect(formatConfigGroupStatus(NO_METADATA)).toBe(
      "recorded before config metadata",
    );
  });
});

describe("caveat + key helpers", () => {
  test("hasAnalyticsCountsCaveat detects the warning code", () => {
    expect(
      hasAnalyticsCountsCaveat(
        group({
          processing_config_warnings: [SELECTED_CLASSES_ANALYTICS_WARNING],
        }),
      ),
    ).toBe(true);
    expect(hasAnalyticsCountsCaveat(group())).toBe(false);
    expect(
      hasAnalyticsCountsCaveat(
        group({ processing_config_warnings: ["other_warning"] }),
      ),
    ).toBe(false);
  });

  test("isNoMetadataGroup only for all-null dimensions", () => {
    expect(isNoMetadataGroup(NO_METADATA)).toBe(true);
    expect(isNoMetadataGroup(group())).toBe(false);
  });

  test("configGroupKey distinguishes groups and is stable", () => {
    const a = group();
    const b = group({ applied_confidence_threshold: 0.2 });
    expect(configGroupKey(a)).toBe(configGroupKey(group()));
    expect(configGroupKey(a)).not.toBe(configGroupKey(b));
    expect(configGroupKey(a)).not.toBe(configGroupKey(NO_METADATA));
  });
});
