"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CameraCard } from "./camera-card";
import { StatCard } from "./stat-card";
import { useUpstreamList } from "@/lib/api/use-list";
import { isDemoMode } from "@/lib/demo/demo-mode";
import { AddCameraPanel } from "@/lib/demo/add-camera-panel";
import type {
  Agent,
  AgentListResponse,
  Camera,
  CameraListResponse,
} from "@/lib/api/types";

// Client wrapper that polls /v1/cameras every 10s (the default) for live status,
// and /v1/agents every 60s — agent display names are effectively static, so they
// don't need the time-sensitive cadence. Server hands in initialData for instant
// first paint; from then on SWR keeps things fresh.

export function CamerasGridClient({
  initialCameras,
  initialAgents,
}: {
  initialCameras: Camera[];
  initialAgents: Agent[];
}) {
  const demo = isDemoMode();
  const [showAdd, setShowAdd] = useState(false);

  const cameras =
    useUpstreamList<CameraListResponse>("/v1/cameras", {
      fallbackData: { cameras: initialCameras },
      // In demo mode poll fast so the camera appears right after the add flow.
      refreshInterval: demo ? 1500 : undefined,
    }).data?.cameras ?? initialCameras;

  const agents =
    useUpstreamList<AgentListResponse>("/v1/agents", {
      // Names rarely change; poll 6x slower than camera status (a rename shows
      // up within 60s). Targeted, not a blanket interval bump.
      refreshInterval: 60_000,
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
            {demo ? "Connect your first camera" : "No cameras registered yet"}
          </p>
          <p className="mt-2 text-[var(--dn-text-50)] text-[clamp(0.85rem,1vw,1rem)]">
            {demo
              ? "Install the agent on a camera host — it registers and appears here automatically."
              : "Once an upstream-agent registers a camera, it will appear here."}
          </p>
          {demo ? (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="dn-btn dn-glow-soft mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 font-bold"
            >
              <Plus className="relative z-10 h-4 w-4" />
              <span className="relative z-10">Add camera</span>
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
          {cameras.map((c) => (
            <CameraCard
              key={c.id}
              camera={c}
              agentName={
                c.agent_id === null
                  ? "unassigned"
                  : (agentNames[c.agent_id] ?? c.agent_id.slice(0, 8))
              }
              previewSrc={demo ? "/demo/dock-frame.jpg" : undefined}
            />
          ))}
        </div>
      )}

      {showAdd ? <AddCameraPanel onClose={() => setShowAdd(false)} /> : null}
    </>
  );
}
