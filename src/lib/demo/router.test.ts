import { beforeEach, describe, expect, test } from "vitest";
import { resolveDemoResponse } from "./router";
import { resetDemoState } from "./state";
import {
  ALERT_MISSED_ID,
  CAMERA_ID,
  RULE_QUIET_ID,
  demoTokens,
} from "./fixtures";
import type {
  Alert,
  AlertListResponse,
  ApiTokenCreated,
  ApiTokenListResponse,
  AuditLogListResponse,
  HeartbeatListResponse,
  Rule,
  RuleListResponse,
  UsageSummary,
  WorkflowListResponse,
  WorkflowRunListResponse,
} from "@/lib/api/types";

// The demo router is the whole "backend" of /demo: every sidebar route must
// get a well-formed envelope (never `{}`), and writes must stick in memory.

beforeEach(() => resetDemoState());

describe("account-level reads", () => {
  test("usage summary is fully shaped and counts the fixtures", () => {
    const usage = resolveDemoResponse("/v1/usage/summary", undefined, "counting") as UsageSummary;
    expect(usage.plan.label).toBe("Pro");
    expect(usage.usage.stream_minutes).toBeGreaterThan(0);
    expect(usage.usage.rules).toBe(4);
    expect(usage.usage.workflows).toBe(1);
    expect(usage.billing.configured).toBe(true);
    expect(usage.billing.management_available).toBe(false);
  });

  test("every list endpoint returns its envelope, populated once the camera exists", () => {
    const scene = "counting";
    expect((resolveDemoResponse("/v1/alerts", undefined, scene) as AlertListResponse).alerts.length).toBeGreaterThan(0);
    expect((resolveDemoResponse("/v1/rules", undefined, scene) as RuleListResponse).rules.length).toBe(4);
    expect((resolveDemoResponse("/v1/workflows", undefined, scene) as WorkflowListResponse).workflows.length).toBe(1);
    expect((resolveDemoResponse("/v1/workflow-runs", undefined, scene) as WorkflowRunListResponse).runs.length).toBeGreaterThan(3);
    const audit = resolveDemoResponse("/v1/audit-logs", undefined, scene) as AuditLogListResponse;
    expect(audit.items.length).toBeGreaterThan(5);
    expect(audit.next_cursor).toBeNull();
    const hb = resolveDemoResponse("/v1/agents/x/heartbeats", { limit: 5 }, scene) as HeartbeatListResponse;
    expect(hb.heartbeats).toHaveLength(5);
  });

  test("before the camera is added the account is empty but well-formed", () => {
    expect(resolveDemoResponse("/v1/alerts", undefined, "adding")).toEqual({ alerts: [] });
    expect(resolveDemoResponse("/v1/rules", undefined, "adding")).toEqual({ rules: [] });
    expect((resolveDemoResponse("/v1/usage/summary", undefined, "adding") as UsageSummary).usage.cameras).toBe(0);
  });

  test("alerts follow the narrative: missed crossing is open at `problem`, resolved at `fixed`", () => {
    const open = (resolveDemoResponse("/v1/alerts", { status: "open" }, "problem") as AlertListResponse).alerts;
    expect(open.map((a) => a.id)).toContain(ALERT_MISSED_ID);
    expect((resolveDemoResponse("/v1/alerts", { status: "open" }, "counting") as AlertListResponse).alerts).toEqual([]);
    const fixedAlert = (resolveDemoResponse("/v1/alerts", undefined, "fixed") as AlertListResponse).alerts.find(
      (a) => a.id === ALERT_MISSED_ID,
    );
    expect(fixedAlert?.status).toBe("resolved");
  });

  test("list filters: camera_id + limit", () => {
    const res = resolveDemoResponse("/v1/alerts", { camera_id: "nope", limit: 1 }, "problem") as AlertListResponse;
    expect(res.alerts).toEqual([]);
    const one = resolveDemoResponse("/v1/alerts", { camera_id: CAMERA_ID, limit: 1 }, "problem") as AlertListResponse;
    expect(one.alerts).toHaveLength(1);
  });

  test("unknown paths stay empty-but-safe", () => {
    expect(resolveDemoResponse("/v1/nothing/here", undefined, "counting")).toEqual({});
  });
});

describe("writes take effect in memory", () => {
  test("mark read then resolve an alert", () => {
    const read = resolveDemoResponse(`/v1/alerts/${ALERT_MISSED_ID}/read`, undefined, "problem", { method: "POST" }) as Alert;
    expect(read.read_at).not.toBeNull();
    const resolved = resolveDemoResponse(`/v1/alerts/${ALERT_MISSED_ID}/resolve`, undefined, "problem", { method: "POST" }) as Alert;
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolved_at).not.toBeNull();
    const open = (resolveDemoResponse("/v1/alerts", { status: "open" }, "problem") as AlertListResponse).alerts;
    expect(open.find((a) => a.id === ALERT_MISSED_ID)).toBeUndefined();
  });

  test("toggle, create and delete rules", () => {
    const toggled = resolveDemoResponse(`/v1/rules/${RULE_QUIET_ID}`, undefined, "counting", {
      method: "PATCH",
      body: { enabled: true },
    }) as Rule;
    expect(toggled.enabled).toBe(true);
    expect((resolveDemoResponse("/v1/rules", undefined, "counting") as RuleListResponse).rules.find((r) => r.id === RULE_QUIET_ID)?.enabled).toBe(true);

    const createdRule = resolveDemoResponse("/v1/rules", undefined, "counting", {
      method: "POST",
      body: { camera_id: CAMERA_ID, name: "Forklift in bay", rule_type: "zone_entered", config: { zone_id: "bay" }, severity: "info", cooldown_seconds: 30 },
    }) as Rule;
    expect(createdRule.name).toBe("Forklift in bay");
    expect((resolveDemoResponse("/v1/rules", undefined, "counting") as RuleListResponse).rules).toHaveLength(5);

    expect(resolveDemoResponse(`/v1/rules/${createdRule.id}`, undefined, "counting", { method: "DELETE" })).toBeUndefined();
    expect((resolveDemoResponse("/v1/rules", undefined, "counting") as RuleListResponse).rules).toHaveLength(4);
  });

  test("create + revoke an API token", () => {
    const created = resolveDemoResponse("/v1/api-tokens", undefined, "counting", {
      method: "POST",
      body: { name: "ci-runner", scopes: ["agent"] },
    }) as ApiTokenCreated;
    expect(created.plaintext).toMatch(/^ups_demo_/);
    expect(created.token.name).toBe("ci-runner");
    let list = (resolveDemoResponse("/v1/api-tokens", undefined, "counting") as ApiTokenListResponse).tokens;
    expect(list).toHaveLength(demoTokens.tokens.length + 1);
    expect(list[0].id).toBe(created.token.id);

    resolveDemoResponse(`/v1/api-tokens/${created.token.id}`, undefined, "counting", { method: "DELETE" });
    list = (resolveDemoResponse("/v1/api-tokens", undefined, "counting") as ApiTokenListResponse).tokens;
    expect(list.find((t) => t.id === created.token.id)?.revoked_at).not.toBeNull();
  });

  test("processing master switch persists", () => {
    resolveDemoResponse("/v1/account/processing-config", undefined, "counting", { method: "PATCH", body: { processing_enabled: false } });
    expect(resolveDemoResponse("/v1/account/processing-config", undefined, "counting")).toMatchObject({ processing_enabled: false });
    resetDemoState();
    expect(resolveDemoResponse("/v1/account/processing-config", undefined, "counting")).toMatchObject({ processing_enabled: true });
  });
});
