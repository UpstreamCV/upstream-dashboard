import { HomeOverviewClient } from "@/components/dashboard-next/home-overview-client";
import { getActiveAccount } from "@/lib/account/active";
import { listAgents } from "@/lib/api/agents";
import { listTokens } from "@/lib/api/api-tokens";
import { getAccount, getAccountLimits } from "@/lib/api/accounts";
import { getDashboardSummary } from "@/lib/api/dashboard";

// Dashboard-next Home. Server-fetches every datum in parallel, then hands it
// off to a client wrapper that polls each endpoint every 10s (matches the
// pattern of the live /dashboard OverviewCards). All tiles are now wired
// EXCEPT:
//
//   Network — illustrative; no aggregate-latency endpoint exists in
//             upstream-api-server today (only per-device heartbeats). Will
//             light up when an aggregate (or client fan-out) lands.
//   Billing — intentional mock; no billing/metering service. Kept for the
//             original Figma layout.
//
// See HomeOverviewClient for the per-tile derivation logic.
export default async function DashboardNextHome() {
  const { activeAccountId } = await getActiveAccount();

  const [summary, agents, tokens, account, limits] = await Promise.all([
    getDashboardSummary({ accountId: activeAccountId }),
    listAgents({ accountId: activeAccountId }),
    listTokens(activeAccountId),
    getAccount({ accountId: activeAccountId }),
    getAccountLimits({ accountId: activeAccountId }),
  ]);

  return (
    <HomeOverviewClient
      account={account}
      initialSummary={summary}
      initialAgents={agents}
      initialTokens={tokens}
      initialLimits={limits}
    />
  );
}
