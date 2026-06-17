// @vitest-environment jsdom
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

// Hoisted mocks: the Server Actions (so nothing server-only loads), the router,
// and sonner toasts.
const { saveAction, applyAction, refresh, toastSuccess, toastError } =
  vi.hoisted(() => ({
    saveAction: vi.fn(),
    applyAction: vi.fn(),
    refresh: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  }));

vi.mock(
  "@/app/(dash)/(app)/(fleet)/cameras/[cameraId]/processing/actions",
  () => ({
    saveCameraPackageAction: saveAction,
    applyCameraPackageAction: applyAction,
  }),
);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

import { ProcessingPackagePanel } from "./processing-package-panel";
import type {
  CameraPackageConfigResponse,
  ProcessingPackage,
  ProcessingPackageCatalogResponse,
  RequestedPackageConfig,
} from "@/lib/api/types";

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
    supported_shapes: ["polygon_roi"],
    supported_triggers: ["zone_exited"],
    default_settings: { confidence_threshold: 0.4, target_fps: 30 },
    allowed_overrides: ["confidence_threshold", "selected_classes", "processing_fps"],
    compute_tier: "medium",
    pricing_tier: "free_probe",
    observation_volume_risk: "medium",
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

const CATALOG: ProcessingPackageCatalogResponse = {
  packages: [
    pkg(),
    pkg({
      package_id: "nvdcf",
      display_name: "People Analytics — YOLOX + NvDCF (experimental)",
      status: "experimental",
      warnings: ["Experimental. Prefer the IOU package today."],
    }),
    pkg({
      package_id: "decode",
      display_name: "DeepStream Decode Probe",
      description: "Diagnostic only.",
      category: "diagnostic",
      status: "probe",
      model_id: null,
      tracker_profile_id: null,
      analytics_profile_id: null,
      supported_classes: [],
      supported_outputs: [],
      supported_shapes: [],
      supported_triggers: [],
      allowed_overrides: [],
      requires_geometry: false,
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

const requested = (over: Partial<RequestedPackageConfig> = {}): RequestedPackageConfig => ({
  package_id: "iou",
  settings: {},
  revision: 1,
  updated_at: null,
  updated_by: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  saveAction.mockResolvedValue({ ok: true, message: "saved", response: config() });
  applyAction.mockResolvedValue({ ok: true, message: "applied next session", response: config() });
});

afterEach(cleanup);

function renderPanel(cfg: CameraPackageConfigResponse) {
  return render(
    <ProcessingPackagePanel cameraId="cam-1" catalog={CATALOG} config={cfg} />,
  );
}

describe("ProcessingPackagePanel", () => {
  test("unset: shows the empty-state and lists the catalog", () => {
    renderPanel(config());
    expect(screen.getByText(/No package selected yet/)).toBeDefined();
    expect(screen.getByText("People Analytics — YOLOX")).toBeDefined();
    expect(screen.getByText(/NvDCF/)).toBeDefined();
    expect(screen.getByText("DeepStream Decode Probe")).toBeDefined();
  });

  test("active: renders the Active state badge and applied row", () => {
    renderPanel(
      config({
        requested: requested(),
        applied: {
          package_id: "iou",
          model_id: "yolox_s_v1",
          tracker_profile_id: "deepstream_iou_fast_v1",
          analytics_profile_id: "deepstream_nvdsanalytics_probe_v1",
          status: "processing",
          applied_at: null,
        },
        state: "active",
      }),
    );
    expect(screen.getByText("Active")).toBeDefined();
    expect(screen.getByText("Applied")).toBeDefined();
  });

  test("pending_restart: shows the next-session banner", () => {
    renderPanel(config({ requested: requested(), state: "pending_restart" }));
    expect(
      screen.getByText(/next time this camera session starts/i),
    ).toBeDefined();
  });

  test("failed_config: shows the failure banner", () => {
    renderPanel(config({ requested: requested(), state: "failed_config" }));
    expect(
      screen.getByText(/requested package failed to apply/i),
    ).toBeDefined();
  });

  test("surfaces server warnings (e.g. experimental) in the header", () => {
    renderPanel(
      config({
        requested: requested({ package_id: "nvdcf" }),
        state: "experimental_selected",
        warnings: ["Package is experimental and not recommended for production."],
      }),
    );
    expect(screen.getByText("Experimental active")).toBeDefined();
    // Exact match: the opt-in label on the (pre-expanded) requested card also
    // contains this phrase, so assert the server warning string verbatim.
    expect(
      screen.getByText(
        "Package is experimental and not recommended for production.",
      ),
    ).toBeDefined();
  });

  test("an experimental package marks its card and shows its warning", () => {
    renderPanel(config());
    // The status badge + the catalog warning both render on the card.
    expect(screen.getByText("Experimental")).toBeDefined();
    expect(
      screen.getByText(/Prefer the IOU package today/i),
    ).toBeDefined();
  });

  test("a package with no allowed overrides shows 'no adjustable settings'", () => {
    renderPanel(config());
    fireEvent.click(screen.getByText("DeepStream Decode Probe"));
    expect(screen.getByText(/no adjustable settings/i)).toBeDefined();
  });

  test("selecting a package renders only its allowed-override controls", () => {
    renderPanel(config());
    fireEvent.click(screen.getByText("People Analytics — YOLOX"));
    expect(screen.getByLabelText("Confidence threshold value")).toBeDefined();
    expect(screen.getByLabelText("Target FPS")).toBeDefined();
    expect(screen.getByText("All supported classes")).toBeDefined();
  });

  test("experimental requires explicit opt-in before saving", async () => {
    renderPanel(config());
    fireEvent.click(screen.getByText(/NvDCF/));

    const saveBtn = screen.getByRole("button", { name: /Save request/i });
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);

    const optIn = screen.getByRole("checkbox", {
      name: /I understand this package is experimental/i,
    });
    fireEvent.click(optIn);
    expect((saveBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(saveBtn);
    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1));

    const fd = saveAction.mock.calls[0][0] as FormData;
    const sent = JSON.parse(String(fd.get("request")));
    expect(sent.package_id).toBe("nvdcf");
    expect(sent.allow_experimental).toBe(true);
  });

  test("saving a valid package calls the action and refreshes on success", async () => {
    renderPanel(config());
    fireEvent.click(screen.getByText("People Analytics — YOLOX"));
    const saveBtn = screen.getByRole("button", { name: /Save request/i });
    expect((saveBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(saveBtn);
    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1));
    const sent = JSON.parse(
      String((saveAction.mock.calls[0][0] as FormData).get("request")),
    );
    expect(sent.package_id).toBe("iou");
    expect(sent.allow_experimental).toBe(false);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalled();
  });

  test("a backend save error is surfaced to the user", async () => {
    saveAction.mockResolvedValue({ ok: false, message: "Camera not found." });
    renderPanel(config());
    fireEvent.click(screen.getByText("People Analytics — YOLOX"));
    fireEvent.click(screen.getByRole("button", { name: /Save request/i }));
    expect(await screen.findByText("Camera not found.")).toBeDefined();
    expect(toastError).toHaveBeenCalled();
  });

  test("Apply calls the apply action and refreshes", async () => {
    renderPanel(config({ requested: requested(), state: "pending_restart" }));
    fireEvent.click(screen.getByRole("button", { name: /Apply/i }));
    await waitFor(() => expect(applyAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
