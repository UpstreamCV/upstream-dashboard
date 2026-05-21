import "server-only";

import { serverFetch } from "./server";
import type { ObservationRecord, RecentObservationsResponse } from "./types";

/**
 * Recent processor observations for one camera, newest first (P5-A endpoint).
 *
 * `serverFetch`'s `query` drops `undefined` values, so an absent `type` /
 * `limit` simply omits the param — no conditional spreading needed.
 */
export async function listRecentObservations(opts: {
  accountId: string;
  cameraId: string;
  type?: string;
  limit?: number;
}): Promise<ObservationRecord[]> {
  const res = await serverFetch<RecentObservationsResponse>(
    `/v1/cameras/${opts.cameraId}/observations/recent`,
    {
      accountId: opts.accountId,
      query: { type: opts.type, limit: opts.limit },
    },
  );
  return res.observations;
}
