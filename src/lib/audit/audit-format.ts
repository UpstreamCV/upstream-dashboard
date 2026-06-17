// Module 7 M3 — pure display helpers for tenant audit logs.
//
// Event types are an open vocabulary (dotted verbs) — every helper has a
// graceful fallback so a new backend event renders sensibly without a
// dashboard deploy. Metadata rendering is allowlist-based: only known-safe
// keys are ever shown, so a future backend metadata addition can't leak
// into the UI unreviewed.

import type { AuditLogItem } from "@/lib/api/types";

export const AUDIT_CATEGORIES = [
  "all",
  "security",
  "billing",
  "cameras",
  "tokens",
  "rules",
  "workflows",
  "limits",
] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
  all: "All",
  security: "Security",
  billing: "Billing",
  cameras: "Cameras",
  tokens: "Tokens",
  rules: "Rules",
  workflows: "Workflows",
  limits: "Limits",
};

// "Security Events" is a CROSS-CUTTING view (Account History = "all"), not a
// single-category bucket — credential + access-control events that also belong
// to their own category (tokens, limits). Kept separate from auditEventCategory
// (which assigns one category per event) so the per-category chips are unchanged.
export function isSecurityEvent(eventType: string): boolean {
  return (
    eventType.startsWith("api_token.") ||
    eventType === "stream_session.limit_rejected"
  );
}

const EVENT_LABELS: Record<string, string> = {
  "billing.checkout_started": "Checkout started",
  "billing.portal_opened": "Billing portal opened",
  "billing.subscription_synced": "Subscription synced",
  "billing.subscription_canceled": "Subscription canceled",
  "billing.payment_failed": "Payment failed",
  "billing.plan_changed": "Plan changed",
  "billing.limits_updated": "Limits updated",
  "camera.created": "Camera created",
  "camera.updated": "Camera updated",
  "camera.claimed": "Camera claimed",
  "camera.disabled": "Camera disabled",
  "camera.deleted": "Camera deleted",
  "api_token.created": "API token created",
  "api_token.revoked": "API token revoked",
  "rule.created": "Rule created",
  "rule.updated": "Rule updated",
  "rule.deleted": "Rule deleted",
  "workflow.created": "Workflow created",
  "workflow.updated": "Workflow updated",
  "workflow.deleted": "Workflow deleted",
  "workflow.enabled": "Workflow enabled",
  "workflow.disabled": "Workflow disabled",
  "stream_session.limit_rejected": "Stream blocked by limit",
};

/** "workflow.updated" → "Workflow updated"; unknown types degrade to a
 * title-cased version of the raw event type. */
export function auditEventLabel(eventType: string): string {
  const known = EVENT_LABELS[eventType];
  if (known) return known;
  const tail = eventType.split(".").pop() ?? eventType;
  const words = `${eventType.split(".")[0]} ${tail.replace(/_/g, " ")}`;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Category for the filter chips. Unknown prefixes land in "all" only. */
export function auditEventCategory(eventType: string): AuditCategory | null {
  if (eventType === "stream_session.limit_rejected") return "limits";
  if (eventType.startsWith("billing.")) return "billing";
  if (eventType.startsWith("camera.")) return "cameras";
  if (eventType.startsWith("api_token.")) return "tokens";
  if (eventType.startsWith("rule.")) return "rules";
  if (eventType.startsWith("workflow.")) return "workflows";
  return null;
}

/** Who did it, for the table's actor column. */
export function auditActorLabel(item: AuditLogItem): string {
  switch (item.actor.type) {
    case "user":
      // No user directory endpoint yet — show a stable short id.
      return item.actor.user_id
        ? `User ${item.actor.user_id.slice(0, 8)}`
        : "User";
    case "stripe":
      return "Stripe";
    case "system":
      return "System";
    case "internal":
      return "Upstream";
    default:
      return item.actor.type;
  }
}

// Keys that are safe AND useful to surface in the preview column.
const PREVIEW_KEYS = [
  "name",
  "plan",
  "old_plan",
  "new_plan",
  "changed_fields",
  "limit_code",
  "scopes",
  "token_name",
  "subscription_status",
  "used",
  "limit",
] as const;

/** Short "key: value" pairs for the metadata preview. Allowlist-only —
 * anything not in PREVIEW_KEYS is never rendered. */
export function auditMetadataPreview(
  metadata: Record<string, unknown>,
): string[] {
  const parts: string[] = [];
  for (const key of PREVIEW_KEYS) {
    const value = metadata[key];
    if (value === undefined || value === null) continue;
    const rendered = Array.isArray(value)
      ? value.map(String).join(", ")
      : String(value);
    if (rendered !== "") parts.push(`${key.replace(/_/g, " ")}: ${rendered}`);
    if (parts.length >= 3) break;
  }
  return parts;
}
