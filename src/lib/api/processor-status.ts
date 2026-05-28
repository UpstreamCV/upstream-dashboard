import "server-only";

import { serverFetch } from "./server";
import { UpstreamApiError } from "./errors";
import type {
  LatestProcessorStatusResponse,
  ProcessorStatusRecord,
} from "./types";

/**
 * Latest processor status for one camera (P6-D endpoint) — the full
 * `processor_statuses` row including the `payload.applied_geometry` lineage
 * block the P6-C analytics worker stamps. The Monitor-tab Applied Geometry
 * chip reads this to confirm the processor actually picked up the operator's
 * saved geometry on its current session.
 *
 * Returns `null` when the processor hasn't reported yet: api-server answers
 * 404 `processor_status_not_found`, the same missing-resource convention
 * `getLatestPerception` / `getLatestFrame` already rely on. Other errors
 * re-throw so the page's error boundary surfaces them.
 *
 * `streamSessionId` narrows to a specific run. Useful when multiple processor
 * restarts have stamped multiple rows for the same camera (common in
 * dev/verification — the supervisor bounds DeepStream runs by a probe-timeout
 * and cycles fresh workers).
 */
export async function getLatestProcessorStatus(opts: {
  accountId: string;
  cameraId: string;
  streamSessionId?: string;
}): Promise<ProcessorStatusRecord | null> {
  const query: Record<string, string> = {};
  if (opts.streamSessionId) {
    query.stream_session_id = opts.streamSessionId;
  }
  try {
    const res = await serverFetch<LatestProcessorStatusResponse>(
      `/v1/cameras/${opts.cameraId}/processor-status/latest`,
      { accountId: opts.accountId, query },
    );
    return res.status;
  } catch (err) {
    if (
      err instanceof UpstreamApiError &&
      (err.status === 404 || err.code === "processor_status_not_found")
    ) {
      return null;
    }
    throw err;
  }
}
