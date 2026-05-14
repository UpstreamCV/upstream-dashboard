"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

// Currently unused. All auth happens via Server Actions (sign-in / sign-up /
// sign-out), and resource reads route through /api/upstream. Kept for future
// browser-only auth flows (password reset confirm, magic-link landing) that
// must run before any server roundtrip can refresh the cookie.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
