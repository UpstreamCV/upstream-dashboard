import { beforeEach, describe, expect, test, vi } from "vitest";

// camera-processing-config.ts opens with `import "server-only"`, which throws
// outside a server bundle; stub it. Mock serverFetch so we can assert the
// path/method/body and the unwrapped return. Mirrors
// reliability-confidence-trend.test.ts.
vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({ serverFetch: vi.fn() }));

import {
  getCameraProcessingConfig,
  putCameraProcessingConfig,
} from "./camera-processing-config";
import { serverFetch } from "./server";
import type {
  CameraProcessingConfig,
  CameraProcessingConfigRecord,
} from "./types";

const mockFetch = vi.mocked(serverFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

const config: CameraProcessingConfig = {
  version: 1,
  model_key: "yolo-v8",
  selected_classes: [],
  tracker: null,
  confidence_threshold: null,
  processing_fps: null,
};

function record(
  over: Partial<CameraProcessingConfigRecord> = {},
): CameraProcessingConfigRecord {
  return {
    id: "cfg-1",
    account_id: "acc-1",
    camera_id: "cam-1",
    revision: 1,
    config,
    is_default: false,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...over,
  };
}

describe("getCameraProcessingConfig", () => {
  test("GETs the camera-scoped processing-config path", async () => {
    mockFetch.mockResolvedValue({ processing_config: record() });
    await getCameraProcessingConfig({ accountId: "acc-1", cameraId: "cam-1" });
    expect(mockFetch).toHaveBeenCalledWith(
      "/v1/cameras/cam-1/processing-config",
      { accountId: "acc-1" },
    );
  });

  test("returns the unwrapped processing_config record", async () => {
    const rec = record();
    mockFetch.mockResolvedValue({ processing_config: rec });
    const res = await getCameraProcessingConfig({
      accountId: "acc-1",
      cameraId: "cam-1",
    });
    expect(res).toBe(rec);
  });

  test("surfaces the synthesized default (is_default/revision 0) as-is", async () => {
    const def = record({ id: null, revision: 0, is_default: true });
    mockFetch.mockResolvedValue({ processing_config: def });
    const res = await getCameraProcessingConfig({
      accountId: "acc-1",
      cameraId: "cam-1",
    });
    expect(res.is_default).toBe(true);
    expect(res.revision).toBe(0);
    expect(res.id).toBeNull();
  });
});

describe("putCameraProcessingConfig", () => {
  test("PUTs the camera-scoped path with a {config} body", async () => {
    mockFetch.mockResolvedValue({ processing_config: record() });
    await putCameraProcessingConfig({
      accountId: "acc-1",
      cameraId: "cam-1",
      config,
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "/v1/cameras/cam-1/processing-config",
      { accountId: "acc-1", method: "PUT", body: { config } },
    );
  });

  test("returns the unwrapped processing_config record from the PUT", async () => {
    const rec = record({ revision: 2 });
    mockFetch.mockResolvedValue({ processing_config: rec });
    const res = await putCameraProcessingConfig({
      accountId: "acc-1",
      cameraId: "cam-1",
      config,
    });
    expect(res).toBe(rec);
    expect(res.revision).toBe(2);
  });

  test("propagates a thrown serverFetch error (422 surfaces to the caller)", async () => {
    mockFetch.mockRejectedValue(new Error("422 validation_error"));
    await expect(
      putCameraProcessingConfig({
        accountId: "acc-1",
        cameraId: "cam-1",
        config,
      }),
    ).rejects.toThrow("422 validation_error");
  });
});
