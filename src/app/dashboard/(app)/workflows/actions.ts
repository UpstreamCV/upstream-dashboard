"use server";

// Server Actions for Workflow Engine M5 sequence workflows. Same envelope
// pattern as the rules actions: defense-in-depth validation, friendly
// errors, revalidate on success — never throw raw API errors into the UI.

import { revalidatePath } from "next/cache";
import { getActiveAccount } from "@/lib/account/active";
import { UpstreamApiError, friendlyMessage } from "@/lib/api/errors";
import {
  createWorkflow,
  deleteWorkflow,
  updateWorkflow,
} from "@/lib/api/workflows";
import type { RuleSeverity, Workflow } from "@/lib/api/types";
import {
  type SequenceValidationIssue,
  validateSequenceConfig,
} from "@/lib/workflows/sequence-config-schema";

export type WorkflowActionResult =
  | { ok: true; message: string; workflow?: Workflow }
  | { ok: false; message: string; issues?: SequenceValidationIssue[] };

function parseConfig(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseSeverity(raw: string): RuleSeverity {
  return raw === "info" || raw === "critical" ? raw : "warning";
}

export async function createWorkflowAction(
  formData: FormData,
): Promise<WorkflowActionResult> {
  const cameraId = String(formData.get("camera_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const severity = parseSeverity(String(formData.get("severity") ?? "warning"));
  const cooldownSeconds = Number(formData.get("cooldown_seconds") ?? NaN);
  const config = parseConfig(String(formData.get("config") ?? "{}"));

  if (!cameraId || !name || name.length > 120) {
    return { ok: false, message: "Workflow needs a name (max 120 characters)." };
  }
  if (
    !Number.isInteger(cooldownSeconds) ||
    cooldownSeconds < 0 ||
    cooldownSeconds > 86400
  ) {
    return { ok: false, message: "Cooldown must be between 0s and 24h." };
  }
  if (config === null) {
    return { ok: false, message: "Malformed workflow config payload." };
  }
  const issues = validateSequenceConfig(config);
  if (issues.length > 0) {
    return { ok: false, message: issues[0].message, issues };
  }

  const { activeAccountId } = await getActiveAccount();
  try {
    const workflow = await createWorkflow({
      accountId: activeAccountId,
      cameraId,
      name,
      workflowType: "sequence",
      config,
      severity,
      cooldownSeconds,
    });
    revalidatePath("/dashboard/workflows");
    return { ok: true, message: "Workflow created.", workflow };
  } catch (err) {
    if (err instanceof UpstreamApiError) {
      return { ok: false, message: friendlyMessage(err) };
    }
    return { ok: false, message: "Could not create the workflow. Try again." };
  }
}

export async function setWorkflowEnabledAction(
  formData: FormData,
): Promise<WorkflowActionResult> {
  const workflowId = String(formData.get("workflow_id") ?? "").trim();
  const enabled = String(formData.get("enabled") ?? "") === "true";
  if (!workflowId) return { ok: false, message: "Malformed workflow payload." };

  const { activeAccountId } = await getActiveAccount();
  try {
    const workflow = await updateWorkflow({
      accountId: activeAccountId,
      workflowId,
      enabled,
    });
    revalidatePath("/dashboard/workflows");
    return {
      ok: true,
      message: enabled ? "Workflow enabled." : "Workflow disabled.",
      workflow,
    };
  } catch (err) {
    if (err instanceof UpstreamApiError) {
      return { ok: false, message: friendlyMessage(err) };
    }
    return { ok: false, message: "Could not update the workflow. Try again." };
  }
}

export async function deleteWorkflowAction(
  formData: FormData,
): Promise<WorkflowActionResult> {
  const workflowId = String(formData.get("workflow_id") ?? "").trim();
  if (!workflowId) return { ok: false, message: "Malformed workflow payload." };

  const { activeAccountId } = await getActiveAccount();
  try {
    await deleteWorkflow({ accountId: activeAccountId, workflowId });
    revalidatePath("/dashboard/workflows");
    return { ok: true, message: "Workflow deleted." };
  } catch (err) {
    if (err instanceof UpstreamApiError) {
      return { ok: false, message: friendlyMessage(err) };
    }
    return { ok: false, message: "Could not delete the workflow. Try again." };
  }
}
