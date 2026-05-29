"use client";

import useSWR, { type SWRResponse } from "swr";
import { defaultSwrConfig, proxyFetch } from "./client";

export function useUpstreamList<T>(
  path: string | null,
  options?: {
    refreshInterval?: number;
    fallbackData?: T;
    // Per-hook override of the shared 3s dedupe window. High-rate consumers
    // (e.g. the live perception overlay polling at ~2 Hz) must opt down so
    // their polls aren't coalesced away; everything else keeps the default.
    dedupingInterval?: number;
  },
): SWRResponse<T> {
  return useSWR<T>(path, proxyFetch, {
    ...defaultSwrConfig,
    refreshInterval: options?.refreshInterval ?? 10_000,
    fallbackData: options?.fallbackData,
    ...(options?.dedupingInterval !== undefined
      ? { dedupingInterval: options.dedupingInterval }
      : {}),
  });
}
