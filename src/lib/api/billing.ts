import "server-only";

import { serverFetch } from "./server";

// Stripe Checkout / Customer Portal session creation (Module 7 M2).
// Contract: ../upstream-api-server/docs/api-contracts.md
//   POST /v1/billing/checkout {account_id, plan} → {url}
//   POST /v1/billing/portal   {account_id}       → {url}
// Owner/admin only. Both return a Stripe-HOSTED URL the browser navigates
// to — no card data ever touches Upstream. 503 `billing_not_configured`
// when the deployment has no Stripe keys.

export interface BillingUrlResponse {
  url: string;
}

export async function createCheckoutSession(opts: {
  accountId: string;
  plan: "starter" | "pro";
}): Promise<BillingUrlResponse> {
  return serverFetch<BillingUrlResponse>("/v1/billing/checkout", {
    accountId: opts.accountId,
    method: "POST",
    body: { account_id: opts.accountId, plan: opts.plan },
  });
}

export async function createPortalSession(opts: {
  accountId: string;
}): Promise<BillingUrlResponse> {
  return serverFetch<BillingUrlResponse>("/v1/billing/portal", {
    accountId: opts.accountId,
    method: "POST",
    body: { account_id: opts.accountId },
  });
}
