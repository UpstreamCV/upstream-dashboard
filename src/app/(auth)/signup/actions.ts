"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignUpState = {
  error?: string;
  confirmationRequired?: boolean;
  email?: string;
};

export async function signUpAction(
  _prev: SignUpState | undefined,
  formData: FormData,
): Promise<SignUpState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");
  const workspaceName = String(formData.get("workspace_name") ?? "").trim();
  const next = String(formData.get("next") ?? "/");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  // Authoritative password "double-check" — the form also validates this live in
  // the browser, but re-check here so a disabled-JS / tampered client can't skip
  // it (defence in depth; never trust the client).
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: workspaceName ? { workspace_name: workspaceName } : {},
    },
  });

  if (error) {
    return { error: error.message };
  }

  // data.session is present when Supabase has email confirmation off. The
  // SSR cookie adapter writes the session cookies inside this Server Action;
  // a same-request redirect carries the user straight into the dashboard.
  if (data.session) {
    redirect(safeNextPath(next));
  }

  // Confirmation on: show the "check your email" success screen.
  return { confirmationRequired: true, email };
}
