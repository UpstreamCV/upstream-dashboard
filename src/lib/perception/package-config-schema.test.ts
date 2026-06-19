import { describe, expect, test } from "vitest";
import type { CameraPackageRequest, ProcessingPackage } from "@/lib/api/types";
import { validatePackageRequest } from "./package-config-schema";

function pkg(over: Partial<ProcessingPackage> = {}): ProcessingPackage {
  return {
    package_id: "deepstream.yolox_analytics_probe.v0",
    display_name: "People Analytics — YOLOX",
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
    supported_shapes: [],
    supported_triggers: [],
    default_settings: { confidence_threshold: 0.4, target_fps: 30 },
    allowed_overrides: ["confidence_threshold", "selected_classes", "processing_fps"],
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
    ...over,
  };
}

function req(over: Partial<CameraPackageRequest> = {}): CameraPackageRequest {
  return {
    package_id: "deepstream.yolox_analytics_probe.v0",
    settings: {},
    allow_experimental: false,
    ...over,
  };
}

const fields = (issues: { field: string }[]) => issues.map((i) => i.field);

describe("validatePackageRequest", () => {
  test("a valid request produces no issues", () => {
    expect(validatePackageRequest(req(), pkg())).toEqual([]);
  });

  test("an unknown package is rejected", () => {
    const issues = validatePackageRequest(req(), undefined);
    expect(fields(issues)).toEqual(["package_id"]);
  });

  test("an empty package_id is rejected", () => {
    const issues = validatePackageRequest(req({ package_id: "  " }), pkg());
    expect(fields(issues)).toContain("package_id");
  });

  test("a deprecated package is rejected", () => {
    const issues = validatePackageRequest(req(), pkg({ status: "deprecated" }));
    expect(fields(issues)).toContain("package_id");
  });

  test("an experimental package requires explicit opt-in", () => {
    const exp = pkg({ status: "experimental" });
    expect(fields(validatePackageRequest(req(), exp))).toContain(
      "allow_experimental",
    );
    expect(
      validatePackageRequest(req({ allow_experimental: true }), exp),
    ).toEqual([]);
  });

  test("selected_classes must be a subset of supported_classes", () => {
    const issues = validatePackageRequest(
      req({ settings: { selected_classes: ["car"] } }),
      pkg(),
    );
    expect(fields(issues)).toContain("selected_classes");
  });

  test("a valid class subset passes", () => {
    expect(
      validatePackageRequest(
        req({ settings: { selected_classes: ["person"] } }),
        pkg(),
      ),
    ).toEqual([]);
  });

  test("explicit classes are rejected when the package publishes no class list", () => {
    const issues = validatePackageRequest(
      req({ settings: { selected_classes: ["person"] } }),
      pkg({ supported_classes: [] }),
    );
    expect(fields(issues)).toContain("selected_classes");
  });

  test("classes are rejected when the override isn't allowed", () => {
    const issues = validatePackageRequest(
      req({ settings: { selected_classes: ["person"] } }),
      pkg({ allowed_overrides: ["confidence_threshold"] }),
    );
    expect(fields(issues)).toContain("selected_classes");
  });

  test("confidence_threshold out of [0,1] is rejected", () => {
    expect(
      fields(
        validatePackageRequest(
          req({ settings: { confidence_threshold: 1.5 } }),
          pkg(),
        ),
      ),
    ).toContain("confidence_threshold");
    expect(
      validatePackageRequest(
        req({ settings: { confidence_threshold: 0.6 } }),
        pkg(),
      ),
    ).toEqual([]);
  });

  test("confidence override is rejected when not allowed", () => {
    const issues = validatePackageRequest(
      req({ settings: { confidence_threshold: 0.6 } }),
      pkg({ allowed_overrides: ["selected_classes"] }),
    );
    expect(fields(issues)).toContain("confidence_threshold");
  });

  test("target_fps must be an integer in [1,30]", () => {
    expect(
      fields(validatePackageRequest(req({ settings: { target_fps: 99 } }), pkg())),
    ).toContain("target_fps");
    expect(
      fields(
        validatePackageRequest(req({ settings: { target_fps: 12.5 } }), pkg()),
      ),
    ).toContain("target_fps");
    expect(
      validatePackageRequest(req({ settings: { target_fps: 15 } }), pkg()),
    ).toEqual([]);
  });

  test("fps override is rejected when not allowed", () => {
    const issues = validatePackageRequest(
      req({ settings: { target_fps: 10 } }),
      pkg({ allowed_overrides: [] }),
    );
    expect(fields(issues)).toContain("target_fps");
  });
});
