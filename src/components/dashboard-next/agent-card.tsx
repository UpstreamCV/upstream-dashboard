import type { ReactNode } from "react";
import { Cpu } from "lucide-react";
import { RelativeTime } from "@/components/data/relative-time";
import type { Agent } from "@/lib/api/types";
import { StatusDot, type DotStatus } from "./status-dot";

// One agent in the fleet grid — white .dn-tile in the Home vibe, mirroring
// CameraCard but agent-shaped (no video thumbnail; agents have no frame).
// Reflects the prod Agents table fields (name/hostname, status, version,
// OS/python, last seen) but framed by heartbeat connectivity.
//
// No "View" pill: there is no agent detail page in either dashboard (agents
// are stateless and edited only via the agent CLI, not the dashboard). The
// card carries every field a viewer needs at a glance.

export const AGENT_ONLINE_WINDOW_MS = 90_000;

export type AgentState = "online" | "offline" | "disabled";

// Single source of truth — also used by the page for the summary counts.
export function agentState(a: Agent): AgentState {
  if (a.status === "disabled") return "disabled";
  if (
    a.last_seen_at &&
    Date.now() - Date.parse(a.last_seen_at) < AGENT_ONLINE_WINDOW_MS
  ) {
    return "online";
  }
  return "offline";
}

const STATE_DOT: Record<AgentState, DotStatus> = {
  online: "green",
  offline: "neutral",
  disabled: "neutral",
};
const STATE_TEXT: Record<AgentState, string> = {
  online: "#3f7d4e",
  offline: "var(--dn-text-50)",
  disabled: "var(--dn-text-50)",
};
const STATE_LABEL: Record<AgentState, string> = {
  online: "Online",
  offline: "Offline",
  disabled: "Disabled",
};

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--dn-text-50)]">{label}</dt>
      <dd className="truncate font-bold">{value}</dd>
    </div>
  );
}

export function AgentCard({ agent }: { agent: Agent }) {
  const state = agentState(agent);

  return (
    <article className="dn-tile flex flex-col gap-[clamp(0.7rem,1.3vw,1.05rem)] p-[clamp(1.1rem,1.8vw,1.75rem)]">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="grid place-items-center rounded-xl bg-[rgba(0,0,0,0.06)] shrink-0"
            style={{
              width: "clamp(2.4rem,4vw,3rem)",
              height: "clamp(2.4rem,4vw,3rem)",
            }}
            aria-hidden
          >
            <Cpu
              className="h-5 w-5 text-[var(--dn-text-50)]"
              strokeWidth={1.75}
            />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-bold text-[clamp(1rem,1.4vw,1.3rem)]">
              {agent.name}
            </h3>
            {agent.hostname && (
              <p className="truncate text-[clamp(0.7rem,0.9vw,0.85rem)] text-[var(--dn-text-50)]">
                {agent.hostname}
              </p>
            )}
          </div>
        </div>
        <span className="flex items-center gap-1.5 shrink-0">
          <StatusDot status={STATE_DOT[state]} />
          <span
            className="font-bold text-[clamp(0.72rem,0.9vw,0.85rem)]"
            style={{ color: STATE_TEXT[state] }}
          >
            {STATE_LABEL[state]}
          </span>
        </span>
      </header>

      <dl className="flex flex-col gap-1 text-[clamp(0.78rem,1vw,0.95rem)]">
        <Row
          label="Status"
          value={<span className="capitalize">{agent.status}</span>}
        />
        <Row label="Version" value={agent.version ?? "—"} />
        <Row
          label="OS"
          value={
            <>
              {agent.os ?? "—"}
              {agent.python_version && (
                <span className="ml-1.5 text-[var(--dn-text-50)] font-normal">
                  py{agent.python_version}
                </span>
              )}
            </>
          }
        />
        <Row
          label="Last seen"
          value={
            <RelativeTime value={agent.last_seen_at} className="font-bold" />
          }
        />
        <Row label="Added" value={agent.created_at.slice(0, 10)} />
      </dl>
    </article>
  );
}
