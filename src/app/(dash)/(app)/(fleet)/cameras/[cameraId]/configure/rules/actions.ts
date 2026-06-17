"use server";

// Server Actions for the Rules/Triggers M1 rule editor. Each wraps the
// /v1/rules wrapper with defense-in-depth validation (the client already
// validated; a forged payload still can't reach the api-server malformed)
// and revalidates the rules route on success. Returns a structured envelope
// — never throws raw API errors into the UI. Mirrors the precedent in
// configure/geometry/actions.ts.

import { revalidatePath } from "next/cache";
import { getActiveAccount } from "@/lib/account/active";
import { UpstreamApiError, friendlyMessage } from "@/lib/api/errors";
import { createRule, deleteRule, updateRule } from "@/lib/api/rules";
import type { Rule, RuleSeverity } from "@/lib/api/types";
import {
  MAX_COOLDOWN_SECONDS,
  type RuleConfigValidationIssue,
  isRuleType,
  validateRuleConfig,
} from "@/lib/rules/rule-config-schema";

export type RuleActionResult =
  | { ok: true; message: string; rule?: Rule }
  | { ok: false; message: string; issues?: RuleConfigValidationIssue[] };

function rulesPath(cameraId: string): string {
  return `/cameras/${cameraId}/configure/rules`;
}

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

function parseSeverity(raw: string): RuleSeverity | null {
  return raw === "info" || raw === "warning" || raw === "critical" ? raw : null;
}

export async function createRuleAction(
  formData: FormData,
): Promise<RuleActionResult> {
  const cameraId = String(formData.get("camera_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const ruleType = String(formData.get("rule_type") ?? "").trim();
  const severity = parseSeverity(String(formData.get("severity") ?? "warning"));
  const cooldownSeconds = Number(formData.get("cooldown_seconds") ?? NaN);
  const config = parseConfig(String(formData.get("config") ?? "{}"));

  if (!cameraId || !name || name.length > 120) {
    return { ok: false, message: "Rule needs a name (max 120 characters)." };
  }
  if (!isRuleType(ruleType)) {
    return { ok: false, message: "Unsupported rule type." };
  }
  if (
    !Number.isInteger(cooldownSeconds) ||
    cooldownSeconds < 0 ||
    cooldownSeconds > MAX_COOLDOWN_SECONDS
  ) {
    return { ok: false, message: "Cooldown must be between 0s and 24h." };
  }
  if (config === null) {
    return { ok: false, message: "Malformed rule config payload." };
  }
  const issues = validateRuleConfig(ruleType, config);
  if (issues.length > 0) {
    return { ok: false, message: "Fix the rule configuration.", issues };
  }

  const { activeAccountId } = await getActiveAccount();
  try {
    const rule = await createRule({
      accountId: activeAccountId,
      cameraId,
      name,
      ruleType,
      config,
      severity: severity ?? "warning",
      cooldownSeconds,
    });
    revalidatePath(rulesPath(cameraId));
    return { ok: true, message: "Rule created.", rule };
  } catch (err) {
    if (err instanceof UpstreamApiError) {
      return { ok: false, message: friendlyMessage(err) };
    }
    return { ok: false, message: "Could not create the rule. Try again." };
  }
}

export async function setRuleEnabledAction(
  formData: FormData,
): Promise<RuleActionResult> {
  const cameraId = String(formData.get("camera_id") ?? "").trim();
  const ruleId = String(formData.get("rule_id") ?? "").trim();
  const enabled = String(formData.get("enabled") ?? "") === "true";
  if (!cameraId || !ruleId) {
    return { ok: false, message: "Malformed rule payload." };
  }

  const { activeAccountId } = await getActiveAccount();
  try {
    const rule = await updateRule({
      accountId: activeAccountId,
      ruleId,
      enabled,
    });
    revalidatePath(rulesPath(cameraId));
    return {
      ok: true,
      message: enabled ? "Rule enabled." : "Rule disabled.",
      rule,
    };
  } catch (err) {
    if (err instanceof UpstreamApiError) {
      return { ok: false, message: friendlyMessage(err) };
    }
    return { ok: false, message: "Could not update the rule. Try again." };
  }
}

export async function deleteRuleAction(
  formData: FormData,
): Promise<RuleActionResult> {
  const cameraId = String(formData.get("camera_id") ?? "").trim();
  const ruleId = String(formData.get("rule_id") ?? "").trim();
  if (!cameraId || !ruleId) {
    return { ok: false, message: "Malformed rule payload." };
  }

  const { activeAccountId } = await getActiveAccount();
  try {
    await deleteRule({ accountId: activeAccountId, ruleId });
    revalidatePath(rulesPath(cameraId));
    return { ok: true, message: "Rule deleted." };
  } catch (err) {
    if (err instanceof UpstreamApiError) {
      return { ok: false, message: friendlyMessage(err) };
    }
    return { ok: false, message: "Could not delete the rule. Try again." };
  }
}
