import { describe, expect, test } from "vitest";
import type { ModelMetrics, ProcessingPackage } from "@/lib/api/types";
import {
  BUNDLED_TRACKER,
  formatMetric,
  modelLabel,
  modelsFromCatalog,
  resolveCanonicalPackage,
  trackerLabel,
  trackersForModel,
} from "./advanced-resolution";

const FULL = ["line_crossing", "roi_occupancy", "zone_entered", "zone_exited", "dwell_exceeded"];

function metrics(over: Partial<ModelMetrics> = {}): ModelMetrics {
  return {
    metric_source: "Published reference — test",
    upstream_measured: false,
    metric_dataset: "COCO val2017",
    coco_map50_95: 40.5,
    coco_map50: null,
    params_m: 9.0,
    input_size: 640,
    backbone: null,
    vendor_kpi_label: null,
    vendor_kpi_value: null,
    vendor_kpi_note: null,
    ...over,
  };
}

function pkg(over: Partial<ProcessingPackage>): ProcessingPackage {
  return {
    package_id: "pkg",
    display_name: "Package",
    description: null,
    category: "people_analytics",
    status: "probe",
    production_ready: false,
    test_mode_safe: true,
    runtime: "deepstream",
    model_id: "yolox_s_v1",
    tracker_profile_id: "deepstream_iou_fast_v1",
    analytics_profile_id: "deepstream_nvdsanalytics_probe_v1",
    supported_classes: ["person"],
    supported_outputs: [],
    supported_shapes: ["polygon_roi", "line_segment"],
    supported_triggers: FULL,
    default_settings: {},
    allowed_overrides: [],
    compute_tier: "medium",
    pricing_tier: "free_probe",
    observation_volume_risk: "medium",
    license_class: "permissive",
    first_party: true,
    warnings: [],
    limitations: [],
    best_for: [],
    not_recommended_for: [],
    requires_geometry: true,
    requires_restart: true,
    readiness_notes: null,
    related_packages: [],
    model_metrics: null,
    ...over,
  };
}

// Catalog mirroring the real ordering: base yolox_s package BEFORE its variants.
const BASE = pkg({ package_id: "deepstream.yolox_analytics_probe.v0", model_metrics: metrics() });
const NVDCF = pkg({
  package_id: "deepstream.yolox_analytics_nvdcf_probe.v0",
  status: "experimental",
  tracker_profile_id: "deepstream_nvdcf_balanced_v1",
});
const FAST = pkg({ package_id: "deepstream.yolox_people_fast_probe.v0" }); // same model+tracker, full triggers
const OCC = pkg({
  package_id: "deepstream.yolox_people_occupancy_probe.v0",
  supported_triggers: ["roi_occupancy"], // narrowed variant
});
const NANO = pkg({
  package_id: "deepstream.yolox_nano_people_probe.v0",
  status: "experimental",
  model_id: "yolox_nano_v1",
  model_metrics: metrics({ coco_map50_95: 25.8, params_m: 0.91, input_size: 416 }),
});
const YOLO11S = pkg({
  package_id: "deepstream.yolo11s_people_probe.v0",
  status: "experimental",
  model_id: "yolo11s_v1",
  license_class: "restrictive",
  first_party: false,
  model_metrics: metrics({ coco_map50_95: 47.0, params_m: 9.4 }),
});
const PEOPLENET = pkg({
  package_id: "deepstream.peoplenet_people_probe.v0",
  status: "experimental",
  model_id: "peoplenet_v1",
  model_metrics: metrics({
    coco_map50_95: null,
    params_m: null,
    vendor_kpi_label: "NVIDIA mAP — person",
    vendor_kpi_value: 94.19,
  }),
});
const DECODE = pkg({
  package_id: "deepstream.decode_probe.v0",
  category: "diagnostic",
  model_id: null,
  tracker_profile_id: null,
  analytics_profile_id: null,
  supported_triggers: [], // real probes declare no analytics triggers
});
const MOCK = pkg({
  package_id: "mock.detect.v0",
  category: "mock",
  runtime: "mock",
  model_id: null,
  tracker_profile_id: null,
  analytics_profile_id: null,
  supported_triggers: [],
});
// Self-contained (bundled) package: the whole chain ships inside the runtime
// container — no model/tracker/analytics ids, but real declared triggers.
const BUNDLED = pkg({
  package_id: "overhead_people_counter.v1",
  display_name: "Overhead People Counter",
  category: "people_counting",
  status: "supported",
  production_ready: true,
  runtime: "crowdcount",
  model_id: null,
  tracker_profile_id: null,
  analytics_profile_id: null,
  supported_triggers: ["line_crossing"],
  requires_geometry: false,
  requires_restart: false,
});

const CATALOG = [BASE, NVDCF, FAST, OCC, NANO, YOLO11S, PEOPLENET, BUNDLED, DECODE, MOCK];

describe("modelsFromCatalog", () => {
  test("lists distinct real models + bundled packages, excluding diagnostics + mock", () => {
    const models = modelsFromCatalog(CATALOG).map((m) => m.modelId);
    expect(models).toEqual([
      "yolox_s_v1",
      "yolox_nano_v1",
      "yolo11s_v1",
      "peoplenet_v1",
      "overhead_people_counter.v1",
    ]);
  });
  test("a bundled package is its own entry with a built-in tracker", () => {
    const entry = modelsFromCatalog(CATALOG).find(
      (m) => m.modelId === "overhead_people_counter.v1",
    );
    expect(entry?.label).toBe("Overhead People Counter");
    expect(entry?.trackers.map((t) => t.profileId)).toEqual([BUNDLED_TRACKER]);
    expect(entry?.representative.package_id).toBe("overhead_people_counter.v1");
  });
  test("carries metrics + first-party provenance per model", () => {
    const by = Object.fromEntries(modelsFromCatalog(CATALOG).map((m) => [m.modelId, m]));
    expect(by.yolox_s_v1.metrics?.coco_map50_95).toBe(40.5);
    expect(by.yolox_s_v1.firstParty).toBe(true);
    expect(by.yolo11s_v1.firstParty).toBe(false); // AGPL/BYOM
    expect(by.peoplenet_v1.metrics?.vendor_kpi_value).toBe(94.19);
  });
});

describe("trackersForModel", () => {
  test("a bundled package id yields the synthetic built-in tracker", () => {
    expect(trackersForModel(CATALOG, "overhead_people_counter.v1").map((t) => t.profileId)).toEqual(
      [BUNDLED_TRACKER],
    );
  });
  test("IOU only for most models; IOU + NvDCF for yolox_s", () => {
    expect(trackersForModel(CATALOG, "yolox_nano_v1").map((t) => t.profileId)).toEqual([
      "deepstream_iou_fast_v1",
    ]);
    expect(trackersForModel(CATALOG, "yolox_s_v1").map((t) => t.profileId)).toEqual([
      "deepstream_iou_fast_v1",
      "deepstream_nvdcf_balanced_v1",
    ]);
  });
});

describe("resolveCanonicalPackage", () => {
  test("yolox_s + IOU resolves to the base package, not a variant", () => {
    const r = resolveCanonicalPackage(CATALOG, "yolox_s_v1", "deepstream_iou_fast_v1");
    expect(r?.package_id).toBe("deepstream.yolox_analytics_probe.v0");
  });
  test("yolox_s + NvDCF resolves to the NvDCF package", () => {
    const r = resolveCanonicalPackage(CATALOG, "yolox_s_v1", "deepstream_nvdcf_balanced_v1");
    expect(r?.package_id).toBe("deepstream.yolox_analytics_nvdcf_probe.v0");
  });
  test("a per-model model resolves to its single package", () => {
    expect(
      resolveCanonicalPackage(CATALOG, "yolo11s_v1", "deepstream_iou_fast_v1")?.package_id,
    ).toBe("deepstream.yolo11s_people_probe.v0");
  });
  test("returns null for an unavailable combination", () => {
    expect(resolveCanonicalPackage(CATALOG, "yolox_nano_v1", "deepstream_nvdcf_balanced_v1")).toBeNull();
  });
  test("a bundled selection resolves to the bundled package itself", () => {
    expect(
      resolveCanonicalPackage(CATALOG, "overhead_people_counter.v1", BUNDLED_TRACKER)?.package_id,
    ).toBe("overhead_people_counter.v1");
  });
});

describe("labels + formatting", () => {
  test("friendly labels with fallback", () => {
    expect(modelLabel("yolo11s_v1")).toBe("YOLO11-S");
    expect(trackerLabel("deepstream_iou_fast_v1")).toBe("IOU (fast)");
    expect(trackerLabel(null)).toBe("—");
    expect(modelLabel("unknown_thing_v2")).toBe("Unknown Thing");
  });
  test("formatMetric renders dash for null", () => {
    expect(formatMetric(40.5)).toBe("40.5");
    expect(formatMetric(9.0, "M")).toBe("9M");
    expect(formatMetric(null)).toBe("—");
  });
});
