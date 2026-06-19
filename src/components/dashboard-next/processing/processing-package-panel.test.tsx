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
  GeometryConfigRecord,
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
    pkg({
      package_id: "yolo11s",
      display_name: "People Analytics — YOLO11-S",
      status: "experimental",
      license_class: "restrictive",
      first_party: false,
      warnings: ["BYOM / requires your own Ultralytics license."],
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

function geo(opts: { lines?: boolean; rois?: boolean } = {}): GeometryConfigRecord {
  return {
    id: null,
    camera_id: "cam-1",
    revision: 0,
    config: {
      version: 1,
      frame: { width: 1280, height: 720, coordinate_space: "normalized" },
      lines: opts.lines
        ? [
            {
              id: "l1",
              points: [
                { x: 0.3, y: 0.5 },
                { x: 0.7, y: 0.5 },
              ],
              direction: "any",
              enabled: true,
            },
          ]
        : [],
      rois: opts.rois
        ? [
            {
              id: "r1",
              type: "polygon",
              points: [
                { x: 0.1, y: 0.1 },
                { x: 0.9, y: 0.1 },
                { x: 0.5, y: 0.9 },
              ],
              enabled: true,
            },
          ]
        : [],
    },
    is_default: !(opts.lines || opts.rois),
    created_at: null,
    updated_at: null,
  };
}

const APPLIED_IOU = {
  package_id: "iou",
  model_id: "yolox_s_v1",
  tracker_profile_id: "deepstream_iou_fast_v1",
  analytics_profile_id: "deepstream_nvdsanalytics_probe_v1",
  status: "processing",
  applied_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  saveAction.mockResolvedValue({ ok: true, message: "saved", response: config() });
  applyAction.mockResolvedValue({ ok: true, message: "applied next session", response: config() });
});

afterEach(cleanup);

function renderPanel(
  cfg: CameraPackageConfigResponse,
  geometry: GeometryConfigRecord | null = null,
) {
  return render(
    <ProcessingPackagePanel
      cameraId="cam-1"
      catalog={CATALOG}
      config={cfg}
      geometry={geometry}
    />,
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

  test("P5-K: BYOM badge shown only for a non-first-party (AGPL) package", () => {
    renderPanel(config());
    // Exactly one BYOM badge — the YOLO11-S (first_party=false) card; the
    // first-party IOU/decode cards have none.
    expect(screen.getAllByText("BYOM")).toHaveLength(1);
    expect(screen.getByText("People Analytics — YOLO11-S")).toBeDefined();
  });

  test("P5-K: use-case-picker-first nudge shown before a use case is picked", () => {
    renderPanel(config());
    expect(screen.getByText(/Pick what this camera should do above/i)).toBeDefined();
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
    // Header-banner specific wording (the readiness checklist also mentions the
    // next session, so match the banner's "no live restart" phrase).
    expect(screen.getByText(/there is no live restart/i)).toBeDefined();
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
    // At least one "Experimental" status badge (NvDCF + the BYOM package).
    expect(screen.getAllByText("Experimental").length).toBeGreaterThanOrEqual(1);
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

describe("ProcessingPackagePanel — P5-I guided setup", () => {
  test("renders the guided use-case section", () => {
    renderPanel(config());
    expect(
      screen.getByText("What do you want this camera to do?"),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Zone entry & exit" }),
    ).toBeDefined();
  });

  test("selecting a use case ranks packages with tier badges", () => {
    renderPanel(config());
    fireEvent.click(screen.getByRole("button", { name: "Zone entry & exit" }));
    expect(screen.getByText(/recommended packages/i)).toBeDefined();
    expect(screen.getByText("Recommended")).toBeDefined(); // IOU tier badge
    expect(screen.getByText("Not recommended")).toBeDefined(); // decode probe
  });

  test("a selected package shows a readiness checklist", () => {
    renderPanel(config());
    fireEvent.click(screen.getByText("People Analytics — YOLOX"));
    expect(screen.getByText("readiness")).toBeDefined();
    expect(screen.getByText("Package selected")).toBeDefined();
  });

  test("missing geometry surfaces a warning + the Configure → Geometry link", () => {
    renderPanel(config(), geo()); // empty geometry; IOU requires polygon ROI
    fireEvent.click(screen.getByText("People Analytics — YOLOX"));
    expect(screen.getByText("Needs geometry")).toBeDefined(); // readiness overall
    const link = screen.getByText("Configure → Geometry").closest("a");
    expect(link?.getAttribute("href")).toBe(
      "/cameras/cam-1/configure/geometry",
    );
  });

  test("ready when geometry is satisfied and the package is applied", () => {
    renderPanel(
      config({ requested: requested(), applied: APPLIED_IOU, state: "active" }),
      geo({ rois: true }),
    );
    expect(screen.getByText("Ready")).toBeDefined();
  });

  test("failed config shows in the readiness checklist", () => {
    renderPanel(
      config({ requested: requested(), state: "failed_config" }),
      geo({ rois: true }),
    );
    expect(screen.getByText("Failed config")).toBeDefined();
  });

  test("the setup summary states changes apply next session (no live restart)", () => {
    renderPanel(config());
    fireEvent.click(screen.getByText("People Analytics — YOLOX"));
    expect(
      screen.getByText(/The live processor is not restarted/i),
    ).toBeDefined();
  });

  test("experimental opt-in is still required after selecting an experimental package", () => {
    renderPanel(config());
    fireEvent.click(screen.getByText(/NvDCF/));
    const saveBtn = screen.getByRole("button", { name: /Save request/i });
    expect((saveBtn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /I understand this package is experimental/i,
      }),
    );
    expect((saveBtn as HTMLButtonElement).disabled).toBe(false);
  });
});
