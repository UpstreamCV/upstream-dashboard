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
