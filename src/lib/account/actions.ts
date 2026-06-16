"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_ACCOUNT_COOKIE } from "./active";
import { listMemberships } from "./memberships";

export async function setActiveAccountAction(formData: FormData): Promise<void> {
  const accountId = String(formData.get("account_id") ?? "");
  if (!accountId) {
    return;
  }

  // Defense-in-depth: never trust the form value blindly. The api-server will
  // also reject account_id values the user isn't a member of, but failing here
  // gives a cleaner redirect and avoids planting a bad cookie.
  const memberships = await listMemberships();
  if (!memberships.some((m) => m.accountId === accountId)) {
    return;
  }

  const store = await cookies();
  store.set({
    name: ACTIVE_ACCOUNT_COOKIE,
    value: accountId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  redirect("/");
}
