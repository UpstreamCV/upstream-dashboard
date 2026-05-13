import "server-only";
import { serverFetch } from "./server";
import type { Agent, AgentListResponse } from "./types";

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
