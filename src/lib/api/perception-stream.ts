"use client";

// Client-safe token fetch for the perception-fanout WS hot path. Kept out of
// `src/lib/api/perception.ts` deliberately — that module opens with
// `import "server-only"` and this one must run in the browser (the WS client
// re-mints the token on every reconnect). Goes through the `/api/upstream`
// proxy like every other client read, so the Supabase JWT never reaches the
// browser; the sidecar's `ws_url` arrives in the response body, so no
// NEXT_PUBLIC_* env is needed either.
//
// The returned token is a short-lived credential: hand it straight to
// `connectPerceptionStream` and never log, persist, or place it in app state.

import { proxyFetch } from "./client";
import type { PerceptionStreamTokenResponse } from "./types";

export function buildPerceptionStreamTokenPath(cameraId: string): string {
  return `/v1/cameras/${cameraId}/perception/stream-token`;
}

export async function fetchPerceptionStreamToken(
  cameraId: string,
): Promise<PerceptionStreamTokenResponse> {
  return proxyFetch<PerceptionStreamTokenResponse>(
    buildPerceptionStreamTokenPath(cameraId),
    { method: "POST" },
  );
}
