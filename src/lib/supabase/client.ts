"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

// One memoized browser client per tab, used for Supabase Realtime (resource
// reads still route through /api/upstream).
//
// Why the singleton + setAuth matters: a postgres_changes subscription only
// delivers rows the *authenticated socket* can SELECT. The browser Realtime
// socket otherwise connects with just the anon key, so for member-scoped tables
// (e.g. latest_perception_snapshots, whose RLS keys off auth.uid()) the channel
// reports SUBSCRIBED yet every row broadcast is filtered out — "connected but
// silent". We mirror the cookie session's access token onto the Realtime
// connection: once eagerly on creation, and again on every auth-state change so
// it stays fresh across token refreshes. Memoizing to a single client means the
// socket is authenticated shortly after page load (the first consumer mounts in
// the layout), well before any user-initiated subscribe.
function makeBrowserClient() {
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

let browserClient: ReturnType<typeof makeBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  browserClient ??= makeBrowserClient();
  return browserClient;
}
