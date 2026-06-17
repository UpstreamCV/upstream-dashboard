import "server-only";
import { serverFetch } from "./server";
import type {
  Agent,
  AgentListResponse,
  HeartbeatListResponse,
  HeartbeatRecord,
} from "./types";

export async function listAgents(opts: {
  accountId: string;
  status?: string;
  limit?: number;
}): Promise<Agent[]> {
  const res = await serverFetch<AgentListResponse>("/v1/agents", {
    accountId: opts.accountId,
    query: { status: opts.status, limit: opts.limit },
  });
  return res.agents;
}

export async function getAgent(opts: {
  accountId: string;
  agentId: string;
}): Promise<Agent> {
  return serverFetch<Agent>(`/v1/agents/${opts.agentId}`, {
    accountId: opts.accountId,
  });
}

// Heartbeat history for an agent (newest-first). Backs the Agent Detail
// heartbeat timeline. The endpoint already exists on upstream-api-server
// (GET /v1/agents/{id}/heartbeats, limit 1–500); this is just the dashboard
// client wrapper.
export async function getAgentHeartbeats(opts: {
  accountId: string;
  agentId: string;
  limit?: number;
  before?: string;
}): Promise<HeartbeatRecord[]> {
  const res = await serverFetch<HeartbeatListResponse>(
    `/v1/agents/${opts.agentId}/heartbeats`,
    {
      accountId: opts.accountId,
      query: { limit: opts.limit, before: opts.before },
    },
  );
  return res.heartbeats;
}
