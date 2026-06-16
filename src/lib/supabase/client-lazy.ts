"use client";

import { env } from "@/lib/env";

// Lazily-loaded browser Supabase client for the active / segment.
//
// The full @supabase SDK (~511KB raw — Realtime + GoTrue + storage) is pulled
// in via a dynamic `import()` so Turbopack splits it into its own async chunk
// instead of baking it into every camera route's critical initial JS. The SDK
// is only needed for the background Realtime subscriptions (session-state push
// + the live perception overlay), never for first paint — the video, the
// SWR-polled overlay, and every other tab render without it. Deferring the load
// shrinks the camera-route initial bundle and lets the page hydrate sooner.
//
// Mirrors the eager sync `createSupabaseBrowserClient()` in ./client (still used
// by the /dashboard-legacy fallback, which is left as-is): same client, same
// setAuth-on-create + on-auth-change token mirroring so postgres_changes
// subscriptions evaluate RLS as the signed-in user (otherwise the socket is
// anon and member-scoped rows are filtered out — "connected but silent").
//
// Memoized to a single in-flight promise → one client / one Realtime socket per
// tab, shared by both consumers (the layout listener + the overlay).
async function loadClient() {
  const { createBrowserClient } = await import("@supabase/ssr");
  const client = createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  // Authenticate the Realtime socket so RLS evaluates with the signed-in user.
  void client.auth.getSession().then(({ data }) => {
    client.realtime.setAuth(data.session?.access_token ?? null);
  });
  client.auth.onAuthStateChange((_event, session) => {
    client.realtime.setAuth(session?.access_token ?? null);
  });
  return client;
}

let clientPromise: ReturnType<typeof loadClient> | null = null;

export function getSupabaseBrowserClient(): ReturnType<typeof loadClient> {
  clientPromise ??= loadClient();
  return clientPromise;
}
