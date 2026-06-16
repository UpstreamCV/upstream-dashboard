import { HomeOverviewClient } from "@/components/dashboard-next/home-overview-client";
import { getActiveAccount } from "@/lib/account/active";
import { listAgents } from "@/lib/api/agents";
import { listAlerts } from "@/lib/api/alerts";
import { listTokens } from "@/lib/api/api-tokens";
import { getAccount, getAccountLimits } from "@/lib/api/accounts";
import { getUsageSummary } from "@/lib/api/usage";
import { getDashboardSummary } from "@/lib/api/dashboard";

// Dashboard-next Home (redesign — Figma "Some Issues" 390:341 + "All Good"
// 409:196). Server-fetches every datum in parallel, then hands it off to a
// client wrapper that polls each endpoint every 10s (matches the pattern of
// the live / OverviewCards). The KPI row, Triage, Fleet Overview, and
// Recent Events are all wired to real data (summary / agents / alerts).
//
// ILLUSTRATIVE surfaces (no backing API — rendered with honest placeholders,
// never fabricated telemetry):
//
//   System Status — no service-health endpoint exists; the four service rows
//                   show a neutral dot + "—" and a "Monitoring coming soon"
//                   note.
//   Fleet chart   — no fleet-health time-series endpoint; the chart area is a
//                   labelled placeholder (a faint decorative bar trio derived
//                   from the three REAL counts, never historical telemetry).
//   Network       — illustrative; no aggregate-latency endpoint exists in
//                   upstream-api-server today (only per-device heartbeats).
//   Billing       — intentional mock; no billing/metering service.
//
// See HomeOverviewClient for the per-tile derivation logic.
export default async function DashboardNextHome() {
  const { activeAccountId } = await getActiveAccount();

  const [summary, agents, tokens, account, limits, usage, alerts] =
    await Promise.all([
      getDashboardSummary({ accountId: activeAccountId }),
      listAgents({ accountId: activeAccountId }),
      listTokens(activeAccountId),
      getAccount({ accountId: activeAccountId }),
      getAccountLimits({ accountId: activeAccountId }),
      // Home stays up even if the usage endpoint is unavailable mid-deploy.
      getUsageSummary({ accountId: activeAccountId }).catch(() => null),
      // Alerts seed the triage + recent-events feeds; tolerate the endpoint
      // being unavailable (the client polls and recovers on the next tick).
      listAlerts({ accountId: activeAccountId, limit: 100 }).catch(() => []),
    ]);

  return (
    <HomeOverviewClient
      account={account}
      initialSummary={summary}
      initialAgents={agents}
      initialTokens={tokens}
      initialLimits={limits}
      initialAlerts={alerts}
      streamMinutesUsed={usage?.usage.stream_minutes ?? null}
    />
  );
}
