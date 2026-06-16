import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { setActiveAccountAction } from "@/lib/account/actions";
import { listMemberships } from "@/lib/account/memberships";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SelectAccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const memberships = await listMemberships();

  if (memberships.length === 0) {
    return (
      <div className="min-h-dvh grid place-items-center px-6 py-16">
        <div className="w-full max-w-md glass rounded-3xl p-8 text-center">
          <Building2 className="w-7 h-7 mx-auto text-accent" />
          <h1 className="display text-2xl font-semibold mt-3">
            No account <em>yet</em>
          </h1>
          <p className="text-sm text-ink-soft mt-3">
            Your Upstream account hasn&rsquo;t been provisioned. Ask your
            administrator to add you as a member of an account, then sign in
            again.
          </p>
          <form action="/api/auth/sign-out" method="post" className="mt-6">
            <button
              type="submit"
              className="rounded-full bg-glass-bg border border-glass-stroke px-4 py-2 text-sm text-ink hover:bg-white/10 transition"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (memberships.length === 1) {
    // If we got here with exactly one membership, the cookie was missing or
    // stale. Let getActiveAccount handle the auto-set on the next request.
    redirect("/");
  }

  return (
    <div className="min-h-dvh grid place-items-center px-6 py-16">
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.18em] text-accent mono">
            choose
          </p>
          <h1 className="display text-3xl font-semibold mt-2">
            Pick an <em>account</em>
          </h1>
          <p className="text-sm text-ink-soft mt-2">
            You belong to {memberships.length} accounts. Pick one to use for
            this session; you can switch later from the dashboard.
          </p>
        </div>
        <ul className="space-y-3">
          {memberships.map((m) => (
            <li key={m.accountId}>
              <form action={setActiveAccountAction}>
                <input type="hidden" name="account_id" value={m.accountId} />
                <button
                  type="submit"
                  className="w-full glass rounded-2xl px-5 py-4 flex items-center justify-between gap-4 hover:bg-white/10 transition text-left"
                >
                  <div className="min-w-0">
                    <p className="text-base text-ink truncate">
                      {m.accountName}
                    </p>
                    <p className="text-xs text-ink-mute mono mt-0.5 truncate">
                      {m.accountSlug}
                    </p>
                  </div>
                  <span className="text-xs uppercase tracking-wider text-accent mono">
                    {m.role}
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
