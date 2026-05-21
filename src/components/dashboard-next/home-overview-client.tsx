"use client";

import { Tile } from "./tile";
import { UsageMeter } from "./usage-meter";
import { agentState } from "./agent-card";
import { TOKEN_EXPIRING_WINDOW_MS, tokenStatus } from "./tokens-table";
import { useUpstreamList } from "@/lib/api/use-list";
import type {
  AccountLimits,
  AccountSummary,
  Agent,
  AgentListResponse,
  ApiToken,
  ApiTokenListResponse,
  DashboardSummary,
} from "@/lib/api/types";

// Client wrapper for the Home tiles. The server page provides every datum as
// fallbackData so first paint is instant; SWR then polls each endpoint every
// 10s. Mirrors the old /dashboard OverviewCards client polling pattern.
//
// We poll the four endpoints that actually move: dashboard summary, agents
// (need fresh heartbeats), api-tokens (status flips on revoke/expiry),
// account-limits (rarely changes but keeps caps current after plan upgrades).
// The account row itself is static — passed through from the server.
//
// Network and Billing tiles remain illustrative — there is no aggregate
// latency endpoint and no billing service. See the page comment for the
// full WIRE-UP map.

export function HomeOverviewClient({
  account,
  initialSummary,
  initialAgents,
  initialTokens,
  initialLimits,
}: {
  account: AccountSummary;
  initialSummary: DashboardSummary;
  initialAgents: Agent[];
  initialTokens: ApiToken[];
  initialLimits: AccountLimits;
}) {
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

  // Cameras Online → reachability (online/total) plus offline + errors note.
  const camsTotal = summary.total_cameras;
  const camsOnline = summary.online_cameras;
  const camsOffline = summary.offline_cameras;
  const camsErrors = summary.cameras_with_errors;
  const camStatus =
    camsErrors > 0
      ? "red"
      : camsOffline > 0
        ? "yellow"
        : camsTotal > 0
          ? "green"
          : "neutral";

  // Agents Online → fresh-heartbeat count (matches agentState()).
  const agentsTotal = agents.length;
  const agentsOnline = agents.filter((a) => agentState(a) === "online").length;
  const agentsMissing = agentsTotal - agentsOnline;
  const agentStatus =
    agentsTotal === 0
      ? "neutral"
      : agentsMissing === 0
        ? "green"
        : agentsMissing < agentsTotal
          ? "yellow"
          : "red";

  // Issues → cameras_with_errors + validation_errors_24h.
  const issueCount = camsErrors + summary.validation_errors_24h;
  const issueStatus = issueCount === 0 ? "green" : issueCount > 1 ? "red" : "yellow";

  // Concurrent Streams → active vs plan cap.
  const concurrent = summary.active_streams;
  const concurrentMax = limits.max_concurrent_sessions;
  const concurrentFree = Math.max(0, concurrentMax - concurrent);
  const concurrentStatus =
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
  const tokenStatusDot =
    tokensExpiring > 0 ? "yellow" : tokensActive > 0 ? "green" : "neutral";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
      <Tile
        title="Cameras Online"
        status={camStatus}
        metric={String(camsOnline)}
        metricSuffix={`/${camsTotal}`}
        subtitle={
          camsTotal === 0
            ? "No cameras registered yet"
            : `${camsOffline} offline · ${camsErrors} with errors`
        }
        actionLabel="View Cameras"
        actionHref="/dashboard-next/cameras"
      />
      <Tile
        title="Agents Online"
        status={agentStatus}
        metric={String(agentsOnline)}
        metricSuffix={`/${agentsTotal}`}
        subtitle={
          agentsTotal === 0
            ? "No agents registered yet"
            : agentsMissing === 0
              ? `Heartbeat fresh on every host`
              : `${agentsMissing} host${agentsMissing === 1 ? "" : "s"} without recent heartbeat`
        }
        actionLabel="View Agents"
        actionHref="/dashboard-next/agents"
      />
      <Tile
        title="Issues"
        status={issueStatus}
        metric={String(issueCount)}
        subtitle={
          issueCount === 0
            ? "All cameras healthy"
            : `${camsErrors} camera error${camsErrors === 1 ? "" : "s"} · ${summary.validation_errors_24h} validation error${summary.validation_errors_24h === 1 ? "" : "s"} (24h)`
        }
        actionLabel="View Cameras"
        actionHref="/dashboard-next/cameras"
      />
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
        actionHref="/dashboard-next/stream-sessions"
      />
      <Tile title="Plan & Usage" span={2} actionLabel="View Billing" actionHref="#">
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
            {/* Minutes used is ILLUSTRATIVE for now — upstream-api-server
                exposes the cap (`monthly_minutes_quota`) but no aggregate of
                minutes consumed this month. Until that endpoint exists we
                render `—` instead of `0`, which would falsely suggest the
                account is at zero usage. */}
            <UsageMeter
              label="Minutes"
              value={null}
              max={limits.monthly_minutes_quota}
            />
          </div>
        </div>
      </Tile>
      {/* Network tile is ILLUSTRATIVE — there is no aggregate latency endpoint
          in upstream-api-server today. Per-device heartbeats exist but a fleet
          aggregate would require either a new endpoint or a client fan-out.
          Kept here to preserve the Figma layout. */}
      <Tile
        title="Network"
        metric="—"
        metricSuffix="ms"
        actionLabel="View Network"
        subtitle="Aggregate latency endpoint coming soon"
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
        actionHref="/dashboard-next/api-tokens"
      />
      {/* Billing tile is INTENTIONALLY MOCK — there is no billing/metering
          service in upstream-api-server. The figures are illustrative; kept
          for the original Figma layout. */}
      <Tile
        title="Billing"
        metric="$—"
        actionLabel="View Billing"
        subtitle="Billing service not yet wired"
      />
    </div>
  );
}
