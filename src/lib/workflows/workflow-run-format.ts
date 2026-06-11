// Workflow Engine M2 — pure, theme-agnostic display helpers for workflow
// runs. Statuses/action results/trigger types are open vocabulary on the
// wire, so every helper echoes unknown values through instead of throwing —
// a newer api-server deploy must never blank out the history page.

import { isRuleType, ruleTypeLabel } from "@/lib/rules/rule-config-schema";

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  completed: "Completed",
  failed: "Failed",
  action_required: "Action required",
  suppressed: "Suppressed",
};

/** Human label for a run status; unknown statuses echo through unchanged. */
export function workflowRunStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/**
 * Chip styling per status, in the dashboard-next palette. Unknown statuses
 * get the neutral chip.
 */
export function workflowRunStatusChipClass(status: string): string {
  switch (status) {
    case "completed":
      return "bg-[var(--dn-creek-mid)]/15 text-[var(--dn-creek-deep)]";
    case "suppressed":
      return "bg-black/[0.06] text-black/60";
    case "failed":
      return "bg-red-700/10 text-red-700";
    case "action_required":
      return "bg-[#8a6d1f]/15 text-[#8a6d1f]";
    case "active":
      return "bg-[var(--dn-creek-mid)]/10 text-[var(--dn-creek-mid)]";
    default:
      return "bg-black/[0.06] text-black/60";
  }
}

const ACTION_RESULT_LABELS: Record<string, string> = {
  alert_created: "Alert created",
  alert_suppressed_cooldown: "Alert suppressed (cooldown)",
  no_action: "No action",
  error: "Error",
};

/**
 * Human label for a run's action outcome. Null (run still active) renders
 * as an em dash; unknown results echo through unchanged.
 */
export function workflowRunActionResultLabel(
  actionResult: string | null,
): string {
  if (actionResult === null) return "—";
  return ACTION_RESULT_LABELS[actionResult] ?? actionResult;
}

/**
 * Human label for the observation type that triggered a run, e.g.
 * "processor.line_crossing" → "Line crossing". Unknown types echo through.
 */
export function workflowRunTriggerLabel(triggerType: string): string {
  // Per-object line crossings map to the same rule family but deserve a
  // distinct label so runs read honestly in the history.
  if (triggerType === "processor.line_crossing_object") {
    return "Line crossing (object)";
  }
  const bare = triggerType.replace(/^processor\./, "");
  return isRuleType(bare) ? ruleTypeLabel(bare) : triggerType;
}
