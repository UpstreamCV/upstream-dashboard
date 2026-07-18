import { HomeOverviewClient } from "@/components/dashboard-next/home-overview-client";
import { getActiveAccount } from "@/lib/account/active";
import { listAgents } from "@/lib/api/agents";
import { listAlerts } from "@/lib/api/alerts";
import { listCameras } from "@/lib/api/cameras";
import { listTokens } from "@/lib/api/api-tokens";
import { getAccount, getAccountLimits } from "@/lib/api/accounts";
import { getUsageSummary } from "@/lib/api/usage";
import { getDashboardSummary, getFleetTrend } from "@/lib/api/dashboard";

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
//   Network       — illustrative; no aggregate-latency endpoint exists in
//                   upstream-api-server today (only per-device heartbeats).
//   Billing       — intentional mock; no billing/metering service.
//
// The Fleet chart used to be listed here, and was the one surface that broke
// the rule above: it drew a fabricated sine wave rather than an honest
// placeholder. It is now backed by GET /v1/dashboard/fleet-trend (2026-07-16).
//
// See HomeOverviewClient for the per-tile derivation logic.
export default async function DashboardNextHome() {
  const { activeAccountId } = await getActiveAccount();

  const [
    summary,
    agents,
    tokens,
    account,
    limits,
    usage,
    alerts,
    cameras,
    fleetTrend,
  ] = await Promise.all([
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
      // Cameras resolve the triage rows' name + location (alerts only carry a
      // camera_id). Tolerate an unavailable endpoint — the client re-polls.
      listCameras({ accountId: activeAccountId, limit: 200 }).catch(() => []),
      // Fleet health for the chart + its legend. The wrapper already degrades
      // every error to null (the tile renders an unavailable state).
      getFleetTrend({ accountId: activeAccountId }),
    ]);

  return (
    <HomeOverviewClient
      account={account}
      initialSummary={summary}
      initialAgents={agents}
      initialTokens={tokens}
      initialLimits={limits}
      initialAlerts={alerts}
      initialCameras={cameras}
      streamMinutesUsed={usage?.usage.stream_minutes ?? null}
      fleetTrend={fleetTrend}
    />
  );
}
