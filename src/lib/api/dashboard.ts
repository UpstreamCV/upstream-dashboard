import "server-only";

import { serverFetch } from "./server";
import type { DashboardSummary } from "./types";

export async function getDashboardSummary(opts: {
  accountId: string;
}): Promise<DashboardSummary> {
  return serverFetch<DashboardSummary>("/v1/dashboard/summary", {
    accountId: opts.accountId,
  });
}
