import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the server-only edges so the action module imports cleanly in the node
// test env; keep the real errors + validation schema (the logic under test).
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/account/active", () => ({
  getActiveAccount: vi.fn(async () => ({ activeAccountId: "acc-1" })),
}));
vi.mock("@/lib/api/camera-package-config", () => ({
  putCameraPackageConfig: vi.fn(),
  applyCameraPackageConfig: vi.fn(),
}));
vi.mock("@/lib/api/processing-packages", () => ({
  listProcessingPackages: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import {
  applyCameraPackageConfig,
  putCameraPackageConfig,
} from "@/lib/api/camera-package-config";
import { UpstreamApiError } from "@/lib/api/errors";
import { listProcessingPackages } from "@/lib/api/processing-packages";
import type {
  CameraPackageConfigResponse,
  ProcessingPackage,
} from "@/lib/api/types";
import { applyCameraPackageAction, saveCameraPackageAction } from "./actions";

const mockPut = vi.mocked(putCameraPackageConfig);
const mockApply = vi.mocked(applyCameraPackageConfig);
const mockList = vi.mocked(listProcessingPackages);
const mockRevalidate = vi.mocked(revalidatePath);

beforeEach(() => {
  vi.clearAllMocks();
});

function pkg(over: Partial<ProcessingPackage> = {}): ProcessingPackage {
  return {
    package_id: "iou",
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
    model_metrics: null,
    ...over,
  };
}

function response(
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

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

const catalogWith = (...pkgs: ProcessingPackage[]) => ({
  packages: pkgs,
  categories: [],
  warnings: [],
});

describe("saveCameraPackageAction", () => {
  test("rejects a malformed payload without calling the API", async () => {
    const res = await saveCameraPackageAction(form({ request: "{}" }));
    expect(res.ok).toBe(false);
    expect(mockPut).not.toHaveBeenCalled();
  });

  test("rejects non-JSON request bodies", async () => {
    const res = await saveCameraPackageAction(
      form({ camera_id: "cam-1", request: "not json" }),
    );
    expect(res).toMatchObject({ ok: false });
  });

  test("re-validates server-side: experimental without opt-in is blocked", async () => {
    mockList.mockResolvedValue(catalogWith(pkg({ status: "experimental" })));
    const res = await saveCameraPackageAction(
      form({
        camera_id: "cam-1",
        request: JSON.stringify({
          package_id: "iou",
          settings: {},
          allow_experimental: false,
        }),
      }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.issues?.map((i) => i.field)).toContain("allow_experimental");
    }
    expect(mockPut).not.toHaveBeenCalled();
  });

  test("a valid request PUTs and revalidates the Processing route", async () => {
    mockList.mockResolvedValue(catalogWith(pkg()));
    mockPut.mockResolvedValue(response({ state: "pending_restart" }));
    const request = {
      package_id: "iou",
      settings: { confidence_threshold: 0.5 },
      allow_experimental: false,
    };
    const res = await saveCameraPackageAction(
      form({ camera_id: "cam-1", request: JSON.stringify(request) }),
    );
    expect(res.ok).toBe(true);
    expect(mockPut).toHaveBeenCalledWith({
      accountId: "acc-1",
      cameraId: "cam-1",
      request,
    });
    expect(mockRevalidate).toHaveBeenCalledWith("/cameras/cam-1/processing");
  });

  test("maps an UpstreamApiError to a friendly message", async () => {
    mockList.mockResolvedValue(catalogWith(pkg()));
    mockPut.mockRejectedValue(
      new UpstreamApiError(422, {
        error: { code: "validation_error", message: "nope" },
      }),
    );
    const res = await saveCameraPackageAction(
      form({
        camera_id: "cam-1",
        request: JSON.stringify({
          package_id: "iou",
          settings: {},
          allow_experimental: false,
        }),
      }),
    );
    expect(res).toMatchObject({ ok: false });
    if (!res.ok) expect(res.message).toMatch(/validation/i);
  });
});

describe("applyCameraPackageAction", () => {
  test("rejects a malformed payload", async () => {
    const res = await applyCameraPackageAction(form({}));
    expect(res.ok).toBe(false);
    expect(mockApply).not.toHaveBeenCalled();
  });

  test("applies and revalidates, with next-session copy", async () => {
    mockApply.mockResolvedValue(response({ state: "pending_restart" }));
    const res = await applyCameraPackageAction(form({ camera_id: "cam-1" }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.message).toMatch(/next session/i);
    expect(mockRevalidate).toHaveBeenCalledWith("/cameras/cam-1/processing");
  });

  test("translates 409 no_requested_config into actionable guidance", async () => {
    mockApply.mockRejectedValue(
      new UpstreamApiError(409, {
        error: { code: "no_requested_config", message: "none" },
      }),
    );
    const res = await applyCameraPackageAction(form({ camera_id: "cam-1" }));
    expect(res).toMatchObject({
      ok: false,
      message: "Save a package request before applying.",
    });
  });
});
