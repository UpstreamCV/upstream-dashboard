import { KeyRound } from "lucide-react";
import { EmptyState } from "@/components/data/empty-state";
import { PageHeader } from "@/components/data/page-header";
import { RelativeTime } from "@/components/data/relative-time";
import { StatusBadge } from "@/components/data/status-badge";
import { TokenCreateDialog } from "@/components/tokens/token-create-dialog";
import { TokenRowActions } from "@/components/tokens/token-row-actions";
import { getActiveAccount } from "@/lib/account/active";
import { listTokens } from "@/lib/api/api-tokens";
import type { ApiToken } from "@/lib/api/types";

function tokenStatus(t: ApiToken): string {
  if (t.revoked_at) return "revoked";
  if (t.expires_at && new Date(t.expires_at).getTime() < Date.now())
    return "expired";
  return "active";
}

export default async function ApiTokensPage() {
  const { activeAccountId, activeAccount } = await getActiveAccount();
  const isAdmin =
    activeAccount.role === "owner" || activeAccount.role === "admin";
  const tokens = await listTokens(activeAccountId);

  return (
    <section>
      <PageHeader
        eyebrow="settings"
        title="API"
        accent="tokens"
        description="Long-lived credentials your upstream-agent installs use to register and stream. Plaintext is shown once at creation."
        actions={
          <TokenCreateDialog
            disabled={!isAdmin}
            disabledReason={
              isAdmin ? undefined : "Only owners or admins can generate tokens."
            }
          />
        }
      />
      {tokens.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No tokens yet"
          description={
            isAdmin
              ? "Generate your first token to install upstream-agent on a device."
              : "Ask an owner or admin to generate an API token for you."
          }
        />
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-mute mono text-[11px] uppercase tracking-wider border-b border-glass-stroke-2">
                  <th className="px-4 py-3 font-normal">Name</th>
                  <th className="px-4 py-3 font-normal">Prefix</th>
                  <th className="px-4 py-3 font-normal">Status</th>
                  <th className="px-4 py-3 font-normal">Created</th>
                  <th className="px-4 py-3 font-normal">Last used</th>
                  <th className="px-4 py-3 font-normal">Expires</th>
                  <th className="px-4 py-3 font-normal text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => {
                  const status = tokenStatus(t);
                  return (
                    <tr
                      key={t.id}
                      className="border-b border-glass-stroke-2/60 last:border-0"
                    >
                      <td className="px-4 py-3 text-ink align-middle">
                        {t.name}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span className="mono text-[12px] text-ink-soft">
                          {t.prefix}
                        </span>
                        <span className="mono text-[11px] text-ink-mute ml-1.5">
                          …{t.last_four}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-4 py-3 align-middle text-ink-soft">
                        <RelativeTime value={t.created_at} />
                      </td>
                      <td className="px-4 py-3 align-middle text-ink-soft">
                        <RelativeTime value={t.last_used_at} />
                      </td>
                      <td className="px-4 py-3 align-middle text-ink-soft">
                        {t.expires_at ? (
                          <RelativeTime value={t.expires_at} />
                        ) : (
                          <span className="text-ink-mute">never</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {isAdmin && status === "active" ? (
                          <TokenRowActions
                            tokenId={t.id}
                            tokenName={t.name}
                          />
                        ) : (
                          <div className="flex justify-end">
                            <span className="text-[11px] text-ink-mute mono">
                              —
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
