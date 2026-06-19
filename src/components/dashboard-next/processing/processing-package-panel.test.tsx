// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// Hoisted mocks: the Server Actions (so nothing server-only loads), the router,
// and sonner toasts.
const { saveAction, applyAction, refresh, toastSuccess, toastError } = vi.hoisted(() => ({
  saveAction: vi.fn(),
  applyAction: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(dash)/(app)/(fleet)/cameras/[cameraId]/processing/actions", () => ({
  saveCameraPackageAction: saveAction,
  applyCameraPackageAction: applyAction,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

import { ProcessingPackagePanel } from "./processing-package-panel";
import type {
  CameraPackageConfigResponse,
  ModelMetrics,
  ProcessingPackage,
  ProcessingPackageCatalogResponse,
} from "@/lib/api/types";

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

function pkg(over: Partial<ProcessingPackage> = {}): ProcessingPackage {
  return {
    package_id: "iou",
    display_name: "People Analytics — YOLOX",
    description: "Recommended people-analytics probe.",
    category: "people_analytics",
    status: "probe",
    production_ready: false,
    test_mode_safe: true,
    runtime: "deepstream",
    model_id: "yolox_s_v1",
    tracker_profile_id: "deepstream_iou_fast_v1",
    analytics_profile_id: "deepstream_nvdsanalytics_probe_v1",
    supported_classes: ["person"],
    supported_outputs: ["processor.zone_exited"],
    supported_shapes: ["polygon_roi", "line_segment"],
    supported_triggers: ["line_crossing", "roi_occupancy", "zone_entered", "zone_exited", "dwell_exceeded"],
    default_settings: { confidence_threshold: 0.4, target_fps: 30 },
    allowed_overrides: ["confidence_threshold", "selected_classes", "processing_fps"],
    compute_tier: "medium",
    pricing_tier: "free_probe",
    observation_volume_risk: "medium",
    license_class: "permissive",
    first_party: true,
    warnings: [],
    limitations: [],
    best_for: ["person_entry_exit", "zone_presence", "dwell_monitoring"],
    not_recommended_for: [],
    requires_geometry: true,
    requires_restart: true,
    readiness_notes: null,
    related_packages: [],
    model_metrics: metrics(),
    ...over,
  };
}

const CATALOG: ProcessingPackageCatalogResponse = {
  packages: [
    pkg(),
    pkg({
      package_id: "nvdcf",
      display_name: "People Analytics — YOLOX + NvDCF",
      status: "experimental",
      tracker_profile_id: "deepstream_nvdcf_balanced_v1",
      warnings: ["Experimental. Prefer the IOU package today."],
    }),
    pkg({
      package_id: "yolo11s",
      display_name: "People Analytics — YOLO11-S",
      status: "experimental",
      model_id: "yolo11s_v1",
      license_class: "restrictive",
      first_party: false,
      warnings: ["BYOM / requires your own Ultralytics license."],
      model_metrics: metrics({ coco_map50_95: 47.0, params_m: 9.4 }),
    }),
    pkg({
      package_id: "decode",
      display_name: "DeepStream Decode Probe",
      category: "diagnostic",
      model_id: null,
      tracker_profile_id: null,
      analytics_profile_id: null,
      supported_classes: [],
      supported_outputs: [],
      supported_shapes: [],
      supported_triggers: [],
      allowed_overrides: [],
      requires_geometry: false,
      model_metrics: null,
    }),
  ],
  categories: [
    { id: "people_analytics", display_name: "People Analytics" },
    { id: "diagnostic", display_name: "Diagnostic Probes" },
  ],
  warnings: [],
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

beforeEach(() => {
  vi.clearAllMocks();
  saveAction.mockResolvedValue({ ok: true, message: "saved", response: config() });
  applyAction.mockResolvedValue({ ok: true, message: "applied next session", response: config() });
});

afterEach(cleanup);

function renderPanel(cfg: CameraPackageConfigResponse = config()) {
  return render(
    <ProcessingPackagePanel cameraId="cam-1" catalog={CATALOG} config={cfg} geometry={null} />,
  );
}

describe("ProcessingPackagePanel — P5-L browse & compare", () => {
  test("defaults to Advanced mode", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "Advanced" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Guided" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  test("Advanced shows the model picker with the first model selected", () => {
    renderPanel();
    // The picker trigger shows the friendly MODEL label (not the package name).
    expect(screen.getByRole("button", { name: /YOLOX-S/ })).toBeDefined();
  });

  test("opening the model picker reveals models with stats + a BYOM badge", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /YOLOX-S/ }));
    expect(screen.getByRole("listbox")).toBeDefined();
    // The AGPL model is badged BYOM and surfaced as an option.
    expect(screen.getByText("BYOM")).toBeDefined();
    expect(screen.getByRole("option", { name: /YOLO11-S/ })).toBeDefined();
  });

  test("saving in Advanced sends the resolved canonical package_id", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Save request" }));
    await waitFor(() => expect(saveAction).toHaveBeenCalled());
    const form = saveAction.mock.calls[0][0] as FormData;
    const req = JSON.parse(form.get("request") as string);
    expect(req.package_id).toBe("iou"); // yolox_s + IOU → the base package
  });

  test("selecting an experimental (BYOM) model requires opt-in before save", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /YOLOX-S/ }));
    fireEvent.click(screen.getByRole("option", { name: /YOLO11-S/ }));
    const save = () => screen.getByRole("button", { name: "Save request" }) as HTMLButtonElement;
    expect(save().disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /experimental/i }));
    expect(save().disabled).toBe(false);
  });

  test("Guided mode surfaces the use-case picker and a recommendation", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Guided" }));
    expect(screen.getByText(/Pick what this camera should do/i)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "General people analytics" }));
    // The recommended people-analytics package surfaces (card header + summary).
    expect(screen.getAllByText("People Analytics — YOLOX").length).toBeGreaterThan(0);
  });

  test("published-stats honesty note appears in the model details", () => {
    renderPanel();
    // The details disclosure is in the DOM (collapsed); the honesty label renders.
    expect(screen.getByText(/not measured on your cameras/i)).toBeDefined();
  });
});
