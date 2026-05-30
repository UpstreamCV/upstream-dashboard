import { Search } from "lucide-react";
import { StatCard } from "@/components/dashboard-next/stat-card";
import {
  TokensTable,
  tokenStatus,
} from "@/components/dashboard-next/tokens-table";
import { TokenCreateDialogNext } from "@/components/dashboard-next/token-create-dialog-next";
import { TokenRowActionsNext } from "@/components/dashboard-next/token-row-actions-next";
import { getActiveAccount } from "@/lib/account/active";
import { listTokens } from "@/lib/api/api-tokens";

// dashboard-next API Keys. Mirrors src/app/dashboard/settings/api-tokens/page.tsx:
// server-fetches the list and the caller's role, renders the table, gates the
// "New Key" dialog on owner/admin, and lets active rows be revoked inline.
//
// No client polling here — token state changes are infrequent (create / revoke)
// and the Server Action's revalidatePath() refreshes the list immediately after
// either mutation. Matches the live dashboard's behavior.
//
// The plaintext secret is created by createTokenAction and surfaced in the
// dialog's local state. It never lives on this page, on the table row, in
// the router cache, or in any log.
export default async function ApiTokensPage() {
  const { activeAccountId, activeAccount } = await getActiveAccount();
  const tokens = await listTokens(activeAccountId);
  const canManage =
    activeAccount.role === "owner" || activeAccount.role === "admin";

  const total = tokens.length;
  const active = tokens.filter((t) => tokenStatus(t) === "active").length;
  const expiring = tokens.filter((t) => tokenStatus(t) === "expiring").length;
  const revoked = tokens.filter((t) => tokenStatus(t) === "revoked").length;

  return (
    <section className="space-y-5 md:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[clamp(0.62rem,0.8vw,0.78rem)] font-bold uppercase tracking-wide text-[var(--dn-text-50)]">
            settings
          </p>
          <h1 className="font-bold text-white text-[clamp(1.6rem,3.2vw,2.4rem)]">
            API Keys <span className="text-white/55">· {total}</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Presentational — filtering isn't wired. WIRE-UP: lift to client
              state to filter by name/prefix/scope/status. */}
          <div className="dn-glow-soft relative rounded-full sm:w-[clamp(160px,18vw,240px)]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 h-4 w-4 text-white/75"
              aria-hidden
            />
            <input
              type="search"
              aria-label="Search keys"
              placeholder="Search keys…"
              className="dn-field relative z-[1] w-full py-2 pl-9 pr-4 text-[clamp(0.85rem,1vw,1rem)]"
            />
          </div>
          <TokenCreateDialogNext
            disabled={!canManage}
            disabledReason={
              canManage
                ? undefined
                : "Only owners and admins can generate tokens."
            }
          />
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Total" value={total} />
        <StatCard label="Active" value={active} status="green" />
        <StatCard
          label="Expiring"
          value={expiring}
          status={expiring > 0 ? "yellow" : "neutral"}
        />
        <StatCard
          label="Revoked"
          value={revoked}
          status={revoked > 0 ? "red" : "neutral"}
        />
      </div>

      {tokens.length === 0 ? (
        <div className="dn-tile p-[clamp(1.5rem,3vw,2.5rem)] text-center">
          <p className="font-bold text-[clamp(1rem,1.4vw,1.3rem)]">
            No API tokens yet
          </p>
          <p className="mt-2 text-[var(--dn-text-50)] text-[clamp(0.85rem,1vw,1rem)]">
            {canManage
              ? "Click “New Key” to generate one — plaintext is shown once."
              : "Ask an owner or admin to generate one for this account."}
          </p>
        </div>
      ) : (
        <TokensTable
          tokens={tokens}
          renderRowActions={
            canManage
              ? (t) => {
                  // Only offer revoke for tokens that aren't already revoked
                  // — keeps the dead rows uncluttered.
                  if (t.revoked_at) return null;
                  return (
                    <TokenRowActionsNext tokenId={t.id} tokenName={t.name} />
                  );
                }
              : undefined
          }
        />
      )}
    </section>
  );
}
