"use server";

// Server Action for the collector page's Observation Issues section. Resolve is
// owner/admin (the api-server enforces the role regardless — this just relays).
// Returns a structured envelope so the client toasts failures instead of
// crashing on raw API errors.

import { revalidatePath } from "next/cache";
import { getActiveAccount } from "@/lib/account/active";
import { UpstreamApiError, friendlyMessage } from "@/lib/api/errors";
import { resolveReliabilityIssue } from "@/lib/api/reliability-collector";
import type { ReliabilityIssue } from "@/lib/api/types";

export type ReliabilityIssueActionResult =
  | { ok: true; issue: ReliabilityIssue }
  | { ok: false; message: string };

export async function resolveReliabilityIssueAction(
  formData: FormData,
): Promise<ReliabilityIssueActionResult> {
  const issueId = String(formData.get("issue_id") ?? "").trim();
  if (!issueId) return { ok: false, message: "Malformed issue payload." };
  const reason = String(formData.get("resolved_reason") ?? "").trim() || undefined;

  const { activeAccountId } = await getActiveAccount();
  try {
    const issue = await resolveReliabilityIssue({
      accountId: activeAccountId,
      issueId,
      reason,
    });
    revalidatePath("/agents/collector");
    return { ok: true, issue };
  } catch (err) {
    if (err instanceof UpstreamApiError) {
      return { ok: false, message: friendlyMessage(err) };
    }
    return { ok: false, message: "Could not resolve the issue. Try again." };
  }
}
