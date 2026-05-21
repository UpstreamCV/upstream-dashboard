"use client";

import { CameraCard } from "./camera-card";
import { StatCard } from "./stat-card";
import { useUpstreamList } from "@/lib/api/use-list";
import type {
  Agent,
  AgentListResponse,
  Camera,
  CameraListResponse,
} from "@/lib/api/types";

// Client wrapper that polls /v1/cameras + /v1/agents every 10s (defaults to
// useUpstreamList's 10s interval). Server hands in initialData for instant
// first paint; from then on SWR keeps things fresh.

export function CamerasGridClient({
  initialCameras,
  initialAgents,
}: {
  initialCameras: Camera[];
  initialAgents: Agent[];
}) {
  const cameras =
    useUpstreamList<CameraListResponse>("/v1/cameras", {
      fallbackData: { cameras: initialCameras },
    }).data?.cameras ?? initialCameras;

  const agents =
    useUpstreamList<AgentListResponse>("/v1/agents", {
      fallbackData: { agents: initialAgents },
    }).data?.agents ?? initialAgents;

  const agentNames: Record<string, string> = Object.fromEntries(
    agents.map((a) => [a.id, a.name]),
  );

  const total = cameras.length;
  const live = cameras.filter((c) => c.status === "streaming").length;
  const idle = cameras.filter((c) => c.status === "idle").length;
  const errors = cameras.filter((c) => c.status === "error").length;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Total" value={total} />
        <StatCard label="Live" value={live} status="green" />
        <StatCard label="Idle" value={idle} status="neutral" />
        <StatCard
          label="Errors"
          value={errors}
          status={errors > 0 ? "red" : "neutral"}
        />
      </div>

      {cameras.length === 0 ? (
        <div className="dn-tile p-[clamp(1.5rem,3vw,2.5rem)] text-center">
          <p className="font-bold text-[clamp(1rem,1.4vw,1.3rem)]">
            No cameras registered yet
          </p>
          <p className="mt-2 text-[var(--dn-text-50)] text-[clamp(0.85rem,1vw,1rem)]">
            Once an upstream-agent registers a camera, it will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
          {cameras.map((c) => (
            <CameraCard
              key={c.id}
              camera={c}
              agentName={agentNames[c.agent_id] ?? c.agent_id.slice(0, 8)}
            />
          ))}
        </div>
      )}
    </>
  );
}
