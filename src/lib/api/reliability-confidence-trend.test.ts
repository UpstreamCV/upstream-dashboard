import { beforeEach, describe, expect, test, vi } from "vitest";

// reliability.ts opens with `import "server-only"`, which throws outside a
// server bundle; stub it. Mock the fetch + error sinks so we can assert on the
// URL/range and the resilience contract without a real api-server or Sentry.
vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({ serverFetch: vi.fn() }));
vi.mock("@/lib/error", () => ({ reportError: vi.fn() }));

import { reportError } from "@/lib/error";
import { getReliabilityConfidenceTrend } from "./reliability";
import { serverFetch } from "./server";

const mockFetch = vi.mocked(serverFetch);
const mockReport = vi.mocked(reportError);

beforeEach(() => {
  mockFetch.mockReset();
  mockReport.mockReset();
});

describe("getReliabilityConfidenceTrend", () => {
  test("builds the camera-scoped URL with the default 24h range", async () => {
    mockFetch.mockResolvedValue({ points: [], summary: {} });
    await getReliabilityConfidenceTrend({ accountId: "acc-1", cameraId: "cam-1" });
    expect(mockFetch).toHaveBeenCalledWith(
      "/v1/cameras/cam-1/reliability/confidence-trend",
      { accountId: "acc-1", query: { range: "24h" } },
    );
  });

  test("passes an explicit range through", async () => {
    mockFetch.mockResolvedValue({ points: [], summary: {} });
    await getReliabilityConfidenceTrend({
      accountId: "acc-1",
      cameraId: "cam-1",
      range: "7d",
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "/v1/cameras/cam-1/reliability/confidence-trend",
      { accountId: "acc-1", query: { range: "7d" } },
    );
  });

  test("returns the response on success", async () => {
    const payload = { camera_id: "cam-1", range: "24h", points: [], summary: {} };
    mockFetch.mockResolvedValue(payload);
    const res = await getReliabilityConfidenceTrend({
      accountId: "acc-1",
      cameraId: "cam-1",
    });
    expect(res).toBe(payload);
  });

  test("degrades to null + reports on a thrown Error (does NOT re-throw)", async () => {
    mockFetch.mockRejectedValue(new Error("boom 500"));
    const res = await getReliabilityConfidenceTrend({
      accountId: "acc-1",
      cameraId: "cam-1",
    });
    expect(res).toBeNull();
    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(mockReport).toHaveBeenCalledWith(expect.any(Error), {
      area: "reliability-confidence-trend",
    });
  });

  test("degrades to null on a non-Error throw too (catch-all resilience)", async () => {
    mockFetch.mockRejectedValue("string failure");
    const res = await getReliabilityConfidenceTrend({
      accountId: "acc-1",
      cameraId: "cam-1",
    });
    expect(res).toBeNull();
    expect(mockReport).toHaveBeenCalledTimes(1);
  });
});
