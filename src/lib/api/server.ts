import "server-only";

import { cache } from "react";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UpstreamApiError, type ApiErrorEnvelope } from "./errors";

// React.cache memoizes within a single RSC render / Server Action invocation,
// so multiple serverFetch calls in one request validate the user once.
// getUser() contacts the Supabase Auth server to verify the JWT (cheap but
// not free) — we want that check, but not on every parallel resource fetch.
const validatedSession = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
});

/**
 * Server-side fetcher for RSC and Route Handlers. Calls upstream-api directly
 * with the Supabase access token from the current request's cookie session.
 *
 * Always pass `accountId` explicitly — callers usually have it from
 * `getActiveAccount()` and shouldn't trust ambient state.
 */
export async function serverFetch<T>(
  path: string,
  opts: {
    accountId: string;
    query?: Record<string, string | number | undefined>;
    method?: string;
    body?: unknown;
  },
): Promise<T> {
  const accessToken = await validatedSession();
  if (!accessToken) {
    throw new UpstreamApiError(401, {
      error: { code: "invalid_user_token", message: "No active session." },
    });
  }

  const url = new URL(
    path.startsWith("/") ? path : `/${path}`,
    env.NEXT_PUBLIC_UPSTREAM_API_URL,
  );
  url.searchParams.set("account_id", opts.accountId);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
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

  if (!res.ok) {
    const envelope =
      (parsed as ApiErrorEnvelope | null) ??
      ({
        error: {
          code: "internal_error",
          message: res.statusText || "Upstream request failed.",
        },
      } satisfies ApiErrorEnvelope);
    throw new UpstreamApiError(res.status, envelope);
  }
  return parsed as T;
}
