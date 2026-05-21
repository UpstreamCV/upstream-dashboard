"use client";

import { AgentCard, agentState } from "./agent-card";
import { StatCard } from "./stat-card";
import { useUpstreamList } from "@/lib/api/use-list";
import type { Agent, AgentListResponse } from "@/lib/api/types";

// Polls /v1/agents every 10s; counts derived from agentState() so the live
// heartbeat freshness (90s window) is the source of truth, matching what
// each AgentCard shows.

export function AgentsGridClient({
  initialAgents,
}: {
  initialAgents: Agent[];
}) {
  const agents =
    useUpstreamList<AgentListResponse>("/v1/agents", {
      fallbackData: { agents: initialAgents },
    }).data?.agents ?? initialAgents;

  const total = agents.length;
  const disabled = agents.filter((a) => a.status === "disabled").length;
  const online = agents.filter((a) => agentState(a) === "online").length;
  const offline = agents.filter((a) => agentState(a) === "offline").length;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Total" value={total} />
        <StatCard label="Online" value={online} status="green" />
        <StatCard label="Offline" value={offline} status="neutral" />
        <StatCard label="Disabled" value={disabled} status="neutral" />
      </div>

      {agents.length === 0 ? (
        <div className="dn-tile p-[clamp(1.5rem,3vw,2.5rem)] text-center">
          <p className="font-bold text-[clamp(1rem,1.4vw,1.3rem)]">
            No agents registered yet
          </p>
          <p className="mt-2 text-[var(--dn-text-50)] text-[clamp(0.85rem,1vw,1rem)]">
            Run <span className="font-mono">upstream init &amp;&amp; upstream start</span>{" "}
            on a host with an API token to register one.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
          {agents.map((a) => (
            <AgentCard key={a.id} agent={a} />
          ))}
        </div>
      )}
    </>
  );
}
