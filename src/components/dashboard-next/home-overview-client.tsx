"use client";

import { Tile } from "./tile";
import { UsageMeter } from "./usage-meter";
import { agentState } from "./agent-card";
import { TOKEN_EXPIRING_WINDOW_MS, tokenStatus } from "./tokens-table";
import type { DotStatus } from "./status-dot";
import { KpiTile } from "./home/kpi-tile";
import { TriagePanel } from "./home/triage-panel";
import { FleetOverview } from "./home/fleet-overview";
import { RecentEvents } from "./home/recent-events";
import { SystemStatus } from "./home/system-status";
import { useUpstreamList } from "@/lib/api/use-list";
import { isDemoMode } from "@/lib/demo/demo-mode";
import type {
  AccountLimits,
  AccountSummary,
  Agent,
  AgentListResponse,
  Alert,
  AlertListResponse,
  ApiToken,
  ApiTokenListResponse,
  DashboardSummary,
} from "@/lib/api/types";

// Client wrapper for the Home redesign (Figma frames "Some Issues" 390:341 +
// "All Good" 409:196). The server page provides every datum as fallbackData so
// first paint is instant; SWR then polls each endpoint every 10s. Mirrors the
// old / OverviewCards client polling pattern.
//
// We poll the five endpoints that actually move: dashboard summary, agents
// (fresh heartbeats), api-tokens (status flips on revoke/expiry),
// account-limits (keeps caps current after plan upgrades), and alerts (the
// triage/recent-events feeds — near-real-time but polled, not frame-rate). The
// account row itself is static — passed through from the server.
//
// The "More" section below the divider keeps the original Home tiles that the
// redesign doesn't surface (Plan & Usage, Concurrent Streams, API Tokens,
// Network, Billing) so nothing regresses. Network and Billing remain
// illustrative — there is no aggregate-latency endpoint and no billing
// service. See the page comment for the full WIRE-UP map.

export function HomeOverviewClient({
  account,
  initialSummary,
  initialAgents,
  initialTokens,
  initialLimits,
  initialAlerts,
  streamMinutesUsed,
}: {
  account: AccountSummary;
  initialSummary: DashboardSummary;
  initialAgents: Agent[];
  initialTokens: ApiToken[];
  initialLimits: AccountLimits;
  initialAlerts: Alert[];
  // Completed stream minutes this period (null while the endpoint is
  // unavailable; renders as an unknown meter, never a fake 0).
  streamMinutesUsed: number | null;
}) {
  const demo = isDemoMode();

  const summary =
    useUpstreamList<DashboardSummary>("/v1/dashboard/summary", {
      fallbackData: initialSummary,
    }).data ?? initialSummary;

  const agents =
    useUpstreamList<AgentListResponse>("/v1/agents", {
      fallbackData: { agents: initialAgents },
    }).data?.agents ?? initialAgents;

  const tokens =
    useUpstreamList<ApiTokenListResponse>("/v1/api-tokens", {
      fallbackData: { tokens: initialTokens },
    }).data?.tokens ?? initialTokens;

  const limits =
    useUpstreamList<AccountLimits>("/v1/account/limits", {
      fallbackData: initialLimits,
    }).data ?? initialLimits;

  // Alerts feed the triage list, the recent-events list, and the Alerts KPI.
  // initialAlerts/the poll may be undefined if the alerts endpoint is
  // unavailable (or, in demo mode, unrouted) — normalize to an array so the
  // derivations below never crash.
  const seedAlerts = initialAlerts ?? [];
  const alerts =
    useUpstreamList<AlertListResponse>("/v1/alerts", {
      fallbackData: { alerts: seedAlerts },
      refreshInterval: 10_000,
    }).data?.alerts ?? seedAlerts;

  // --- KPI 1: Active Cameras → online/total plus offline + errors note. ----
  const camsTotal = summary.total_cameras;
  const camsOnline = summary.online_cameras;
  const camsOffline = summary.offline_cameras;
  const camsErrors = summary.cameras_with_errors;
  const camStatus: DotStatus =
    camsErrors > 0
      ? "red"
      : camsOffline > 0
        ? "yellow"
        : camsTotal > 0
          ? "green"
          : "neutral";
  const camsHealthy = camsErrors === 0 && camsOffline === 0;

  // --- KPI 2: Active Agents → fresh-heartbeat count (matches agentState()). -
  const agentsTotal = agents.length;
  const agentsOnline = agents.filter((a) => agentState(a) === "online").length;
  const agentsMissing = agentsTotal - agentsOnline;
  const agentStatus: DotStatus =
    agentsTotal === 0
      ? "neutral"
      : agentsMissing === 0
        ? "green"
        : agentsMissing < agentsTotal
          ? "orange"
          : "red";

  // --- KPI 3: Alerts → UNREAD count (read_at == null) across polled alerts. -
  const unreadAlerts = alerts.filter((a) => a.read_at == null).length;
  const alertsStatus: DotStatus = unreadAlerts > 0 ? "red" : "neutral";

  // --- KPI 4: Needs Review → cameras_with_errors + validation_errors_24h. ---
  const needsReview = camsErrors + summary.validation_errors_24h;
  const needsReviewStatus: DotStatus = needsReview > 0 ? "orange" : "green";

  // --- Triage / Recent Events feeds (derived from the alerts poll). --------
  // Triage shows only the most recent handful of open alerts (newest first;
  // the panel's "View all" links to the full inbox) — keeps the home card to
  // ~8 rows rather than an unbounded list.
  const openAlerts = alerts
    .filter((a) => a.status === "open")
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 8);
  const recentAlerts = [...alerts]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 5);

  // --- Preserved "More" tiles (carried over from the original Home). -------
  // Concurrent Streams → active vs plan cap.
  const concurrent = summary.active_streams;
  const concurrentMax = limits.max_concurrent_sessions;
  const concurrentFree = Math.max(0, concurrentMax - concurrent);
  const concurrentStatus: DotStatus =
    concurrent >= concurrentMax
      ? "red"
      : concurrent >= concurrentMax * 0.8
        ? "yellow"
        : "green";

  // API tokens → active count + expiring soon.
  const tokensActive = tokens.filter(
    (t) => tokenStatus(t) === "active" || tokenStatus(t) === "expiring",
  ).length;
  const tokensExpiring = tokens.filter(
    (t) => tokenStatus(t) === "expiring",
  ).length;
  const tokenStatusDot: DotStatus =
    tokensExpiring > 0 ? "yellow" : tokensActive > 0 ? "green" : "neutral";

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {/* (1) KPI ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
        <KpiTile
          title="Active Cameras"
          status={camStatus}
          metric={String(camsOnline)}
          metricSuffix={`/${camsTotal}`}
          subtitle={
            camsTotal === 0
              ? "No cameras registered yet"
              : camsHealthy
                ? "All cameras are active"
                : `${camsOffline} offline · ${camsErrors} with errors`
          }
          actionLabel="View Cameras"
          actionHref="/cameras"
        />
        <KpiTile
          title="Active Agents"
          status={agentStatus}
          metric={String(agentsOnline)}
          metricSuffix={`/${agentsTotal}`}
          subtitle={
            agentsTotal === 0
              ? "No agents registered yet"
              : agentsMissing === 0
                ? "All agents healthy"
                : `${agentsMissing} offline`
          }
          actionLabel="View Agents"
          actionHref="/agents"
        />
        <KpiTile
          title="Alerts"
          status={alertsStatus}
          metric={String(unreadAlerts)}
          subtitle="Unread notifications"
          actionLabel="View Alerts"
          actionHref="/alerts"
        />
        <KpiTile
          title="Needs Review"
          status={needsReviewStatus}
          metric={String(needsReview)}
          subtitle="Items require attention"
          actionLabel="View Triage"
          actionHref="/alerts"
        />
      </div>

      {/* (2) MIDDLE ROW — Triage + Fleet Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        <TriagePanel openAlerts={openAlerts} />
        <FleetOverview
          critical={camsErrors}
          review={needsReview}
          healthy={camsOnline}
        />
      </div>

      {/* (3) BOTTOM ROW — Recent Events + System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        <RecentEvents alerts={recentAlerts} />
        <SystemStatus />
      </div>

      {/* (4) MORE — preserved original tiles (now dark via flipped tokens). */}
      <div className="mt-2 flex items-center gap-3">
        <span className="text-[clamp(0.72rem,0.9vw,0.85rem)] font-bold uppercase tracking-wide text-[var(--dn-text-40)]">
          More
        </span>
        <span className="h-px flex-1 bg-[var(--dn-text-15)]" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
        <Tile
          title="Plan & Usage"
          span={2}
          actionLabel="View Billing"
          actionHref="/billing"
        >
          <div className="flex flex-col gap-5">
            <div className="flex items-baseline gap-3">
              <span className="text-[clamp(1.75rem,4.5vw,2.75rem)] font-bold leading-none capitalize">
                {account.plan || "Free"}
              </span>
              <span className="text-[clamp(0.85rem,1.1vw,1.1rem)] text-[var(--dn-text-50)]">
                plan
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
              <UsageMeter
                label="Cameras"
                value={camsTotal}
                max={limits.max_cameras}
              />
              <UsageMeter
                label="Concurrent"
                value={concurrent}
                max={limits.max_concurrent_sessions}
              />
              {/* Completed stream minutes this period, from
                  /v1/usage/summary (Module 7 M1). Active sessions count once
                  they end. */}
              <UsageMeter
                label="Minutes"
                value={demo ? 12_480 : streamMinutesUsed}
                max={limits.monthly_minutes_quota}
              />
            </div>
          </div>
        </Tile>
        <Tile
          title="Concurrent Streams"
          status={concurrentStatus}
          metric={String(concurrent)}
          metricSuffix={`/${concurrentMax}`}
          subtitle={
            concurrentMax === 0
              ? "No concurrent-session cap on this plan"
              : concurrentFree === 0
                ? "No slots free — cap reached"
                : `${concurrentFree} slot${concurrentFree === 1 ? "" : "s"} free on your plan`
          }
          actionLabel="View Sessions"
          actionHref="/stream-sessions"
        />
        <Tile
          title="API Tokens"
          status={tokenStatusDot}
          metric={String(tokensActive)}
          subtitle={
            tokensExpiring > 0
              ? `${tokensExpiring} expiring in ${TOKEN_EXPIRING_WINDOW_MS / (24 * 60 * 60 * 1000)} days`
              : tokensActive > 0
                ? "All keys healthy"
                : "No active keys"
          }
          actionLabel="Manage Tokens"
          actionHref="/api-tokens"
        />
        {/* Network tile is ILLUSTRATIVE — there is no aggregate latency endpoint
            in upstream-api-server today. Per-device heartbeats exist but a fleet
            aggregate would require either a new endpoint or a client fan-out.
            Kept here to preserve the original layout. */}
        <Tile
          title="Network"
          metric="—"
          metricSuffix="ms"
          actionLabel="View Network"
          subtitle="Aggregate latency endpoint coming soon"
        />
        {/* Billing tile is INTENTIONALLY MOCK — there is no billing/metering
            service in upstream-api-server. The figures are illustrative; kept
            for the original layout. */}
        <Tile
          title="Billing"
          metric="$—"
          actionLabel="View Billing"
          actionHref="/billing"
          subtitle="Billing service not yet wired"
        />
      </div>
    </div>
  );
}
