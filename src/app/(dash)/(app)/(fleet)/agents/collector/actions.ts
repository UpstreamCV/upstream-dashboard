"use server";

// Server Action for the collector page's Observation Issues section. Resolve is
// owner/admin (the api-server enforces the role regardless — this just relays).
// Returns a structured envelope so the client toasts failures instead of
// crashing on raw API errors.

import { revalidatePath } from "next/cache";
import { getActiveAccount } from "@/lib/account/active";
import { UpstreamApiError, friendlyMessage } from "@/lib/api/errors";
import {
  resolveReliabilityIssue,
  updateReliabilitySourceLiveness,
} from "@/lib/api/reliability-collector";
import type {
  ReliabilityIssue,
  ReliabilitySource,
  UpdateSourceLivenessInput,
} from "@/lib/api/types";

export type ReliabilityIssueActionResult =
  | { ok: true; issue: ReliabilityIssue }
  | { ok: false; message: string };

export type UpdateSourceLivenessActionResult =
  | { ok: true; source: ReliabilitySource }
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

// Configure a source's liveness settings (M2c). Owner/admin (the api-server
// enforces reliability:write / role regardless). `input` carries only the
// fields the user changed; a `null` interval resets it to the per-kind default.
export async function updateSourceLivenessAction(
  sourceId: string,
  input: UpdateSourceLivenessInput,
): Promise<UpdateSourceLivenessActionResult> {
  if (!sourceId) return { ok: false, message: "Malformed source payload." };

  const { activeAccountId } = await getActiveAccount();
  try {
    const source = await updateReliabilitySourceLiveness({
      accountId: activeAccountId,
      sourceId,
      input,
    });
    revalidatePath("/agents/collector");
    return { ok: true, source };
  } catch (err) {
    if (err instanceof UpstreamApiError) {
      return { ok: false, message: friendlyMessage(err) };
    }
    return { ok: false, message: "Could not update liveness settings. Try again." };
  }
}
