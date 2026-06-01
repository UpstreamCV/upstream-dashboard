import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listMemberships, type Membership } from "./memberships";

export const ACTIVE_ACCOUNT_COOKIE = "upstream_active_account";

export async function getActiveAccountIdFromCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_ACCOUNT_COOKIE)?.value ?? null;
}

export async function clearActiveAccountCookie(): Promise<void> {
  try {
    const store = await cookies();
    store.delete(ACTIVE_ACCOUNT_COOKIE);
  } catch {
    // Server Components can't mutate cookies; that's fine — the next
    // request through proxy.ts (or any Server Action / Route Handler)
    // will detect the stale cookie again and re-route the user.
  }
}

export type ActiveAccountContext = {
  user: User;
  memberships: Membership[];
  activeAccountId: string;
  activeAccount: Membership;
};

/**
 * Resolves the signed-in user, their memberships, and the currently active
 * account. Redirects on its own when something is missing:
 *  - no Supabase session     → /login
 *  - zero memberships        → /select-account (renders an empty/help state)
 *  - >1 memberships, no pin  → /select-account
 *  - cookie points at an account the user no longer belongs to → cookie cleared,
 *                                                                /select-account
 *
 * Wrapped in React `cache()` so the per-render fan-out — the `(app)` layout, the
 * `[cameraId]` layout, and the page all call this — resolves to a single
 * `getUser()` (a network round-trip to Supabase Auth) + one membership read per
 * request, instead of 2–3. `listMemberships` is already `cache()`-wrapped; this
 * extends the dedupe to the auth call and the cookie resolution.
 */
export const getActiveAccount = cache(
  async (): Promise<ActiveAccountContext> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const memberships = await listMemberships();
  const cookieValue = await getActiveAccountIdFromCookie();

  let active: Membership | undefined;
  if (cookieValue) {
    active = memberships.find((m) => m.accountId === cookieValue);
    if (!active) {
      // Cookie drifted; let the chooser sort it.
      await clearActiveAccountCookie();
    }
  }
  if (!active && memberships.length === 1) {
    active = memberships[0];
  }
  if (!active) {
    redirect("/select-account");
  }

  return {
    user,
    memberships,
    activeAccountId: active.accountId,
    activeAccount: active,
  };
  },
);
