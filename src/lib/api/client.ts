"use client";

import { type SWRConfiguration } from "swr";
import { reportError } from "@/lib/error";
import { UpstreamApiError, type ApiErrorEnvelope } from "./errors";

export const PROXY_BASE = "/api/upstream";

export class ProxyAuthExpired extends Error {
  constructor() {
    super("Session expired");
    this.name = "ProxyAuthExpired";
  }
}

export class ProxyAccountMissing extends Error {
  constructor() {
    super("Account context missing or invalid");
    this.name = "ProxyAccountMissing";
  }
}

const ACCOUNT_MISSING_CODES = new Set([
  "account_id_required",
  "forbidden_account",
]);

/**
 * Browser-side fetcher. Goes through the `/api/upstream` Next route handler
 * so the Supabase access token never leaves the server.
 *
 * On 401 from the proxy, throws ProxyAuthExpired. Callers wrap with SWR's
 * `onError` which redirects to /login.
 */
export async function proxyFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = path.startsWith("/")
    ? `${PROXY_BASE}${path}`
    : `${PROXY_BASE}/${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
    credentials: "same-origin",
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (res.status === 401) {
    const code = (parsed as ApiErrorEnvelope | null)?.error?.code ?? "";
    if (ACCOUNT_MISSING_CODES.has(code)) {
      throw new ProxyAccountMissing();
    }
    throw new ProxyAuthExpired();
  }
  if (!res.ok) {
    const envelope =
      (parsed as ApiErrorEnvelope | null) ??
      ({
        error: {
          code: "internal_error",
          message: res.statusText || "Request failed.",
        },
      } satisfies ApiErrorEnvelope);
    throw new UpstreamApiError(res.status, envelope);
  }
  return parsed as T;
}

/**
 * Default SWR options for the dashboard. Visibility-aware polling, no
 * refetch on hidden tabs, conservative dedupe.
 */
export const defaultSwrConfig: SWRConfiguration = {
  refreshWhenHidden: false,
  refreshWhenOffline: false,
  revalidateOnFocus: true,
  dedupingInterval: 3000,
  keepPreviousData: true,
  shouldRetryOnError: (err) =>
    !(err instanceof ProxyAuthExpired) && !(err instanceof ProxyAccountMissing),
  onError: (err) => {
    if (err instanceof ProxyAccountMissing) {
      window.location.href = "/select-account";
      return;
    }
    if (err instanceof ProxyAuthExpired) {
      const next = window.location.pathname + window.location.search;
      window.location.href = `/login?next=${encodeURIComponent(next)}`;
      return;
    }
    reportError(err, { area: "swr" });
  },
};

export function handleProxyError(err: unknown): never {
  if (err instanceof ProxyAccountMissing) {
    window.location.href = "/select-account";
  } else if (err instanceof ProxyAuthExpired) {
    const next = window.location.pathname + window.location.search;
    window.location.href = `/login?next=${encodeURIComponent(next)}`;
  }
  throw err;
}
