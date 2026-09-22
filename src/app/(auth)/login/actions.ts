"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/demo-mode.server";

export type LoginState = {
  error?: string;
};

export async function signInAction(
  _prev: LoginState | undefined,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  // Demo mode: accept any credentials and land on the Cameras page (empty at
  // the `adding` start) so the recording opens straight on the connect beat.
  if (await isDemoMode()) {
    redirect("/cameras");
  }

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect(safeNextPath(next));
}
