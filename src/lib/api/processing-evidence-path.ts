import type { ProcessingEvidenceRange } from "./types";

// Client-safe path helper for the processing-evidence endpoint. Kept OUT of
// processing-evidence.ts (which is `server-only`: it imports serverFetch →
// next/headers) so the client RuntimeEvidencePanel can import it without
// pulling server-only code into the browser bundle.

/** SWR/proxy key for the client poller — must match the server fetch's target. */
export function buildProcessingEvidencePath(
  cameraId: string,
  range: ProcessingEvidenceRange,
): string {
  return `/v1/cameras/${cameraId}/processing/evidence?range=${range}`;
}
