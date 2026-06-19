import { describe, expect, test } from "vitest";
import type {
  CameraPackageConfigResponse,
  GeometryConfigRecord,
  ProcessingPackage,
} from "@/lib/api/types";
import {
  computeReadiness,
  geometryReadiness,
  type ReadinessInput,
  type ReadinessSettings,
} from "./package-readiness";

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
    model_id: null,
    tracker_profile_id: null,
    analytics_profile_id: null,
    supported_classes: ["person"],
    supported_outputs: [],
    supported_shapes: [],
    supported_triggers: [],
    default_settings: {},
    allowed_overrides: [],
    compute_tier: null,
    pricing_tier: "free_probe",
    observation_volume_risk: null,
    license_class: "permissive",
    first_party: true,
    warnings: [],
    limitations: [],
    best_for: [],
    not_recommended_for: [],
    requires_geometry: false,
    requires_restart: true,
    readiness_notes: null,
    related_packages: [],
    model_metrics: null,
    ...over,
  };
}

function geo(
  over: Partial<GeometryConfigRecord["config"]> = {},
): GeometryConfigRecord {
  return {
    id: null,
    camera_id: "cam-1",
    revision: 0,
    config: {
      version: 1,
      frame: { width: 1280, height: 720, coordinate_space: "normalized" },
      rois: [],
      lines: [],
      ...over,
    },
    is_default: true,
    created_at: null,
    updated_at: null,
  };
}

const LINE = {
  id: "l1",
  label: "Door",
  points: [
    { x: 0.3, y: 0.5 },
    { x: 0.7, y: 0.5 },
  ],
  direction: "any" as const,
  enabled: true,
};
const ROI = {
  id: "r1",
  label: "Bay",
  type: "polygon" as const,
  points: [
    { x: 0.1, y: 0.1 },
    { x: 0.9, y: 0.1 },
    { x: 0.5, y: 0.9 },
  ],
  enabled: true,
};

function config(
  over: Partial<CameraPackageConfigResponse> = {},
): CameraPackageConfigResponse {
  return {
    camera_id: "cam-1",
    requested: null,
    applied: null,
    state: "unset",
    warnings: [],
    ...over,
  };
}

const SETTINGS: ReadinessSettings = {
  confidence: null,
  targetFps: null,
  allClasses: true,
  selectedClassCount: 0,
};

function input(over: Partial<ReadinessInput>): ReadinessInput {
  return {
    pkg: pkg({}),
    config: config(),
    geometry: null,
    allowExperimental: false,
    isSelectedSaved: false,
    settings: SETTINGS,
    ...over,
  };
}

const item = (r: ReturnType<typeof computeReadiness>, id: string) =>
  r.items.find((i) => i.id === id);

describe("geometryReadiness", () => {
  const roiPkg = pkg({ requires_geometry: true, supported_shapes: ["polygon_roi"] });
  const linePkg = pkg({ requires_geometry: true, supported_shapes: ["line_segment"] });

  test("not required when the package needs no geometry", () => {
    expect(geometryReadiness(pkg({ requires_geometry: false }), null).state).toBe(
      "not_required",
    );
  });
  test("unknown when geometry data is unavailable", () => {
    expect(geometryReadiness(roiPkg, null).state).toBe("unknown");
  });
  test("missing when a required ROI is absent", () => {
    expect(geometryReadiness(roiPkg, geo()).state).toBe("missing");
  });
  test("ok when the required ROI exists", () => {
    expect(geometryReadiness(roiPkg, geo({ rois: [ROI] })).state).toBe("ok");
  });
  test("a line package needs a line, not an ROI", () => {
    expect(geometryReadiness(linePkg, geo({ rois: [ROI] })).state).toBe("missing");
    expect(geometryReadiness(linePkg, geo({ lines: [LINE] })).state).toBe("ok");
  });
});

describe("computeReadiness — geometry", () => {
  const roiPkg = pkg({ requires_geometry: true, supported_shapes: ["polygon_roi"] });

  test("null geometry → info item, not a needs_geometry block", () => {
    const r = computeReadiness(input({ pkg: roiPkg, geometry: null }));
    expect(item(r, "geometry")?.status).toBe("info");
    expect(r.overall).not.toBe("needs_geometry");
  });
  test("missing required geometry (saved+pending) → warn item + needs_geometry overall", () => {
    const r = computeReadiness(
      input({
        pkg: roiPkg,
        geometry: geo(),
        isSelectedSaved: true,
        config: config({ state: "pending_restart", requested: { package_id: "pkg", settings: {}, revision: 1, updated_at: null, updated_by: null } }),
      }),
    );
    expect(item(r, "geometry")?.status).toBe("warn");
    expect(r.overall).toBe("needs_geometry");
  });
  test("satisfied geometry + saved + active → ready", () => {
    const r = computeReadiness(
      input({
        pkg: roiPkg,
        geometry: geo({ rois: [ROI] }),
        isSelectedSaved: true,
        config: config({
          state: "active",
          applied: {
            package_id: "pkg",
            model_id: "m",
            tracker_profile_id: "t",
            analytics_profile_id: "a",
            status: "processing",
            applied_at: null,
          },
        }),
      }),
    );
    expect(item(r, "geometry")?.status).toBe("ok");
    expect(r.overall).toBe("ready");
  });
  test("a non-geometry package has no geometry item", () => {
    const r = computeReadiness(input({ pkg: pkg({ requires_geometry: false }) }));
    expect(item(r, "geometry")).toBeUndefined();
  });
});

describe("computeReadiness — lifecycle", () => {
  test("experimental without opt-in → todo item + experimental overall", () => {
    const r = computeReadiness(
      input({ pkg: pkg({ status: "experimental" }), allowExperimental: false }),
    );
    expect(item(r, "experimental")?.status).toBe("todo");
    expect(r.overall).toBe("experimental");
  });
  test("failed_config wins the overall state", () => {
    const r = computeReadiness(
      input({ isSelectedSaved: true, config: config({ state: "failed_config" }) }),
    );
    expect(r.overall).toBe("failed_config");
    expect(item(r, "applied")?.status).toBe("warn");
  });
  test("not saved → needs_save", () => {
    const r = computeReadiness(input({ isSelectedSaved: false }));
    expect(item(r, "saved")?.status).toBe("todo");
    expect(r.overall).toBe("needs_save");
  });
  test("saved + pending_restart → pending_restart", () => {
    const r = computeReadiness(
      input({ isSelectedSaved: true, config: config({ state: "pending_restart" }) }),
    );
    expect(r.overall).toBe("pending_restart");
  });
  test("processor-reported item reflects config.applied", () => {
    const without = computeReadiness(input({}));
    expect(item(without, "processor")?.status).toBe("pending");
    const withApplied = computeReadiness(
      input({
        config: config({
          applied: {
            package_id: "pkg",
            model_id: null,
            tracker_profile_id: null,
            analytics_profile_id: null,
            status: "processing",
            applied_at: null,
          },
        }),
      }),
    );
    expect(item(withApplied, "processor")?.status).toBe("ok");
  });
});

describe("computeReadiness — settings items", () => {
  test("only renders override items the package allows", () => {
    const r = computeReadiness(
      input({
        pkg: pkg({ allowed_overrides: ["confidence_threshold"] }),
      }),
    );
    expect(item(r, "confidence")).toBeDefined();
    expect(item(r, "fps")).toBeUndefined();
    expect(item(r, "classes")).toBeUndefined();
  });
});
