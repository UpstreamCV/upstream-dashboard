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
    // Per-hook SWR equality override. SWR calls compare(current, incoming)
    // and KEEPS the current data when it returns true — consumers with
    // multiple cache writers (e.g. the perception overlay's WS + Realtime +
    // poll) use this to refuse out-of-order/stale fetch results.
    compare?: (a: T | undefined, b: T | undefined) => boolean;
    // Per-hook overrides of the shared revalidation defaults
    // (revalidateOnFocus is on in defaultSwrConfig; revalidateOnReconnect is
    // on via SWR's own default). Set both false together with
    // refreshInterval: 0 for a fetch-once-on-mount consumer that should NOT
    // re-fetch on tab focus or network reconnect (e.g. a card thumbnail).
    revalidateOnFocus?: boolean;
    revalidateOnReconnect?: boolean;
  },
): SWRResponse<T> {
  return useSWR<T>(path, proxyFetch, {
    ...defaultSwrConfig,
    refreshInterval: options?.refreshInterval ?? 10_000,
    fallbackData: options?.fallbackData,
    ...(options?.dedupingInterval !== undefined
      ? { dedupingInterval: options.dedupingInterval }
      : {}),
    ...(options?.compare !== undefined ? { compare: options.compare } : {}),
    ...(options?.revalidateOnFocus !== undefined
      ? { revalidateOnFocus: options.revalidateOnFocus }
      : {}),
    ...(options?.revalidateOnReconnect !== undefined
      ? { revalidateOnReconnect: options.revalidateOnReconnect }
      : {}),
  });
}
