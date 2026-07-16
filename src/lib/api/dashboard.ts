import "server-only";

import { reportError } from "@/lib/error";
import { serverFetch } from "./server";
import type {
  DashboardSummary,
  FleetTrendRange,
  FleetTrendResponse,
} from "./types";

export async function getDashboardSummary(opts: {
  accountId: string;
}): Promise<DashboardSummary> {
  return serverFetch<DashboardSummary>("/v1/dashboard/summary", {
    accountId: opts.accountId,
  });
}

/**
 * Hourly fleet-health history for the Home page's Fleet Overview chart.
 * Derived server-side from `heartbeats`, so it carries real history from the
 * moment it ships (no rollup/sampler warm-up).
 *
 * Catches **all** errors and returns `null` (logging via reportError), not just
 * 404 — same posture as getReliabilityConfidenceTrend. Home fetches this
 * alongside every other tile's data in a single `Promise.all`, where any
 * rejection would blank the whole page via the segment error boundary. The
 * chart is one tile; it degrades to an unavailable state on its own.
 */
export async function getFleetTrend(opts: {
  accountId: string;
  range?: FleetTrendRange;
}): Promise<FleetTrendResponse | null> {
  const range: FleetTrendRange = opts.range ?? "24h";
  try {
    return await serverFetch<FleetTrendResponse>("/v1/dashboard/fleet-trend", {
      accountId: opts.accountId,
      query: { range },
    });
  } catch (err) {
    reportError(err, { area: "dashboard-fleet-trend" });
    return null;
  }
}
