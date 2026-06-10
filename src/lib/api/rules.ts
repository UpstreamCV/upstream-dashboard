import "server-only";

import { serverFetch } from "./server";
import type { Rule, RuleListResponse, RuleSeverity, RuleType } from "./types";

// Rules CRUD wrapper (Rules/Triggers M1).
// Contract: ../upstream-api-server/src/upstream_api/routers/rules.py
//   GET    /v1/rules?camera_id=…   → RuleListResponse
//   POST   /v1/rules               → Rule (201)
//   PATCH  /v1/rules/{rule_id}     → Rule
//   DELETE /v1/rules/{rule_id}     → 204
//
// Mutations are owner/admin (403 `forbidden` otherwise); reads any member.
// `rule_type` is immutable after create — delete and recreate to change it.
// Per-type config problems surface as 422 `invalid_rule_config`; the
// dashboard runs validateRuleConfig from @/lib/rules/rule-config-schema
// first so authoring errors render inline instead of round-tripping.

export async function listRules(opts: {
  accountId: string;
  cameraId?: string;
}): Promise<Rule[]> {
  const res = await serverFetch<RuleListResponse>("/v1/rules", {
    accountId: opts.accountId,
    query: { camera_id: opts.cameraId },
  });
  return res.rules;
}

export async function createRule(opts: {
  accountId: string;
  cameraId: string;
  name: string;
  ruleType: RuleType;
  config: Record<string, unknown>;
  severity: RuleSeverity;
  cooldownSeconds: number;
}): Promise<Rule> {
  return serverFetch<Rule>("/v1/rules", {
    accountId: opts.accountId,
    method: "POST",
    body: {
      account_id: opts.accountId,
      camera_id: opts.cameraId,
      name: opts.name,
      rule_type: opts.ruleType,
      config: opts.config,
      severity: opts.severity,
      cooldown_seconds: opts.cooldownSeconds,
    },
  });
}

export async function updateRule(opts: {
  accountId: string;
  ruleId: string;
  name?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
  severity?: RuleSeverity;
  cooldownSeconds?: number;
}): Promise<Rule> {
  return serverFetch<Rule>(`/v1/rules/${opts.ruleId}`, {
    accountId: opts.accountId,
    method: "PATCH",
    body: {
      ...(opts.name !== undefined ? { name: opts.name } : {}),
      ...(opts.enabled !== undefined ? { enabled: opts.enabled } : {}),
      ...(opts.config !== undefined ? { config: opts.config } : {}),
      ...(opts.severity !== undefined ? { severity: opts.severity } : {}),
      ...(opts.cooldownSeconds !== undefined
        ? { cooldown_seconds: opts.cooldownSeconds }
        : {}),
    },
  });
}

export async function deleteRule(opts: {
  accountId: string;
  ruleId: string;
}): Promise<void> {
  await serverFetch<void>(`/v1/rules/${opts.ruleId}`, {
    accountId: opts.accountId,
    method: "DELETE",
  });
}
