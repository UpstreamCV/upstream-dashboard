"use client";

import useSWR, { type SWRResponse } from "swr";
import { defaultSwrConfig, proxyFetch } from "./client";

export function useUpstreamList<T>(
  path: string | null,
  options?: { refreshInterval?: number; fallbackData?: T },
): SWRResponse<T> {
  return useSWR<T>(path, proxyFetch, {
    ...defaultSwrConfig,
    refreshInterval: options?.refreshInterval ?? 10_000,
    fallbackData: options?.fallbackData,
  });
}
