import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { RelativeTime } from "@/components/data/relative-time";
import { CameraDetailRealtimeNext } from "@/components/dashboard-next/camera-detail-realtime-next";
import { CameraStreamStatusBadgeNext } from "@/components/dashboard-next/camera-stream-status-badge-next";
import { LatestFrameCardNext } from "@/components/dashboard-next/latest-frame-card-next";
import { LiveStreamPanelNext } from "@/components/dashboard-next/live-stream-panel-next";
import { StatusDot, type DotStatus } from "@/components/dashboard-next/status-dot";
import { getActiveAccount } from "@/lib/account/active";
import { getAgent } from "@/lib/api/agents";
import { getCamera } from "@/lib/api/cameras";
import { UpstreamApiError } from "@/lib/api/errors";
import { getLatestFrame } from "@/lib/api/snapshots";
import { listStreamSessions } from "@/lib/api/stream-sessions";
import { listValidations } from "@/lib/api/validations";
import type {
  Agent,
  AgentStatus,
  Camera,
  StreamSession,
  StreamValidation,
} from "@/lib/api/types";

// Light-theme port of src/app/dashboard/cameras/[cameraId]/page.tsx.
// Parallel-fetches the same five resources (camera, agent, current session,
// latest frame, validations) and renders them across a header + 2-column
// stream/frame area + 3-column metadata grid. The page is a Server Component;
// only the player, badge, latest-frame card, and Realtime listener are
// client-side.

export default async function CameraDetailPage({
  params,
}: {
  params: Promise<{ cameraId: string }>;
}) {
  const { cameraId } = await params;
  const { activeAccountId } = await getActiveAccount();

  let camera: Camera;
  try {
    camera = await getCamera({ accountId: activeAccountId, cameraId });
  } catch (err) {
    if (err instanceof UpstreamApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const [agent, sessions, latestFrame] = await Promise.all([
    // 404 = agent removed; other errors bubble to the segment error boundary.
    getAgent({ accountId: activeAccountId, agentId: camera.agent_id }).catch(
      (err) => {
        if (err instanceof UpstreamApiError && err.status === 404) return null;
        throw err;
      },
    ),
    listStreamSessions({
      accountId: activeAccountId,
      cameraId: camera.id,
      limit: 1,
    }),
    getLatestFrame({ accountId: activeAccountId, cameraId: camera.id }),
  ]);

  const currentSession: StreamSession | null = sessions[0] ?? null;
  const validations: StreamValidation[] = currentSession
    ? await listValidations({
        accountId: activeAccountId,
        sessionId: currentSession.id,
      }).catch((err) => {
        if (err instanceof UpstreamApiError && err.status === 404) return [];
        throw err;
      })
    : [];
  const latestValidation = validations[0] ?? null;

  return (
    <section className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard-next/cameras"
          className="inline-flex items-center gap-1 text-[clamp(0.78rem,1vw,0.92rem)] text-white/75 hover:text-white transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Cameras
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[clamp(0.62rem,0.8vw,0.78rem)] font-bold uppercase tracking-wide text-[var(--dn-text-50)] text-white/65">
            camera
          </p>
          <h1 className="mt-1.5 flex flex-wrap items-center gap-3 font-bold text-white text-[clamp(1.6rem,3.2vw,2.4rem)]">
            <span className="truncate">{camera.name}</span>
            <CameraStreamStatusBadgeNext
              cameraId={camera.id}
              initialStatus={camera.status}
            />
          </h1>
          <p className="mt-2 text-[11px] uppercase tracking-wider font-mono text-white/55">
            id: {camera.id}
          </p>
        </div>
      </header>

      <CameraDetailRealtimeNext
        cameraId={camera.id}
        initialSession={currentSession}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="space-y-4 md:space-y-6">
          <LiveStreamPanelNext session={currentSession} />
          {currentSession ? <SessionPanel session={currentSession} /> : null}
        </div>
        <div>
          <LatestFrameCardNext cameraId={camera.id} initialFrame={latestFrame} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <CameraMetaPanel camera={camera} />
        <AgentPanel agent={agent} />
        <ValidationPanel validation={latestValidation} />
      </div>
    </section>
  );
}

// --- panels ---

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        {label}
      </span>
      <span className="text-right text-[clamp(0.82rem,1vw,0.95rem)] text-black">
        {value}
      </span>
    </div>
  );
}

function PanelHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
      {children}
    </p>
  );
}

function CameraMetaPanel({ camera }: { camera: Camera }) {
  return (
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <PanelHeader>camera</PanelHeader>
      <Row
        label="Defaults"
        value={
          <span className="font-mono text-[var(--dn-text-50)]">
            {camera.default_width && camera.default_height
              ? `${camera.default_width}×${camera.default_height}`
              : "—"}
            {camera.default_fps ? ` · ${camera.default_fps} fps` : ""}
            {camera.default_codec ? ` · ${camera.default_codec}` : ""}
          </span>
        }
      />
      <Row
        label="Bitrate"
        value={
          <span className="font-mono text-[var(--dn-text-50)]">
            {camera.default_bitrate_kbps
              ? `${camera.default_bitrate_kbps} kbps`
              : "—"}
          </span>
        }
      />
      <Row
        label="Latency"
        value={
          <span className="font-mono capitalize text-[var(--dn-text-50)]">
            {camera.default_latency_mode}
          </span>
        }
      />
      <Row
        label="External id"
        value={
          camera.external_id ? (
            <span className="font-mono text-[var(--dn-text-50)]">
              {camera.external_id}
            </span>
          ) : (
            <span className="text-[var(--dn-text-50)]">—</span>
          )
        }
      />
      <Row
        label="Device path"
        value={
          camera.device_path ? (
            <span className="font-mono text-[var(--dn-text-50)]">
              {camera.device_path}
            </span>
          ) : (
            <span className="text-[var(--dn-text-50)]">—</span>
          )
        }
      />
    </div>
  );
}

const AGENT_DOT: Record<AgentStatus, DotStatus> = {
  active: "green",
  disabled: "neutral",
};
const AGENT_TEXT: Record<AgentStatus, string> = {
  active: "#3f7d4e",
  disabled: "var(--dn-text-50)",
};

function AgentPanel({ agent }: { agent: Agent | null }) {
  return (
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <PanelHeader>agent</PanelHeader>
      {agent ? (
        <>
          <Row
            label="Name"
            value={
              <Link
                href="/dashboard-next/agents"
                className="text-black hover:text-[var(--dn-creek-mid)] transition"
              >
                {agent.name}
              </Link>
            }
          />
          <Row
            label="Status"
            value={
              <span className="inline-flex items-center gap-1.5">
                <StatusDot status={AGENT_DOT[agent.status]} />
                <span
                  className="font-bold capitalize"
                  style={{ color: AGENT_TEXT[agent.status] }}
                >
                  {agent.status}
                </span>
              </span>
            }
          />
          <Row
            label="Version"
            value={
              <span className="font-mono text-[var(--dn-text-50)]">
                {agent.version ?? "—"}
              </span>
            }
          />
          <Row
            label="Hostname"
            value={
              <span className="font-mono text-[var(--dn-text-50)]">
                {agent.hostname ?? "—"}
              </span>
            }
          />
          <Row
            label="Last seen"
            value={
              <RelativeTime
                value={agent.last_seen_at}
                className="text-[var(--dn-text-50)]"
              />
            }
          />
        </>
      ) : (
        <p className="text-sm text-[var(--dn-text-50)]">Agent not found.</p>
      )}
    </div>
  );
}

function ValidationPanel({ validation }: { validation: StreamValidation | null }) {
  return (
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <PanelHeader>validation</PanelHeader>
      {validation ? (
        <>
          <Row
            label="Result"
            value={
              <span className="inline-flex items-center gap-1.5">
                <StatusDot status={validation.passed ? "green" : "red"} />
                <span
                  className="font-bold capitalize"
                  style={{
                    color: validation.passed ? "#3f7d4e" : "#c0473b",
                  }}
                >
                  {validation.passed ? "approved" : "failed"}
                </span>
              </span>
            }
          />
          {validation.mismatch_fields.length > 0 ? (
            <Row
              label="Mismatch"
              value={
                <span className="font-mono text-[#c0473b]">
                  {validation.mismatch_fields.join(", ")}
                </span>
              }
            />
          ) : null}
          <Row
            label="Checked"
            value={
              <RelativeTime
                value={validation.created_at}
                className="text-[var(--dn-text-50)]"
              />
            }
          />
        </>
      ) : (
        <p className="text-sm text-[var(--dn-text-50)]">
          No validations recorded for this camera&rsquo;s sessions yet.
        </p>
      )}
    </div>
  );
}

const SESSION_DOT: Record<StreamSession["state"], DotStatus> = {
  streaming: "green",
  approved: "yellow",
  ended: "neutral",
  expired: "neutral",
  failed: "red",
};
const SESSION_TEXT: Record<StreamSession["state"], string> = {
  streaming: "#3f7d4e",
  approved: "#8a6d1f",
  ended: "var(--dn-text-50)",
  expired: "var(--dn-text-50)",
  failed: "#c0473b",
};

function SessionPanel({ session }: { session: StreamSession }) {
  return (
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          current session
        </p>
        <span className="inline-flex items-center gap-1.5">
          <StatusDot status={SESSION_DOT[session.state]} />
          <span
            className="font-bold capitalize"
            style={{ color: SESSION_TEXT[session.state] }}
          >
            {session.state}
          </span>
        </span>
      </div>
      <Row
        label="Session id"
        value={
          <span className="font-mono text-xs text-[var(--dn-text-50)]">
            {session.id.slice(0, 8)}…
          </span>
        }
      />
      <Row
        label="Approved"
        value={
          <span className="font-mono text-[var(--dn-text-50)]">
            {session.approved.width}×{session.approved.height} ·{" "}
            {session.approved.fps} fps · {session.approved.codec}
          </span>
        }
      />
      <Row
        label="Bitrate"
        value={
          <span className="font-mono text-[var(--dn-text-50)]">
            {session.approved.bitrate_kbps} kbps
          </span>
        }
      />
      <Row
        label="Latency"
        value={
          <span className="font-mono capitalize text-[var(--dn-text-50)]">
            {session.approved.latency_mode}
          </span>
        }
      />
      <Row
        label="Started"
        value={
          <RelativeTime
            value={session.started_at ?? session.created_at}
            className="text-[var(--dn-text-50)]"
          />
        }
      />
      <Row
        label="Expires"
        value={
          <RelativeTime
            value={session.expires_at}
            className="text-[var(--dn-text-50)]"
          />
        }
      />
      {session.ended_at ? (
        <Row
          label="Ended"
          value={
            <RelativeTime
              value={session.ended_at}
              className="text-[var(--dn-text-50)]"
            />
          }
        />
      ) : null}
    </div>
  );
}
