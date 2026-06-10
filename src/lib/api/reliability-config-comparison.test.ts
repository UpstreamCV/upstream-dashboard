import { beforeEach, describe, expect, test, vi } from "vitest";

// Mirrors the other reliability client tests: stub server-only, mock the
// fetch + error sink, assert on the URL/query and the resilience contract.
vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({ serverFetch: vi.fn() }));
vi.mock("@/lib/error", () => ({ reportError: vi.fn() }));

import { reportError } from "@/lib/error";
import { getReliabilityConfigComparisonSummary } from "./reliability";
import { serverFetch } from "./server";

const mockFetch = vi.mocked(serverFetch);
const mockReport = vi.mocked(reportError);

beforeEach(() => {
  mockFetch.mockReset();
  mockReport.mockReset();
});

describe("getReliabilityConfigComparisonSummary", () => {
  test("builds the summary URL with the default 24h range and no extra params", async () => {
    mockFetch.mockResolvedValue({ comparison_status: "no_data" });
    await getReliabilityConfigComparisonSummary({
      accountId: "acc-1",
      cameraId: "cam-1",
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "/v1/cameras/cam-1/reliability/config-comparison-summary",
      { accountId: "acc-1", query: { range: "24h" } },
    );
  });

  test("serializes the optional params only when set", async () => {
    mockFetch.mockResolvedValue({ comparison_status: "comparable" });
    await getReliabilityConfigComparisonSummary({
      accountId: "acc-1",
      cameraId: "cam-1",
      range: "7d",
      baselineRevision: 4,
      candidateRevision: 5,
      minSamples: 50,
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "/v1/cameras/cam-1/reliability/config-comparison-summary",
      {
        accountId: "acc-1",
        query: {
          range: "7d",
          baseline_revision: "4",
          candidate_revision: "5",
          min_samples: "50",
        },
      },
    );
  });

  test("degrades to null + reports on any error (does NOT re-throw)", async () => {
    mockFetch.mockRejectedValue(new Error("boom 500"));
    const res = await getReliabilityConfigComparisonSummary({
      accountId: "acc-1",
      cameraId: "cam-1",
    });
    expect(res).toBeNull();
    expect(mockReport).toHaveBeenCalledWith(expect.any(Error), {
      area: "reliability-config-comparison",
    });
  });
});
