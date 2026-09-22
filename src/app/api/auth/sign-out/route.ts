import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACTIVE_ACCOUNT_COOKIE } from "@/lib/account/active";
import {
  clearDemoCookies,
  demoCookieOptionsForRequest,
  isDemoMode,
} from "@/lib/demo/demo-mode.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  // Demo session: there is no Supabase session to end — just drop the demo
  // cookies so the rail's Sign out lands on the real /login like Exit demo.
  if (await isDemoMode()) {
    const store = await cookies();
    clearDemoCookies(store, await demoCookieOptionsForRequest());
    return NextResponse.json({ ok: true });
  }
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  // Clear the active-account pin so the next user on this browser doesn't
  // inherit it (RLS would catch it, but a transient mis-scoped flash is ugly).
  const store = await cookies();
  store.delete(ACTIVE_ACCOUNT_COOKIE);
  return NextResponse.json({ ok: true });
}
