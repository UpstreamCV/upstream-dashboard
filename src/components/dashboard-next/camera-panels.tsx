import Link from "next/link";
import { RelativeTime } from "@/components/data/relative-time";
import { StatusDot, type DotStatus } from "./status-dot";
import type {
  Agent,
  AgentStatus,
  Camera,
  StreamSession,
  StreamValidation,
} from "@/lib/api/types";

// Read-only metadata panels for the dashboard-next camera detail tabs.
// CameraMetaPanel is reused by both the Monitor and Settings tabs; the others
// only appear on Monitor today. All four were previously inline in
// src/app/dashboard-next/(app)/cameras/[cameraId]/page.tsx; extracted so the
// Settings tab can render the camera defaults without duplicating JSX.

// Re-used by the Applied Geometry panel and any future Monitor-tab tile that
// follows the label / value row shape — exported so they don't have to
// duplicate the styling.
export function Row({
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

export function PanelHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
      {children}
    </p>
  );
}

export function CameraMetaPanel({ camera }: { camera: Camera }) {
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

export function AgentPanel({ agent }: { agent: Agent | null }) {
  return (
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <PanelHeader>agent</PanelHeader>
      {agent ? (
        <>
          <Row
            label="Name"
            value={
              <Link
                href="/dashboard/agents"
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

export function ValidationPanel({
  validation,
}: {
  validation: StreamValidation | null;
}) {
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

export function SessionPanel({ session }: { session: StreamSession }) {
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
