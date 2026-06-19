import { describe, expect, test } from "vitest";
import type { ProcessingPackage } from "@/lib/api/types";
import {
  getUseCase,
  isCapable,
  recommendPackages,
  scorePackageForUseCase,
  USE_CASES,
} from "./package-recommendation";

const ALL_TRIGGERS = [
  "line_crossing",
  "roi_occupancy",
  "zone_entered",
  "zone_exited",
  "dwell_exceeded",
];

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
    ...over,
  };
}

// A catalog mirroring the real one closely enough to test ranking.
const IOU = pkg({
  package_id: "deepstream.yolox_analytics_probe.v0",
  display_name: "People Analytics — YOLOX",
  status: "probe",
  supported_triggers: ALL_TRIGGERS,
  supported_shapes: ["polygon_roi", "line_segment"],
  best_for: ["person_entry_exit", "zone_presence", "dwell_monitoring"],
  not_recommended_for: ["dense_crowds", "non_person_classes", "production_sla"],
  warnings: ["not yet live-verified under IOU"],
  requires_geometry: true,
});
const TRAFFICCAMNET = pkg({
  package_id: "deepstream.analytics_probe.v0",
  display_name: "People Analytics — TrafficCamNet",
  status: "probe",
  supported_triggers: ALL_TRIGGERS,
  supported_shapes: ["polygon_roi", "line_segment"],
  best_for: ["traffic_scenes", "probe_baselines"],
  not_recommended_for: ["person_analytics_in_non_traffic_scenes", "production_sla"],
  warnings: ["can misclassify people as cars"],
  requires_geometry: true,
});
const NVDCF = pkg({
  package_id: "deepstream.yolox_analytics_nvdcf_probe.v0",
  display_name: "People Analytics — YOLOX + NvDCF (experimental)",
  status: "experimental",
  supported_triggers: ALL_TRIGGERS,
  supported_shapes: ["polygon_roi", "line_segment"],
  best_for: ["occlusion_robustness", "track_continuity"],
  not_recommended_for: ["production_sla"],
  warnings: ["Experimental. Prefer the IOU package today."],
  requires_geometry: true,
});
// P5-K specialized variants: narrowed triggers + use-case best_for so they
// out-rank the generic IOU package for their own use case.
const OCC = pkg({
  package_id: "deepstream.yolox_people_occupancy_probe.v0",
  display_name: "People Occupancy",
  status: "probe",
  supported_triggers: ["roi_occupancy"],
  supported_shapes: ["polygon_roi"],
  best_for: ["occupancy", "capacity", "presence"],
  not_recommended_for: ["dense_crowds", "production_sla"],
  requires_geometry: true,
});
const DWELL = pkg({
  package_id: "deepstream.yolox_people_dwell_probe.v0",
  display_name: "People Dwell / Loitering",
  status: "probe",
  supported_triggers: ["dwell_exceeded"],
  supported_shapes: ["polygon_roi"],
  best_for: ["dwell", "dwell_monitoring", "loitering"],
  not_recommended_for: ["dense_crowds", "production_sla"],
  requires_geometry: true,
});
// P5-K BYOM package (AGPL / first_party=false) — still ranks like any
// experimental package (never recommended).
const YOLO11S = pkg({
  package_id: "deepstream.yolo11s_people_probe.v0",
  display_name: "People Analytics — YOLO11-S",
  status: "experimental",
  license_class: "restrictive",
  first_party: false,
  supported_triggers: ALL_TRIGGERS,
  supported_shapes: ["polygon_roi", "line_segment"],
  best_for: ["person_entry_exit", "zone_presence", "dwell_monitoring"],
  warnings: ["BYOM / requires your own Ultralytics license."],
  requires_geometry: true,
});
const DECODE = pkg({
  package_id: "deepstream.decode_probe.v0",
  display_name: "DeepStream Decode Probe",
  category: "diagnostic",
  status: "probe",
  supported_triggers: [],
  supported_shapes: [],
});
const DEPRECATED = pkg({
  package_id: "old.pkg",
  status: "deprecated",
  supported_triggers: ALL_TRIGGERS,
  supported_shapes: ["polygon_roi", "line_segment"],
});

const CATALOG = [IOU, TRAFFICCAMNET, NVDCF, OCC, DWELL, YOLO11S, DECODE, DEPRECATED];

// P5-K: the expanded catalog makes the specialized variant win its use case.
const EXPECTED_WINNER: Record<string, string> = {
  zone_presence: IOU.package_id,
  line_crossing: IOU.package_id,
  occupancy: OCC.package_id,
  dwell: DWELL.package_id,
  general: IOU.package_id,
};

const uc = (id: Parameters<typeof getUseCase>[0]) => getUseCase(id)!;
const tierOf = (recs: ReturnType<typeof recommendPackages>, id: string) =>
  recs.find((r) => r.pkg.package_id === id)?.tier;
const scoreOf = (recs: ReturnType<typeof recommendPackages>, id: string) =>
  recs.find((r) => r.pkg.package_id === id)?.score ?? Number.NaN;

describe("USE_CASES", () => {
  test("covers the documented set", () => {
    expect(USE_CASES.map((u) => u.id)).toEqual([
      "line_crossing",
      "zone_presence",
      "occupancy",
      "dwell",
      "general",
      "debug",
    ]);
  });
});

describe("isCapable", () => {
  test("a deprecated package is never capable", () => {
    expect(isCapable(DEPRECATED, uc("zone_presence"))).toBe(false);
  });
  test("a trigger match makes a package capable", () => {
    expect(isCapable(IOU, uc("line_crossing"))).toBe(true);
  });
  test("a no-trigger diagnostic is incapable for a specific use case", () => {
    expect(isCapable(DECODE, uc("line_crossing"))).toBe(false);
  });
  test("debug accepts diagnostic + experimental packages", () => {
    expect(isCapable(DECODE, uc("debug"))).toBe(true);
    expect(isCapable(NVDCF, uc("debug"))).toBe(true);
    expect(isCapable(IOU, uc("debug"))).toBe(false);
  });
});

describe("recommendPackages — people use cases", () => {
  for (const id of ["zone_presence", "line_crossing", "occupancy", "dwell", "general"] as const) {
    test(`${id}: ${EXPECTED_WINNER[id]} recommended, experimental never recommended`, () => {
      const recs = recommendPackages(CATALOG, uc(id));
      // The specialized variant wins occupancy/dwell; the generic IOU wins the
      // rest. Exactly one recommendation regardless.
      expect(tierOf(recs, EXPECTED_WINNER[id])).toBe("recommended");
      expect(recs.filter((r) => r.tier === "recommended")).toHaveLength(1);
      expect(tierOf(recs, NVDCF.package_id)).toBe("experimental");
      // Experimental BYOM packages are never recommended (opt-in alternatives).
      expect(tierOf(recs, YOLO11S.package_id)).toBe("experimental");
      expect(tierOf(recs, DECODE.package_id)).toBe("not_recommended");
      expect(tierOf(recs, DEPRECATED.package_id)).toBe("not_recommended");
    });
    test(`${id}: IOU outranks TrafficCamNet on score`, () => {
      const recs = recommendPackages(CATALOG, uc(id));
      expect(scoreOf(recs, IOU.package_id)).toBeGreaterThan(
        scoreOf(recs, TRAFFICCAMNET.package_id),
      );
    });
  }

  test("NvDCF / BYOM are never tiered 'recommended' across any use case", () => {
    for (const u of USE_CASES) {
      const recs = recommendPackages(CATALOG, u);
      expect(tierOf(recs, NVDCF.package_id)).not.toBe("recommended");
      expect(tierOf(recs, YOLO11S.package_id)).not.toBe("recommended");
    }
  });

  test("exactly one package is tiered 'recommended'", () => {
    const recs = recommendPackages(CATALOG, uc("zone_presence"));
    expect(recs.filter((r) => r.tier === "recommended")).toHaveLength(1);
  });

  test("results are sorted recommended → compatible → experimental → not_recommended", () => {
    const recs = recommendPackages(CATALOG, uc("zone_presence"));
    const order = ["recommended", "compatible", "experimental", "not_recommended"];
    const idxs = recs.map((r) => order.indexOf(r.tier));
    expect(idxs).toEqual([...idxs].sort((a, b) => a - b));
  });
});

describe("recommendPackages — debug use case", () => {
  test("a probe diagnostic is recommended; analytics packages are not_recommended", () => {
    const recs = recommendPackages(CATALOG, uc("debug"));
    expect(tierOf(recs, DECODE.package_id)).toBe("recommended");
    expect(tierOf(recs, IOU.package_id)).toBe("not_recommended");
    expect(tierOf(recs, NVDCF.package_id)).toBe("experimental");
  });
});

describe("scorePackageForUseCase", () => {
  test("a trigger + shape match scores higher than an unrelated package", () => {
    const matching = scorePackageForUseCase(IOU, uc("line_crossing"));
    const unrelated = scorePackageForUseCase(DECODE, uc("line_crossing"));
    expect(matching).toBeGreaterThan(unrelated);
  });
  test("a deprecated package is heavily penalized", () => {
    expect(scorePackageForUseCase(DEPRECATED, uc("zone_presence"))).toBeLessThan(0);
  });
});
