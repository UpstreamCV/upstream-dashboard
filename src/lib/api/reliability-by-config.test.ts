import { beforeEach, describe, expect, test, vi } from "vitest";

// Mirrors reliability-confidence-trend.test.ts: stub server-only, mock the
// fetch + error sink, assert on the URL/query and the resilience contract.
vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({ serverFetch: vi.fn() }));
vi.mock("@/lib/error", () => ({ reportError: vi.fn() }));

import { reportError } from "@/lib/error";
import { getReliabilityConfidenceTrendByConfig } from "./reliability";
import { serverFetch } from "./server";

const mockFetch = vi.mocked(serverFetch);
const mockReport = vi.mocked(reportError);

beforeEach(() => {
  mockFetch.mockReset();
  mockReport.mockReset();
});

describe("getReliabilityConfidenceTrendByConfig", () => {
  test("builds the by-config URL with the default 24h range and NO filter params", async () => {
    mockFetch.mockResolvedValue({ group_count: 0, groups: [] });
    await getReliabilityConfidenceTrendByConfig({
      accountId: "acc-1",
      cameraId: "cam-1",
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "/v1/cameras/cam-1/reliability/confidence-trend/by-config",
      { accountId: "acc-1", query: { range: "24h" } },
    );
  });

  test("serializes the supported filter params exactly (and only when set)", async () => {
    mockFetch.mockResolvedValue({ group_count: 0, groups: [] });
    await getReliabilityConfidenceTrendByConfig({
      accountId: "acc-1",
      cameraId: "cam-1",
      range: "7d",
      processingConfigRevision: 4,
      processingConfigStatus: "partially_applied",
      appliedSelectedClassesKey: "person",
      appliedConfidenceThreshold: 0.2,
      warning: "selected_classes_analytics_counts_not_filtered",
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "/v1/cameras/cam-1/reliability/confidence-trend/by-config",
      {
        accountId: "acc-1",
        query: {
          range: "7d",
          processing_config_revision: "4",
          processing_config_status: "partially_applied",
          applied_selected_classes_key: "person",
          applied_confidence_threshold: "0.2",
          warning: "selected_classes_analytics_counts_not_filtered",
        },
      },
    );
  });

  test("returns the parsed response on success", async () => {
    const payload = {
      camera_id: "cam-1",
      range: "24h",
      bucket_size: "1h",
      group_count: 1,
      groups: [
        {
          processing_config_source: "operator_saved",
          processing_config_revision: 4,
          processing_config_status: "partially_applied",
          applied_model_key: "trafficcamnet_v1",
          applied_selected_classes_key: "person",
          applied_confidence_threshold: 0.2,
          processing_config_warnings: [
            "selected_classes_analytics_counts_not_filtered",
          ],
          points: [],
          summary: {},
        },
      ],
    };
    mockFetch.mockResolvedValue(payload);
    const res = await getReliabilityConfidenceTrendByConfig({
      accountId: "acc-1",
      cameraId: "cam-1",
    });
    expect(res).toBe(payload);
    expect(res?.groups[0].applied_selected_classes_key).toBe("person");
  });

  test("degrades to null + reports on any error (does NOT re-throw)", async () => {
    mockFetch.mockRejectedValue(new Error("boom 500"));
    const res = await getReliabilityConfidenceTrendByConfig({
      accountId: "acc-1",
      cameraId: "cam-1",
    });
    expect(res).toBeNull();
    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(mockReport).toHaveBeenCalledWith(expect.any(Error), {
      area: "reliability-confidence-trend-by-config",
    });
  });

  test("degrades to null on a non-Error throw too", async () => {
    mockFetch.mockRejectedValue("string failure");
    const res = await getReliabilityConfidenceTrendByConfig({
      accountId: "acc-1",
      cameraId: "cam-1",
    });
    expect(res).toBeNull();
    expect(mockReport).toHaveBeenCalledTimes(1);
  });
});
