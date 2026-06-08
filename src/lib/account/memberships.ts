import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/demo-mode";
import { DEMO_MEMBERSHIP } from "@/lib/demo/fixtures";

export type Membership = {
  accountId: string;
  accountName: string;
  accountSlug: string;
  role: "owner" | "admin" | "viewer";
};

type Row = {
  account_id: string;
  role: Membership["role"];
  accounts: { name: string; slug: string } | null;
};

export const listMemberships = cache(async (): Promise<Membership[]> => {
  if (isDemoMode()) return [DEMO_MEMBERSHIP];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("account_members")
    .select("account_id, role, accounts ( name, slug )")
    .order("account_id", { ascending: true });

  if (error) {
    throw new Error(`Failed to load account memberships: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as Row[];
  return rows
    .filter((r) => r.accounts != null)
    .map((r) => ({
      accountId: r.account_id,
      accountName: r.accounts!.name,
      accountSlug: r.accounts!.slug,
      role: r.role,
    }));
});
