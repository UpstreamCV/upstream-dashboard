import "server-only";

import { serverFetch } from "./server";
import { UpstreamApiError } from "./errors";
import type { LatestFrame } from "./types";

/**
 * Latest captured frame for a camera, with a freshly-minted Supabase
 * Storage signed URL. Returns `null` if the camera hasn't streamed yet
 * (api-server returns 404 `snapshot_not_found` in that case).
 */
export async function getLatestFrame(opts: {
  accountId: string;
  cameraId: string;
}): Promise<LatestFrame | null> {
  try {
    return await serverFetch<LatestFrame>(
      `/v1/cameras/${opts.cameraId}/latest-frame`,
      { accountId: opts.accountId },
    );
  } catch (err) {
    if (
      err instanceof UpstreamApiError &&
      (err.status === 404 || err.code === "snapshot_not_found")
    ) {
      return null;
    }
    throw err;
  }
}
