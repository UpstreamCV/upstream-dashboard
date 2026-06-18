import "server-only";

import { reportError } from "@/lib/error";
import { serverFetch } from "./server";
import type {
  ProcessingEvidenceRange,
  ProcessingEvidenceResponse,
} from "./types";

// Processing runtime evidence wrapper (P5-J).
//
// Endpoint exists on upstream-api-server; no backend changes here.
// Contract: ../upstream-api-server/docs/api-contracts.md
//   GET /v1/cameras/{camera_id}/processing/evidence?range=1h|24h
//     → ProcessingEvidenceResponse
//
// This is a NON-ESSENTIAL visibility enhancement rendered BELOW the package
// selector, so it degrades ALL errors to `null` (the panel shows an
// "unavailable" state) — it must never break the Processing tab above it. Same
// posture as getReliabilityConfidenceTrend.

/** SWR/proxy key for the client poller — must match the server fetch's target. */
export function buildProcessingEvidencePath(
  cameraId: string,
  range: ProcessingEvidenceRange,
): string {
  return `/v1/cameras/${cameraId}/processing/evidence?range=${range}`;
}

export async function getProcessingEvidence(opts: {
  accountId: string;
  cameraId: string;
  range?: ProcessingEvidenceRange;
}): Promise<ProcessingEvidenceResponse | null> {
  const range: ProcessingEvidenceRange = opts.range ?? "24h";
  try {
    return await serverFetch<ProcessingEvidenceResponse>(
      `/v1/cameras/${opts.cameraId}/processing/evidence`,
      { accountId: opts.accountId, query: { range } },
    );
  } catch (err) {
    reportError(err, { area: "processing-evidence" });
    return null;
  }
}
