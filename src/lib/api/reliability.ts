import "server-only";

import { serverFetch } from "./server";
import { UpstreamApiError } from "./errors";
import type {
  ReliabilityFinding,
  ReliabilityFindingsResponse,
  ReliabilityStatus,
  ReliabilitySummary,
} from "./types";

/**
 * Reliability summary for one camera — drives the Monitor-tab Reliability card.
 *
 * The api-server evaluates rules on read inside this call, so the response
 * already reflects current state without a separate poll. Returns `null` on
 * a 404 `camera_not_found` (same posture as `getLatestProcessorStatus`); the
 * page Server Component shows a muted "Unavailable" state without crashing
 * the rest of the tab.
 *
 * Non-404 errors re-throw so the segment error boundary surfaces them.
 */
export async function getReliabilitySummary(opts: {
  accountId: string;
  cameraId: string;
}): Promise<ReliabilitySummary | null> {
  try {
    return await serverFetch<ReliabilitySummary>(
      `/v1/cameras/${opts.cameraId}/reliability/summary`,
      { accountId: opts.accountId },
    );
  } catch (err) {
    if (
      err instanceof UpstreamApiError &&
      (err.status === 404 || err.code === "camera_not_found")
    ) {
      return null;
    }
    throw err;
  }
}

/**
 * All currently open reliability findings for one camera (severity-desc,
 * then most-recently-seen). The eventual "full Reliability tab" will lean on
 * this; the M0/M1-A slice doesn't render the list yet, but having the wrapper
 * means tests can exercise it and the future tab won't need a new client.
 *
 * Returns `[]` on 404 so a missing camera collapses to "no findings" instead
 * of blowing up the surrounding page.
 */
export async function getReliabilityFindings(opts: {
  accountId: string;
  cameraId: string;
  limit?: number;
  // M4: server defaults to "open" so omitting this preserves M0 behavior.
  // "resolved" drives the Reliability tab's Recently resolved section.
  status?: ReliabilityStatus;
}): Promise<ReliabilityFinding[]> {
  const query: Record<string, string> = {};
  if (opts.limit !== undefined) {
    query.limit = String(opts.limit);
  }
  if (opts.status !== undefined) {
    query.status = opts.status;
  }
  try {
    const res = await serverFetch<ReliabilityFindingsResponse>(
      `/v1/cameras/${opts.cameraId}/reliability/findings`,
      { accountId: opts.accountId, query },
    );
    return res.findings;
  } catch (err) {
    if (
      err instanceof UpstreamApiError &&
      (err.status === 404 || err.code === "camera_not_found")
    ) {
      return [];
    }
    throw err;
  }
}
