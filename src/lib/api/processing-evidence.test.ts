import { beforeEach, describe, expect, test, vi } from "vitest";

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }));

// processing-evidence.ts opens with `import "server-only"`; stub it. Mock
// serverFetch + reportError so we can assert the path/query and the
// degrade-to-null posture.
vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({ serverFetch: vi.fn() }));
vi.mock("@/lib/error", () => ({ reportError }));

import {
  buildProcessingEvidencePath,
  getProcessingEvidence,
} from "./processing-evidence";
import { serverFetch } from "./server";

const mockFetch = vi.mocked(serverFetch);

beforeEach(() => {
  mockFetch.mockReset();
  reportError.mockReset();
});

describe("buildProcessingEvidencePath", () => {
  test("encodes the camera + range for the SWR/proxy key", () => {
    expect(buildProcessingEvidencePath("cam-1", "1h")).toBe(
      "/v1/cameras/cam-1/processing/evidence?range=1h",
    );
  });
});

describe("getProcessingEvidence", () => {
  test("GETs the evidence path with the default 24h range", async () => {
    mockFetch.mockResolvedValue({ camera_id: "cam-1" });
    await getProcessingEvidence({ accountId: "acc-1", cameraId: "cam-1" });
    expect(mockFetch).toHaveBeenCalledWith(
      "/v1/cameras/cam-1/processing/evidence",
      { accountId: "acc-1", query: { range: "24h" } },
    );
  });

  test("forwards an explicit range", async () => {
    mockFetch.mockResolvedValue({ camera_id: "cam-1" });
    await getProcessingEvidence({
      accountId: "acc-1",
      cameraId: "cam-1",
      range: "1h",
    });
    expect(mockFetch.mock.calls[0]?.[1]).toMatchObject({
      query: { range: "1h" },
    });
  });

  test("degrades errors to null and reports them (never breaks the tab)", async () => {
    mockFetch.mockRejectedValue(new Error("boom"));
    const res = await getProcessingEvidence({
      accountId: "acc-1",
      cameraId: "cam-1",
    });
    expect(res).toBeNull();
    expect(reportError).toHaveBeenCalledTimes(1);
  });
});
