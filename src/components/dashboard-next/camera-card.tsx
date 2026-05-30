import Link from "next/link";
import { Video } from "lucide-react";
import type { Camera, CameraStatus } from "@/lib/api/types";
import { StatusDot, type DotStatus } from "./status-dot";

// One camera in the fleet grid — white .dn-tile in the Home vibe (Satoshi,
// status dot, glow "View" pill). The View link routes to
// /dashboard-next/cameras/{cameraId}, where the live WHEP player, latest
// frame, and session metadata render in full.

// Keeps prod StatusBadge semantics: streaming = good, idle/disabled = muted,
// error = bad.
const STATUS_DOT: Record<CameraStatus, DotStatus> = {
  streaming: "green",
  idle: "neutral",
  error: "red",
  disabled: "neutral",
};
const STATUS_TEXT: Record<CameraStatus, string> = {
  streaming: "#3f7d4e",
  idle: "var(--dn-text-50)",
  error: "#c0473b",
  disabled: "var(--dn-text-50)",
};

function formatSpec(c: Camera): string {
  const parts: string[] = [];
  if (c.default_width && c.default_height)
    parts.push(`${c.default_width}×${c.default_height}`);
  if (c.default_fps) parts.push(`${c.default_fps} fps`);
  if (c.default_codec) parts.push(c.default_codec);
  if (c.default_bitrate_kbps) parts.push(`${c.default_bitrate_kbps} kbps`);
  return parts.length ? parts.join(" · ") : "—";
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--dn-text-50)]">{label}</dt>
      <dd className="truncate font-bold">{value}</dd>
    </div>
  );
}

export function CameraCard({
  camera,
  agentName,
}: {
  camera: Camera;
  agentName: string;
}) {
  return (
    <article className="dn-tile flex flex-col gap-[clamp(0.7rem,1.3vw,1.05rem)] p-[clamp(1.1rem,1.8vw,1.75rem)]">
      {/* Static thumbnail placeholder. The card deliberately doesn't fetch
          the latest snapshot — at fleet sizes the cost (one signed-URL call
          per card on every list render) outweighs the value of a tiny
          thumbnail. The full snapshot lives on the camera detail page via
          <LatestFrameCardNext /> (poll on a 7 s cadence with the real
          `signed_url`). Future work could batch-resolve thumbnails behind a
          single list endpoint. */}
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-[rgba(0,0,0,0.06)] grid place-items-center">
        <Video
          className="h-7 w-7 text-[var(--dn-text-50)]"
          strokeWidth={1.75}
          aria-hidden
        />
      </div>

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-bold text-[clamp(1rem,1.4vw,1.3rem)]">
            {camera.name}
          </h3>
          {camera.external_id && (
            <p className="truncate text-[clamp(0.7rem,0.9vw,0.85rem)] text-[var(--dn-text-50)]">
              {camera.external_id}
            </p>
          )}
        </div>
        <span className="flex items-center gap-1.5 shrink-0">
          <StatusDot status={STATUS_DOT[camera.status]} />
          <span
            className="font-bold capitalize text-[clamp(0.72rem,0.9vw,0.85rem)]"
            style={{ color: STATUS_TEXT[camera.status] }}
          >
            {camera.status}
          </span>
        </span>
      </header>

      <dl className="flex flex-col gap-1 text-[clamp(0.78rem,1vw,0.95rem)]">
        <Row label="Agent" value={agentName} />
        <Row label="Defaults" value={formatSpec(camera)} />
        <Row label="Latency" value={camera.default_latency_mode} />
        <Row label="Added" value={camera.created_at.slice(0, 10)} />
      </dl>

      <Link
        href={`/dashboard/cameras/${camera.id}`}
        className="dn-btn dn-glow-soft mt-1 block text-center font-bold py-[clamp(0.55rem,0.9vw,0.85rem)] px-4 text-[clamp(0.8rem,0.95vw,1rem)]"
      >
        <span className="relative z-10">View</span>
      </Link>
    </article>
  );
}
