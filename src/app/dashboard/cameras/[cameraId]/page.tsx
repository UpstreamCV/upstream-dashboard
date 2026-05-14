import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CopyButton } from "@/components/data/copy-button";
import { RelativeTime } from "@/components/data/relative-time";
import { StatusBadge } from "@/components/data/status-badge";
import { LatestFrameCard } from "@/components/stream/latest-frame-card";
import { LiveStreamPanel } from "@/components/stream/live-stream-panel";
import { getActiveAccount } from "@/lib/account/active";
import { getAgent } from "@/lib/api/agents";
import { getCamera } from "@/lib/api/cameras";
import { UpstreamApiError } from "@/lib/api/errors";
import { getLatestFrame } from "@/lib/api/snapshots";
import { listStreamSessions } from "@/lib/api/stream-sessions";
import { listValidations } from "@/lib/api/validations";
import type { StreamSession, StreamValidation } from "@/lib/api/types";
import { CameraDetailPolling } from "./camera-detail-polling";

export default async function CameraDetailPage({
  params,
}: {
  params: Promise<{ cameraId: string }>;
}) {
  const { cameraId } = await params;
  const { activeAccountId } = await getActiveAccount();

  let camera;
  try {
    camera = await getCamera({ accountId: activeAccountId, cameraId });
  } catch (err) {
    if (err instanceof UpstreamApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const [agent, sessions, latestFrame] = await Promise.all([
    // 404 means the agent was removed; other errors should surface through
    // the page's error boundary instead of silently rendering "Agent not found".
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
    // getLatestFrame already returns null on 404 / snapshot_not_found and
    // re-throws on other errors — no .catch wrapper needed here.
    getLatestFrame({ accountId: activeAccountId, cameraId: camera.id }),
  ]);

  const currentSession: StreamSession | null = sessions[0] ?? null;
  const validations: StreamValidation[] = currentSession
    ? await listValidations({
        accountId: activeAccountId,
        sessionId: currentSession.id,
      }).catch((err) => {
        // 404 = session disappeared mid-render; render an empty validation
        // panel rather than failing the page. Other errors bubble.
        if (err instanceof UpstreamApiError && err.status === 404) return [];
        throw err;
      })
    : [];

  const latestValidation = validations[0] ?? null;

  return (
    <section className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-3">
          <Link
            href="/dashboard/cameras"
            className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Cameras
          </Link>
        </div>
      </div>

      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-accent mono">
            camera
          </p>
          <h1 className="display text-3xl font-semibold mt-1.5 flex items-center gap-3">
            {camera.name}
            <StatusBadge status={camera.status} />
          </h1>
          <div className="mt-2 text-xs text-ink-mute mono flex items-center gap-1.5">
            <span>id: {camera.id}</span>
            <CopyButton value={camera.id} label="camera id" />
          </div>
        </div>
      </header>

      <CameraDetailPolling
        cameraId={camera.id}
        initialSession={currentSession}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="space-y-4 md:space-y-6">
          <LiveStreamPanel session={currentSession} />
          {currentSession ? <SessionPanel session={currentSession} /> : null}
        </div>
        <div>
          <LatestFrameCard
            cameraId={camera.id}
            initialFrame={latestFrame}
          />
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-[11px] uppercase tracking-wider text-ink-mute mono">
        {label}
      </span>
      <span className="text-ink text-right">{value}</span>
    </div>
  );
}

function CameraMetaPanel({
  camera,
}: {
  camera: import("@/lib/api/types").Camera;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-accent mono mb-3">
        camera
      </p>
      <Row
        label="Defaults"
        value={
          <span className="mono text-sm text-ink-soft">
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
          <span className="mono text-sm text-ink-soft">
            {camera.default_bitrate_kbps
              ? `${camera.default_bitrate_kbps} kbps`
              : "—"}
          </span>
        }
      />
      <Row
        label="Latency"
        value={
          <span className="mono text-sm text-ink-soft capitalize">
            {camera.default_latency_mode}
          </span>
        }
      />
      <Row
        label="External id"
        value={
          camera.external_id ? (
            <span className="mono text-sm text-ink-soft">
              {camera.external_id}
            </span>
          ) : (
            <span className="text-ink-mute">—</span>
          )
        }
      />
      <Row
        label="Device path"
        value={
          camera.device_path ? (
            <span className="mono text-sm text-ink-soft">
              {camera.device_path}
            </span>
          ) : (
            <span className="text-ink-mute">—</span>
          )
        }
      />
    </div>
  );
}

function AgentPanel({
  agent,
}: {
  agent: import("@/lib/api/types").Agent | null;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-accent mono mb-3">
        agent
      </p>
      {agent ? (
        <>
          <Row
            label="Name"
            value={
              <Link
                href={`/dashboard/agents`}
                className="text-ink hover:text-accent transition"
              >
                {agent.name}
              </Link>
            }
          />
          <Row label="Status" value={<StatusBadge status={agent.status} />} />
          <Row
            label="Version"
            value={
              <span className="mono text-sm text-ink-soft">
                {agent.version ?? "—"}
              </span>
            }
          />
          <Row
            label="Hostname"
            value={
              <span className="mono text-sm text-ink-soft">
                {agent.hostname ?? "—"}
              </span>
            }
          />
          <Row
            label="Last seen"
            value={
              <RelativeTime
                value={agent.last_seen_at}
                className="text-ink-soft"
              />
            }
          />
        </>
      ) : (
        <p className="text-sm text-ink-mute">Agent not found.</p>
      )}
    </div>
  );
}

function ValidationPanel({
  validation,
}: {
  validation: StreamValidation | null;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-accent mono mb-3">
        validation
      </p>
      {validation ? (
        <>
          <Row
            label="Result"
            value={
              <StatusBadge status={validation.passed ? "approved" : "failed"} />
            }
          />
          {validation.mismatch_fields.length > 0 ? (
            <Row
              label="Mismatch"
              value={
                <span className="mono text-sm text-[#e89e93]">
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
                className="text-ink-soft"
              />
            }
          />
        </>
      ) : (
        <p className="text-sm text-ink-mute">
          No validations recorded for this camera&rsquo;s sessions yet.
        </p>
      )}
    </div>
  );
}

function SessionPanel({ session }: { session: StreamSession }) {
  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-center justify-between mb-3 gap-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-accent mono">
          current session
        </p>
        <StatusBadge status={session.state} />
      </div>
      <Row
        label="Session id"
        value={
          <span className="mono text-xs text-ink-soft inline-flex items-center gap-1.5">
            {session.id.slice(0, 8)}…
            <CopyButton value={session.id} label="session id" />
          </span>
        }
      />
      <Row
        label="Approved"
        value={
          <span className="mono text-sm text-ink-soft">
            {session.approved.width}×{session.approved.height} ·{" "}
            {session.approved.fps} fps · {session.approved.codec}
          </span>
        }
      />
      <Row
        label="Bitrate"
        value={
          <span className="mono text-sm text-ink-soft">
            {session.approved.bitrate_kbps} kbps
          </span>
        }
      />
      <Row
        label="Latency"
        value={
          <span className="mono text-sm text-ink-soft capitalize">
            {session.approved.latency_mode}
          </span>
        }
      />
      <Row
        label="Started"
        value={
          <RelativeTime
            value={session.started_at ?? session.created_at}
            className="text-ink-soft"
          />
        }
      />
      <Row
        label="Expires"
        value={
          <RelativeTime
            value={session.expires_at}
            className="text-ink-soft"
          />
        }
      />
      {session.ended_at ? (
        <Row
          label="Ended"
          value={
            <RelativeTime
              value={session.ended_at}
              className="text-ink-soft"
            />
          }
        />
      ) : null}
    </div>
  );
}
