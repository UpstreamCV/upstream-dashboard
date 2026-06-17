import { beforeEach, describe, expect, test, vi } from "vitest";

// processing-packages.ts opens with `import "server-only"`, which throws
// outside a server bundle; stub it. Mock serverFetch to assert path/return.
// Mirrors camera-processing-config.test.ts.
vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({ serverFetch: vi.fn() }));

import { getProcessingPackage, listProcessingPackages } from "./processing-packages";
import { serverFetch } from "./server";

const mockFetch = vi.mocked(serverFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("listProcessingPackages", () => {
  test("GETs the catalog path with the account scope", async () => {
    mockFetch.mockResolvedValue({ packages: [], categories: [], warnings: [] });
    await listProcessingPackages({ accountId: "acc-1" });
    expect(mockFetch).toHaveBeenCalledWith("/v1/processing/packages", {
      accountId: "acc-1",
    });
  });

  test("returns the catalog envelope as-is", async () => {
    const env = { packages: [], categories: [], warnings: ["heads up"] };
    mockFetch.mockResolvedValue(env);
    const res = await listProcessingPackages({ accountId: "acc-1" });
    expect(res).toBe(env);
  });
});

describe("getProcessingPackage", () => {
  test("GETs the per-package path (id is url-encoded)", async () => {
    mockFetch.mockResolvedValue({});
    await getProcessingPackage({
      accountId: "acc-1",
      packageId: "deepstream.yolox_analytics_probe.v0",
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "/v1/processing/packages/deepstream.yolox_analytics_probe.v0",
      { accountId: "acc-1" },
    );
  });

  test("encodes ids with unsafe characters", async () => {
    mockFetch.mockResolvedValue({});
    await getProcessingPackage({ accountId: "acc-1", packageId: "a b/c" });
    expect(mockFetch).toHaveBeenCalledWith(
      "/v1/processing/packages/a%20b%2Fc",
      { accountId: "acc-1" },
    );
  });
});
