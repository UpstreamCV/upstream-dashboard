// Module 7 M1 — pure helpers for the billing/usage page. Plain-English
// labels and banner copy for near/at/over-limit states; no Stripe language
// (billing management is M2 — there is no upgrade flow to link to yet).

import type { UsageState, UsageSummary } from "@/lib/api/types";

export const USAGE_STATE_LABELS: Record<UsageState, string> = {
  ok: "OK",
  near_limit: "Near limit",
  at_limit: "At limit",
  over_limit: "Over limit",
};

/** Human name for each metered resource, used in banner copy. */
const METRIC_NOUNS: Record<keyof UsageSummary["states"], string> = {
  cameras: "camera slots",
  active_streams: "concurrent stream slots",
  stream_minutes: "monthly streaming minutes",
};

export interface UsageWarning {
  metric: keyof UsageSummary["states"];
  state: Exclude<UsageState, "ok">;
  message: string;
}

function warningMessage(
  metric: keyof UsageSummary["states"],
  state: Exclude<UsageState, "ok">,
): string {
  const noun = METRIC_NOUNS[metric];
  if (state === "near_limit") {
    return `You are close to your ${noun} limit.`;
  }
  const consequence =
    metric === "stream_minutes"
      ? "New streaming sessions are blocked until your usage period resets."
      : metric === "cameras"
        ? "New cameras cannot be added until a slot is freed."
        : "New streams cannot start until a session ends.";
  if (state === "at_limit") {
    return `You have used all of your ${noun}. ${consequence}`;
  }
  return `You are over your ${noun} limit. ${consequence}`;
}

/** Banner-worthy warnings, worst first. Empty array = all ok. */
export function usageWarnings(summary: UsageSummary): UsageWarning[] {
  const rank: Record<UsageState, number> = {
    over_limit: 0,
    at_limit: 1,
    near_limit: 2,
    ok: 3,
  };
  const warnings: UsageWarning[] = [];
  for (const metric of Object.keys(summary.states) as Array<
    keyof UsageSummary["states"]
  >) {
    const state = summary.states[metric];
    if (state !== "ok") {
      warnings.push({ metric, state, message: warningMessage(metric, state) });
    }
  }
  return warnings.sort((a, b) => rank[a.state] - rank[b.state]);
}

/** "Jun 1 – Jul 1, 2026" — the current usage period, for the plan card. */
export function formatUsagePeriod(period: UsageSummary["period"]): string {
  const start = new Date(period.start);
  const end = new Date(period.end);
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
      timeZone: "UTC",
    });
  return `${fmt(start, false)} – ${fmt(end, true)}`;
}
