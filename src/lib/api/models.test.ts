import { beforeEach, describe, expect, test, vi } from "vitest";

// models.ts opens with `import "server-only"`, which throws outside a server
// bundle; stub it. Mock serverFetch so we can assert the path/opts and the
// unwrapped return without a real api-server. Mirrors
// reliability-confidence-trend.test.ts.
vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({ serverFetch: vi.fn() }));

import { listModels } from "./models";
import { serverFetch } from "./server";
import type { ModelRegistryEntry } from "./types";

const mockFetch = vi.mocked(serverFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

function model(over: Partial<ModelRegistryEntry> = {}): ModelRegistryEntry {
  return {
    model_key: "yolo-v8",
    display_name: "YOLO v8",
    description: null,
    task_type: "detection",
    runtime: "deepstream",
    default_confidence_threshold: 0.4,
    supported_classes: ["person", "car"],
    supported_trackers: ["nvdcf"],
    model_version: null,
    detector_version: null,
    resource_profile: null,
    enabled: true,
    notes: null,
    limitations: null,
    ...over,
  };
}

describe("listModels", () => {
  test("GETs /v1/models scoped to the account", async () => {
    mockFetch.mockResolvedValue({ models: [] });
    await listModels({ accountId: "acc-1" });
    expect(mockFetch).toHaveBeenCalledWith("/v1/models", {
      accountId: "acc-1",
    });
  });

  test("returns the unwrapped models array", async () => {
    const models = [model(), model({ model_key: "rtdetr", enabled: false })];
    mockFetch.mockResolvedValue({ models });
    const res = await listModels({ accountId: "acc-1" });
    expect(res).toBe(models);
    expect(res).toHaveLength(2);
  });

  test("returns an empty array when the registry is empty", async () => {
    mockFetch.mockResolvedValue({ models: [] });
    const res = await listModels({ accountId: "acc-1" });
    expect(res).toEqual([]);
  });
});
