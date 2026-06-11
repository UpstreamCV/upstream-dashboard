import { describe, expect, it } from "vitest";

import {
  workflowRunActionResultLabel,
  workflowRunStatusChipClass,
  workflowRunStatusLabel,
  workflowRunTriggerLabel,
} from "./workflow-run-format";

// Statuses/action results/trigger types are open vocabulary on the wire —
// every helper must echo unknown values instead of throwing, so a newer
// api-server deploy can never blank out the history page.

describe("workflowRunStatusLabel", () => {
  it.each([
    ["active", "Active"],
    ["completed", "Completed"],
    ["failed", "Failed"],
    ["action_required", "Action required"],
    ["suppressed", "Suppressed"],
  ])("labels %s", (status, label) => {
    expect(workflowRunStatusLabel(status)).toBe(label);
  });

  it("echoes unknown statuses", () => {
    expect(workflowRunStatusLabel("escalated")).toBe("escalated");
  });
});

describe("workflowRunStatusChipClass", () => {
  it("distinguishes completed from suppressed", () => {
    expect(workflowRunStatusChipClass("completed")).not.toBe(
      workflowRunStatusChipClass("suppressed"),
    );
  });

  it("falls back to the neutral chip for unknown statuses", () => {
    expect(workflowRunStatusChipClass("escalated")).toBe(
      workflowRunStatusChipClass("suppressed"),
    );
  });
});

describe("workflowRunActionResultLabel", () => {
  it.each([
    ["alert_created", "Alert created"],
    ["alert_suppressed_cooldown", "Alert suppressed (cooldown)"],
    ["no_action", "No action"],
    ["error", "Error"],
  ])("labels %s", (result, label) => {
    expect(workflowRunActionResultLabel(result)).toBe(label);
  });

  it("renders null (still-active run) as an em dash", () => {
    expect(workflowRunActionResultLabel(null)).toBe("—");
  });

  it("echoes unknown action results", () => {
    expect(workflowRunActionResultLabel("webhook_sent")).toBe("webhook_sent");
  });
});

describe("workflowRunTriggerLabel", () => {
  it("maps observation types to rule-type labels", () => {
    expect(workflowRunTriggerLabel("processor.line_crossing")).toBe(
      "Line crossing",
    );
    expect(workflowRunTriggerLabel("processor.line_crossing_object")).toBe(
      "Line crossing (object)",
    );
    expect(workflowRunTriggerLabel("processor.dwell_exceeded")).toBe(
      "Dwell time exceeded",
    );
  });

  it("echoes unmapped trigger types unchanged", () => {
    expect(workflowRunTriggerLabel("processor.mock_detection")).toBe(
      "processor.mock_detection",
    );
    expect(workflowRunTriggerLabel("schedule.cron")).toBe("schedule.cron");
  });
});
