import { describe, expect, it } from "vitest";

import type { AuditLogItem } from "@/lib/api/types";
import {
  auditActorLabel,
  auditEventCategory,
  auditEventLabel,
  auditMetadataPreview,
} from "./audit-format";

function item(overrides: Partial<AuditLogItem> = {}): AuditLogItem {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    created_at: "2026-06-11T12:00:00Z",
    actor: { type: "user", user_id: "abcdef12-0000-0000-0000-000000000002" },
    event_type: "workflow.updated",
    resource_type: "workflow",
    resource_id: "wf-1",
    summary: "Workflow updated.",
    metadata: {},
    ...overrides,
  };
}

describe("auditEventLabel", () => {
  it("labels known events", () => {
    expect(auditEventLabel("camera.created")).toBe("Camera created");
    expect(auditEventLabel("billing.plan_changed")).toBe("Plan changed");
    expect(auditEventLabel("stream_session.limit_rejected")).toBe(
      "Stream blocked by limit",
    );
  });

  it("degrades unknown events readably", () => {
    expect(auditEventLabel("camera.archived")).toBe("Camera archived");
    expect(auditEventLabel("zone.geo_fenced")).toBe("Zone geo fenced");
  });
});

describe("auditEventCategory", () => {
  it("maps event prefixes to filter categories", () => {
    expect(auditEventCategory("billing.checkout_started")).toBe("billing");
    expect(auditEventCategory("camera.updated")).toBe("cameras");
    expect(auditEventCategory("api_token.revoked")).toBe("tokens");
    expect(auditEventCategory("rule.deleted")).toBe("rules");
    expect(auditEventCategory("workflow.enabled")).toBe("workflows");
    expect(auditEventCategory("stream_session.limit_rejected")).toBe("limits");
    expect(auditEventCategory("something.else")).toBeNull();
  });
});

describe("auditActorLabel", () => {
  it("labels each actor type", () => {
    expect(auditActorLabel(item())).toBe("User abcdef12");
    expect(auditActorLabel(item({ actor: { type: "stripe", user_id: null } }))).toBe(
      "Stripe",
    );
    expect(auditActorLabel(item({ actor: { type: "system", user_id: null } }))).toBe(
      "System",
    );
    expect(
      auditActorLabel(item({ actor: { type: "internal", user_id: null } })),
    ).toBe("Upstream");
  });
});

describe("auditMetadataPreview", () => {
  it("renders only allowlisted keys", () => {
    const preview = auditMetadataPreview({
      name: "Dock check",
      changed_fields: ["enabled", "config"],
      token: "upstream_live_SECRET",
      stripe_customer_id: "cus_123",
      password: "x",
    });
    expect(preview).toEqual([
      "name: Dock check",
      "changed fields: enabled, config",
    ]);
    expect(preview.join(" ")).not.toContain("SECRET");
    expect(preview.join(" ")).not.toContain("cus_123");
  });

  it("caps at three entries and skips nulls", () => {
    const preview = auditMetadataPreview({
      name: "x",
      plan: null,
      old_plan: "free",
      new_plan: "starter",
      limit_code: "limit_exceeded.max_cameras",
    });
    expect(preview).toHaveLength(3);
  });

  it("returns empty for empty metadata", () => {
    expect(auditMetadataPreview({})).toEqual([]);
  });
});
