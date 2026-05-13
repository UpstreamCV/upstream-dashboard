import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACTIVE_ACCOUNT_COOKIE } from "@/lib/account/active";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  // Clear the active-account pin so the next user on this browser doesn't
  // inherit it (RLS would catch it, but a transient mis-scoped flash is ugly).
  const store = await cookies();
  store.delete(ACTIVE_ACCOUNT_COOKIE);
  return NextResponse.json({ ok: true });
}
