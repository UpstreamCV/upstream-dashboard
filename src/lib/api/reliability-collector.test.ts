import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({ serverFetch: vi.fn() }));

import { UpstreamApiError } from "./errors";
import {
  getCollectorStatus,
  getReliabilitySources,
  listReliabilityIssues,
  resolveReliabilityIssue,
} from "./reliability-collector";
import { serverFetch } from "./server";

const mockFetch = vi.mocked(serverFetch);

function notFound(): UpstreamApiError {
  return new UpstreamApiError(404, {
    error: { code: "not_found", message: "missing" },
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("getCollectorStatus", () => {
  test("GETs the account-scoped status endpoint", async () => {
    const status = { recent_observation_count: 5, sources: [], recent_batches: [] };
    mockFetch.mockResolvedValue(status);
    const res = await getCollectorStatus({ accountId: "acc-1" });
    expect(mockFetch).toHaveBeenCalledWith("/v1/reliability/collector-status", {
      accountId: "acc-1",
    });
    expect(res).toBe(status);
  });

  test("returns null on 404 (older api-server)", async () => {
    mockFetch.mockRejectedValue(notFound());
    expect(await getCollectorStatus({ accountId: "acc-1" })).toBeNull();
  });
});

describe("getReliabilitySources", () => {
  test("unwraps the sources array with filters", async () => {
    const sources = [{ id: "s-1" }];
    mockFetch.mockResolvedValue({ sources });
    const res = await getReliabilitySources({
      accountId: "acc-1",
      sourceKind: "external_camera",
      statusHint: "active",
      limit: 50,
    });
    expect(mockFetch).toHaveBeenCalledWith("/v1/reliability/sources", {
      accountId: "acc-1",
      query: { source_kind: "external_camera", status_hint: "active", limit: 50 },
    });
    expect(res).toBe(sources);
  });

  test("returns [] on 404", async () => {
    mockFetch.mockRejectedValue(notFound());
    expect(await getReliabilitySources({ accountId: "acc-1" })).toEqual([]);
  });
});

describe("listReliabilityIssues", () => {
  test("unwraps the issues array with status + limit", async () => {
    const issues = [{ id: "i-1" }];
    mockFetch.mockResolvedValue({ issues });
    const res = await listReliabilityIssues({
      accountId: "acc-1",
      status: "open",
      limit: 100,
    });
    expect(mockFetch).toHaveBeenCalledWith("/v1/reliability/issues", {
      accountId: "acc-1",
      query: { status: "open", limit: 100 },
    });
    expect(res).toBe(issues);
  });

  test("returns [] on 404", async () => {
    mockFetch.mockRejectedValue(notFound());
    expect(await listReliabilityIssues({ accountId: "acc-1" })).toEqual([]);
  });
});

describe("resolveReliabilityIssue", () => {
  test("POSTs the resolve endpoint with the reason body", async () => {
    mockFetch.mockResolvedValue({ id: "i-1", status: "resolved" });
    await resolveReliabilityIssue({
      accountId: "acc-1",
      issueId: "i-1",
      reason: "handled",
    });
    expect(mockFetch).toHaveBeenCalledWith("/v1/reliability/issues/i-1/resolve", {
      accountId: "acc-1",
      method: "POST",
      body: { resolved_reason: "handled" },
    });
  });

  test("omits the body when no reason is given", async () => {
    mockFetch.mockResolvedValue({ id: "i-1", status: "resolved" });
    await resolveReliabilityIssue({ accountId: "acc-1", issueId: "i-1" });
    expect(mockFetch).toHaveBeenCalledWith("/v1/reliability/issues/i-1/resolve", {
      accountId: "acc-1",
      method: "POST",
      body: undefined,
    });
  });
});
