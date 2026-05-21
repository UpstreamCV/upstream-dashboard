import "server-only";

import { serverFetch } from "./server";
import { UpstreamApiError } from "./errors";
import type { LatestPerceptionRecord, LatestPerceptionResponse } from "./types";

/**
 * Latest perception snapshot for one camera (P5-C endpoint) — the processor's
 * current visual state (detected objects + configured geometry), upserted one
 * row per camera. Returns `null` when the processor hasn't posted a snapshot
 * yet: api-server answers 404 `perception_snapshot_not_found`, the same
 * missing-resource convention `getLatestFrame` already relies on. Other errors
 * re-throw so the page's error boundary surfaces them.
 */
export async function getLatestPerception(opts: {
  accountId: string;
  cameraId: string;
}): Promise<LatestPerceptionRecord | null> {
  try {
    const res = await serverFetch<LatestPerceptionResponse>(
      `/v1/cameras/${opts.cameraId}/perception/latest`,
      { accountId: opts.accountId },
    );
    return res.snapshot;
  } catch (err) {
    if (
      err instanceof UpstreamApiError &&
      (err.status === 404 || err.code === "perception_snapshot_not_found")
    ) {
      return null;
    }
    throw err;
  }
}
