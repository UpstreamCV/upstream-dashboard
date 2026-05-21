import "server-only";

import { serverFetch } from "./server";
import type { AccountLimits, AccountSummary } from "./types";

/**
 * Fetch the account row for the active account: id, name, slug, plan, status,
 * metadata, timestamps. Used by the dashboard-next home tile "Plan & Usage"
 * to render the plan label.
 *
 * Account scoping is enforced inside {@link serverFetch} — it auto-appends
 * `?account_id=` and the api-server's `CurrentCaller` dependency checks the
 * caller's membership before returning the row.
 */
export async function getAccount(opts: {
  accountId: string;
}): Promise<AccountSummary> {
  return serverFetch<AccountSummary>("/v1/account", {
    accountId: opts.accountId,
  });
}

/**
 * Fetch the active account's hard limits: `max_cameras`,
 * `max_concurrent_sessions`, `max_fps`, `max_width`, `max_height`,
 * `max_bitrate_kbps`, `allowed_codecs`, `monthly_minutes_quota`,
 * `snapshot_storage_mb`. The home page uses these to scale the Plan & Usage
 * meters and to derive the "Concurrent Streams" tile's slot-capacity status.
 *
 * The api-server returns 404 `account_limits_missing` for accounts with no
 * limits row (shouldn't happen under normal provisioning); that surfaces as
 * an {@link UpstreamApiError} for the segment error boundary to catch.
 */
export async function getAccountLimits(opts: {
  accountId: string;
}): Promise<AccountLimits> {
  return serverFetch<AccountLimits>("/v1/account/limits", {
    accountId: opts.accountId,
  });
}
