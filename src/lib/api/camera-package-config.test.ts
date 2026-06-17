import { beforeEach, describe, expect, test, vi } from "vitest";

// camera-package-config.ts opens with `import "server-only"`; stub it. Mock
// serverFetch to assert the path/method/body for GET, PUT, and the apply POST.
vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({ serverFetch: vi.fn() }));

import {
  applyCameraPackageConfig,
  getCameraPackageConfig,
  putCameraPackageConfig,
} from "./camera-package-config";
import { serverFetch } from "./server";
import type {
  CameraPackageConfigResponse,
  CameraPackageRequest,
} from "./types";

const mockFetch = vi.mocked(serverFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

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

describe("getCameraPackageConfig", () => {
  test("GETs the camera-scoped package path", async () => {
    mockFetch.mockResolvedValue(response());
    await getCameraPackageConfig({ accountId: "acc-1", cameraId: "cam-1" });
    expect(mockFetch).toHaveBeenCalledWith(
      "/v1/cameras/cam-1/processing-config/package",
      { accountId: "acc-1" },
    );
  });
});

describe("putCameraPackageConfig", () => {
  test("PUTs the package path with the request as the body (not wrapped)", async () => {
    const request: CameraPackageRequest = {
      package_id: "deepstream.yolox_analytics_probe.v0",
      settings: { confidence_threshold: 0.5 },
      allow_experimental: false,
    };
    mockFetch.mockResolvedValue(response({ state: "pending_restart" }));
    await putCameraPackageConfig({
      accountId: "acc-1",
      cameraId: "cam-1",
      request,
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "/v1/cameras/cam-1/processing-config/package",
      { accountId: "acc-1", method: "PUT", body: request },
    );
  });

  test("forwards allow_experimental in the body", async () => {
    const request: CameraPackageRequest = {
      package_id: "deepstream.yolox_analytics_nvdcf_probe.v0",
      settings: {},
      allow_experimental: true,
    };
    mockFetch.mockResolvedValue(response());
    await putCameraPackageConfig({
      accountId: "acc-1",
      cameraId: "cam-1",
      request,
    });
    expect(mockFetch.mock.calls[0]?.[1]).toMatchObject({
      method: "PUT",
      body: { allow_experimental: true },
    });
  });
});

describe("applyCameraPackageConfig", () => {
  test("POSTs the apply path (distinct from the package path, no body)", async () => {
    mockFetch.mockResolvedValue(response({ state: "pending_restart" }));
    await applyCameraPackageConfig({ accountId: "acc-1", cameraId: "cam-1" });
    expect(mockFetch).toHaveBeenCalledWith(
      "/v1/cameras/cam-1/processing-config/apply",
      { accountId: "acc-1", method: "POST" },
    );
  });

  test("propagates a thrown serverFetch error (409 surfaces to the caller)", async () => {
    mockFetch.mockRejectedValue(new Error("409 no_requested_config"));
    await expect(
      applyCameraPackageConfig({ accountId: "acc-1", cameraId: "cam-1" }),
    ).rejects.toThrow("409 no_requested_config");
  });
});
