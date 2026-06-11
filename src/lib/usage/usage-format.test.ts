import { describe, expect, it } from "vitest";

import type { UsageSummary } from "@/lib/api/types";
import {
  USAGE_STATE_LABELS,
  formatUsagePeriod,
  usageWarnings,
} from "./usage-format";

function summary(states: Partial<UsageSummary["states"]>): UsageSummary {
  return {
    plan: { key: "free", label: "Free", status: "active" },
    period: { start: "2026-06-01T00:00:00Z", end: "2026-07-01T00:00:00Z" },
    limits: {
      max_cameras: 5,
      max_concurrent_sessions: 5,
      monthly_minutes_quota: 600,
      allowed_stream_types: ["rtsp", "webcam"],
    },
    usage: {
      cameras: 2,
      active_streams: 1,
      stream_minutes: 430,
      workflow_runs: 10,
      alerts: 3,
      rules: 4,
      workflows: 1,
    },
    states: {
      cameras: "ok",
      active_streams: "ok",
      stream_minutes: "ok",
      ...states,
    },
    billing: {
      provider: "stripe",
      configured: false,
      status: "none",
      subscription_status: null,
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
      management_available: false,
    },
  };
}

describe("usageWarnings", () => {
  it("returns nothing when everything is ok", () => {
    expect(usageWarnings(summary({}))).toEqual([]);
  });

  it("describes a near-limit metric in plain English", () => {
    const warnings = usageWarnings(summary({ stream_minutes: "near_limit" }));
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toBe(
      "You are close to your monthly streaming minutes limit.",
    );
  });

  it("explains the blocked consequence at the limit", () => {
    const [w] = usageWarnings(summary({ stream_minutes: "at_limit" }));
    expect(w.message).toBe(
      "You have used all of your monthly streaming minutes. New streaming sessions are blocked until your usage period resets.",
    );
    const [c] = usageWarnings(summary({ cameras: "at_limit" }));
    expect(c.message).toContain("New cameras cannot be added");
  });

  it("sorts worst state first", () => {
    const warnings = usageWarnings(
      summary({
        cameras: "near_limit",
        stream_minutes: "over_limit",
        active_streams: "at_limit",
      }),
    );
    expect(warnings.map((w) => w.state)).toEqual([
      "over_limit",
      "at_limit",
      "near_limit",
    ]);
    expect(warnings[0].message).toContain("over your monthly streaming minutes");
  });
});

describe("formatUsagePeriod", () => {
  it("formats the UTC month window", () => {
    expect(
      formatUsagePeriod({
        start: "2026-06-01T00:00:00Z",
        end: "2026-07-01T00:00:00Z",
      }),
    ).toBe("Jun 1 – Jul 1, 2026");
  });
});

describe("USAGE_STATE_LABELS", () => {
  it("covers every state", () => {
    expect(Object.keys(USAGE_STATE_LABELS).sort()).toEqual([
      "at_limit",
      "near_limit",
      "ok",
      "over_limit",
    ]);
  });
});

describe("billing helpers", () => {
  it("labels billing statuses", async () => {
    const { billingStatusLabel } = await import("./usage-format");
    expect(billingStatusLabel("active")).toBe("Active");
    expect(billingStatusLabel("trialing")).toBe("Trial");
    expect(billingStatusLabel("past_due")).toBe("Payment issue");
    expect(billingStatusLabel("canceled")).toBe("Canceled");
    expect(billingStatusLabel("none")).toBe("No subscription");
    expect(billingStatusLabel("paused")).toBe("paused");
  });

  it("formats billing dates in UTC", async () => {
    const { formatBillingDate } = await import("./usage-format");
    expect(formatBillingDate("2026-07-01T00:00:00Z")).toBe("Jul 1, 2026");
  });
});
