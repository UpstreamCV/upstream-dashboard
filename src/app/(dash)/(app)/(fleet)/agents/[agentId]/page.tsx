import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Cpu } from "lucide-react";
import { RelativeTime } from "@/components/data/relative-time";
import {
  AGENT_ONLINE_WINDOW_MS,
  agentState,
  type AgentState,
} from "@/components/dashboard-next/agent-card";
import { StatusDot, type DotStatus } from "@/components/dashboard-next/status-dot";
import { getActiveAccount } from "@/lib/account/active";
import { getAgent, getAgentHeartbeats } from "@/lib/api/agents";
import { listCameras } from "@/lib/api/cameras";
import { UpstreamApiError } from "@/lib/api/errors";
import type { Agent, Camera, HeartbeatRecord, HeartbeatStatus } from "@/lib/api/types";

// Agent Detail — the per-agent view the AgentCard's (previously inert) drill-down
// now reaches. Composes data that already exists: the agent record (getAgent),
// the cameras it has claimed (listCameras filtered by agent_id), and its
// heartbeat timeline (getAgentHeartbeats, a thin wrapper over the existing
// GET /v1/agents/{id}/heartbeats). Version / Update Status is surfaced from
// agent.version + the heartbeats' agent_version (true rollout state needs a
// backend that doesn't exist yet — we show "latest seen" only).

const HEARTBEAT_LIMIT = 50;

const STATE_DOT: Record<AgentState, DotStatus> = {
  online: "green",
  offline: "neutral",
  disabled: "neutral",
};
const STATE_LABEL: Record<AgentState, string> = {
  online: "Online",
  offline: "Offline",
  disabled: "Disabled",
};

const HEARTBEAT_DOT: Record<HeartbeatStatus, DotStatus> = {
  online: "green",
  streaming: "green",
  reconnecting: "orange",
  error: "red",
};

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const { activeAccountId } = await getActiveAccount();

  let agent: Agent;
  try {
    agent = await getAgent({ accountId: activeAccountId, agentId });
  } catch (err) {
    if (err instanceof UpstreamApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const [cameras, heartbeats]: [Camera[], HeartbeatRecord[]] = await Promise.all([
    listCameras({ accountId: activeAccountId, agentId }).catch((err) => {
      if (err instanceof UpstreamApiError) return [];
      throw err;
    }),
    getAgentHeartbeats({
      accountId: activeAccountId,
      agentId,
      limit: HEARTBEAT_LIMIT,
    }).catch((err) => {
      if (err instanceof UpstreamApiError) return [];
      throw err;
    }),
  ]);

  const state = agentState(agent);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1 text-[clamp(0.78rem,1vw,0.92rem)] text-white/75 hover:text-white transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Agents
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[clamp(0.62rem,0.8vw,0.78rem)] font-bold uppercase tracking-wide text-white/65">
            agent
          </p>
          <h1 className="mt-1.5 flex flex-wrap items-center gap-3 font-bold text-white text-[clamp(1.6rem,3.2vw,2.4rem)]">
            <span className="truncate">{agent.name}</span>
            <span className="inline-flex items-center gap-1.5 text-[clamp(0.8rem,1vw,0.95rem)]">
              <StatusDot status={STATE_DOT[state]} />
              <span className="text-white/80 font-bold">{STATE_LABEL[state]}</span>
            </span>
          </h1>
          <p className="mt-2 text-[11px] uppercase tracking-wider font-mono text-white/55">
            id: {agent.id}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Heartbeat timeline — the agent's recent connectivity history. */}
        <section className="dn-tile lg:col-span-2 p-[clamp(1.1rem,1.8vw,1.5rem)] space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-bold text-[clamp(1rem,1.2vw,1.15rem)] text-white">
              Heartbeats
            </h2>
            <span className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
              last {heartbeats.length}
            </span>
          </div>
          {heartbeats.length > 0 ? (
            <ul className="flex flex-col divide-y divide-[var(--dn-text-15)]">
              {heartbeats.map((hb) => (
                <HeartbeatRow key={hb.id} hb={hb} />
              ))}
            </ul>
          ) : (
            <p className="text-[clamp(0.82rem,1vw,0.95rem)] text-[var(--dn-text-50)]">
              No heartbeats reported in the recent window.
            </p>
          )}
        </section>

        {/* Agent meta + claimed cameras. */}
        <div className="space-y-4 md:space-y-6">
          <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
            <h2 className="font-bold text-[clamp(1rem,1.2vw,1.15rem)] text-white">
              Details
            </h2>
            <dl className="mt-3 flex flex-col gap-1 text-[clamp(0.78rem,1vw,0.95rem)]">
              <MetaRow label="Status" value={<span className="capitalize">{agent.status}</span>} />
              <MetaRow label="Version" value={agent.version ?? "—"} />
              <MetaRow
                label="OS"
                value={
                  <>
                    {agent.os ?? "—"}
                    {agent.python_version ? (
                      <span className="ml-1.5 text-[var(--dn-text-50)] font-normal">
                        py{agent.python_version}
                      </span>
                    ) : null}
                  </>
                }
              />
              <MetaRow label="Hostname" value={agent.hostname ?? "—"} />
              <MetaRow
                label="Last seen"
                value={<RelativeTime value={agent.last_seen_at} className="font-bold" />}
              />
              <MetaRow label="Added" value={agent.created_at.slice(0, 10)} />
            </dl>
            <p className="mt-3 text-[11px] text-[var(--dn-text-50)]">
              Online window: {AGENT_ONLINE_WINDOW_MS / 1000}s since last heartbeat.
            </p>
          </section>

          <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-bold text-[clamp(1rem,1.2vw,1.15rem)] text-white">
                Cameras
              </h2>
              <span className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
                {cameras.length}
              </span>
            </div>
            {cameras.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-1.5">
                {cameras.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/cameras/${c.id}`}
                      className="flex items-center gap-2 text-[clamp(0.82rem,1vw,0.95rem)] text-white hover:underline underline-offset-2"
                    >
                      <Cpu className="h-4 w-4 text-[var(--dn-text-50)]" aria-hidden />
                      <span className="truncate font-bold">{c.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[clamp(0.82rem,1vw,0.95rem)] text-[var(--dn-text-50)]">
                No cameras claimed by this agent.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function HeartbeatRow({ hb }: { hb: HeartbeatRecord }) {
  const res =
    hb.width && hb.height ? `${hb.width}×${hb.height}` : null;
  const detail = [
    hb.fps ? `${hb.fps} fps` : null,
    hb.bitrate_kbps ? `${hb.bitrate_kbps} kbps` : null,
    res,
    hb.codec,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="flex items-center gap-2 min-w-0">
        <StatusDot status={HEARTBEAT_DOT[hb.status]} />
        <span className="font-bold text-[clamp(0.8rem,1vw,0.92rem)] text-white capitalize">
          {hb.status}
        </span>
        {detail ? (
          <span className="truncate text-[clamp(0.72rem,0.9vw,0.85rem)] text-[var(--dn-text-50)]">
            {detail}
          </span>
        ) : null}
      </span>
      <RelativeTime
        value={hb.reported_at}
        className="shrink-0 text-[clamp(0.72rem,0.9vw,0.85rem)] text-[var(--dn-text-50)]"
      />
    </li>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--dn-text-50)]">{label}</dt>
      <dd className="truncate font-bold text-white">{value}</dd>
    </div>
  );
}
