import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/account/active", () => ({
  getActiveAccount: vi.fn(async () => ({
    activeAccountId: "acc-1",
    activeAccount: { role: "owner" },
  })),
}));
vi.mock("@/lib/api/reliability-collector", () => ({
  resolveReliabilityIssue: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { UpstreamApiError } from "@/lib/api/errors";
import { resolveReliabilityIssue } from "@/lib/api/reliability-collector";
import { resolveReliabilityIssueAction } from "./actions";

const mockResolve = vi.mocked(resolveReliabilityIssue);
const mockRevalidate = vi.mocked(revalidatePath);

function form(issueId: string, reason?: string): FormData {
  const fd = new FormData();
  fd.set("issue_id", issueId);
  if (reason) fd.set("resolved_reason", reason);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveReliabilityIssueAction", () => {
  test("resolves and revalidates the collector page", async () => {
    mockResolve.mockResolvedValue({ id: "i-1", status: "resolved" } as never);
    const result = await resolveReliabilityIssueAction(form("i-1", "handled"));
    expect(mockResolve).toHaveBeenCalledWith({
      accountId: "acc-1",
      issueId: "i-1",
      reason: "handled",
    });
    expect(mockRevalidate).toHaveBeenCalledWith("/agents/collector");
    expect(result.ok).toBe(true);
  });

  test("rejects a malformed payload without calling the API", async () => {
    const result = await resolveReliabilityIssueAction(form(""));
    expect(result).toEqual({ ok: false, message: "Malformed issue payload." });
    expect(mockResolve).not.toHaveBeenCalled();
  });

  test("returns a friendly message on an API error", async () => {
    mockResolve.mockRejectedValue(
      new UpstreamApiError(403, {
        error: { code: "forbidden.role", message: "Admin required." },
      }),
    );
    const result = await resolveReliabilityIssueAction(form("i-1"));
    expect(result.ok).toBe(false);
    expect(mockRevalidate).not.toHaveBeenCalled();
  });
});
