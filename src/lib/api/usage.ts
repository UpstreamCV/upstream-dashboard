import "server-only";

import { serverFetch } from "./server";
import type { UsageSummary } from "./types";

// Usage summary read (Module 7 M1).
// Contract: ../upstream-api-server/docs/api-contracts.md
//   GET /v1/usage/summary?account_id= → UsageSummary
// Any account member can read. No Stripe/billing links until M2.

export async function getUsageSummary(opts: {
  accountId: string;
}): Promise<UsageSummary> {
  return serverFetch<UsageSummary>("/v1/usage/summary", {
    accountId: opts.accountId,
  });
}
