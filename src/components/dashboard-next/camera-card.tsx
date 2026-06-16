import Link from "next/link";
import {
  Cog,
  Image as ImageIcon,
  MoreHorizontal,
  ScanLine,
  Video,
  Wrench,
} from "lucide-react";
import type { Camera } from "@/lib/api/types";
import { RelativeTime } from "@/components/data/relative-time";
import { BUCKET_META, type CameraBucket } from "./dn-status";

// One camera in the DarkMode fleet grid (Figma frame 409:403, "Camera Tile").
// A translucent .dn-card laid out horizontally: thumbnail (with a status badge
// overlay) on the left, identity + meta + a mini-stats strip + an action row on
// the right. The bucket (live|review|offline|idle) is derived once in the grid
// and threaded down here so labels, badge color, and the primary action all
// stay consistent with the chips + summary tiles.
//
// Honest-data note: the card deliberately does NOT fetch per-camera snapshots
// or telemetry. There is no fleet-level reliability/events/uptime list
// endpoint, so the mini-stats render "—" placeholders (matching the Figma's
// own "--%" idle card and the illustrative Home tiles). The full snapshot +
// real reliability live on the camera detail page.

function formatSpec(c: Camera): string {
  const parts: string[] = [];
  if (c.default_width && c.default_height)
    parts.push(`${c.default_width}×${c.default_height}`);
  if (c.default_fps) parts.push(`${c.default_fps} fps`);
  if (c.default_codec) parts.push(c.default_codec);
  // Bitrate is intentionally omitted — it's shown in full on the Settings tab.
  return parts.length ? parts.join(" · ") : "—";
}

// Read a free-text location from the camera's open-vocabulary metadata blob.
function locationOf(c: Camera): string | null {
  const loc = c.metadata?.location;
  return typeof loc === "string" && loc.trim() ? loc : null;
}

// Per-bucket primary action. live/review → manage; idle → configure;
// offline → troubleshoot. review/offline add an accent ring (Figma).
const ACTION: Record<
  CameraBucket,
  { label: string; Icon: typeof Video; ring?: string }
> = {
  live: { label: "Manage Camera", Icon: Video },
  review: { label: "Manage Camera", Icon: Video, ring: "var(--dn-orange)" },
  offline: {
    label: "Troubleshoot Camera",
    Icon: Wrench,
    ring: "var(--dn-red)",
  },
  idle: { label: "Configure", Icon: Cog },
};

function MiniStat({
  caption,
  value,
  range,
}: {
  caption: string;
  value: string;
  range: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-center">
      <span className="truncate text-[clamp(0.6rem,0.72vw,0.7rem)] font-bold text-[var(--dn-text-50)]">
        {caption}
      </span>
      <span className="font-bold leading-none text-[clamp(0.95rem,1.2vw,1.15rem)] text-white">
        {value}
      </span>
      <span className="text-[clamp(0.55rem,0.66vw,0.65rem)] font-bold text-[var(--dn-text-40)]">
        {range}
      </span>
    </div>
  );
}

function MetaLine({
  children,
  muted = true,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <p
      className={`truncate text-[clamp(0.72rem,0.9vw,0.82rem)] font-bold ${
        muted ? "text-[var(--dn-text-50)]" : "text-white"
      }`}
    >
      {children}
    </p>
  );
}

export function CameraCard({
  camera,
  agentName,
  bucket,
  lastHeartbeat,
  previewSrc,
  list = false,
}: {
  camera: Camera;
  agentName: string;
  bucket: CameraBucket;
  // The owning agent's last_seen_at, used as an honest heartbeat proxy. Null
  // when unassigned or never seen → rendered as "—".
  lastHeartbeat?: string | null;
  // Optional still for the thumbnail slot (demo supplies the warehouse frame).
  previewSrc?: string;
  // Compact one-line list row vs. the default 2-up grid card.
  list?: boolean;
}) {
  const meta = BUCKET_META[bucket];
  const action = ACTION[bucket];
  const location = locationOf(camera);
  const detailHref = `/cameras/${camera.id}`;
  const settingsHref = `/cameras/${camera.id}/settings`;

  const thumb = (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[var(--dn-radius-inner)] bg-[rgba(255,255,255,0.15)] backdrop-blur-sm bg-cover bg-center ${
        list
          ? "h-[clamp(72px,9vw,96px)] w-[clamp(96px,12vw,128px)]"
          : // Grid tile: a square preview that fills the card's full height — the
            // card's height is set by the info column, the square follows it.
            "w-full aspect-square sm:h-full sm:w-auto"
      } grid place-items-center`}
      style={previewSrc ? { backgroundImage: `url(${previewSrc})` } : undefined}
    >
      {previewSrc ? null : (
        <ImageIcon
          className="text-white/85"
          style={{ width: "clamp(28px,3.4vw,52px)", height: "clamp(28px,3.4vw,52px)" }}
          strokeWidth={1.75}
          aria-hidden
        />
      )}
      {/* Status badge overlay (top-left) */}
      <span
        className="absolute left-2 top-2 rounded-[var(--dn-radius-inner)] px-2.5 py-1 text-[clamp(0.62rem,0.8vw,0.78rem)] font-bold text-white shadow-sm"
        style={{ background: meta.badgeBg }}
      >
        {meta.badgeLabel}
      </span>
      {/* Decorative add-region affordance (bottom-right) */}
      {!list && (
        <ScanLine
          className="absolute bottom-2 right-2 h-5 w-5 text-white/80"
          strokeWidth={1.75}
          aria-hidden
        />
      )}
    </div>
  );

  const heartbeatProxyAvailable =
    camera.agent_id !== null && Boolean(lastHeartbeat);

  return (
    <article
      className={`dn-card p-[clamp(0.9rem,1.4vw,1.4rem)] ${
        list
          ? "flex flex-row items-center gap-[clamp(0.9rem,1.6vw,1.4rem)]"
          : "flex flex-col gap-[clamp(0.8rem,1.2vw,1.1rem)] sm:flex-row"
      }`}
    >
      {/* shrink-0 with no width on the grid tile: the square thumb (h-full +
          aspect-square) derives its own width from the card height. */}
      <div className="shrink-0">{thumb}</div>

      <div className="flex min-w-0 flex-1 flex-col gap-[clamp(0.6rem,1vw,0.85rem)]">
        <div className="min-w-0">
          <h3 className="truncate font-bold text-[clamp(1.05rem,1.5vw,1.35rem)] text-white">
            {camera.name}
          </h3>
          <div className="mt-1 flex flex-col gap-0.5">
            <MetaLine>{agentName}</MetaLine>
            <MetaLine muted={false}>{formatSpec(camera)}</MetaLine>
            <MetaLine>{location ?? "—"}</MetaLine>
            <MetaLine>
              {heartbeatProxyAvailable ? (
                <>
                  Last heartbeat <RelativeTime value={lastHeartbeat} />
                </>
              ) : (
                "Last heartbeat —"
              )}
            </MetaLine>
          </div>
        </div>

        {/* Mini-stats — honest placeholders (no fleet telemetry endpoint). */}
        {!list && (
          <div className="flex items-stretch rounded-[var(--dn-radius-inner)] bg-[rgba(255,255,255,0.15)] backdrop-blur-sm py-2">
            <MiniStat caption="Reliability" value="—" range="7d" />
            <div className="w-px self-stretch bg-white/15" aria-hidden />
            <MiniStat caption="Events" value="—" range="7d" />
            <div className="w-px self-stretch bg-white/15" aria-hidden />
            <MiniStat caption="Uptime" value="—" range="7d" />
          </div>
        )}

        {/* Action row */}
        <div className="mt-auto flex items-center gap-2">
          <Link
            href={detailHref}
            className="dn-glow-soft inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--dn-radius-inner)] bg-[rgba(255,255,255,0.15)] px-3 py-[clamp(0.45rem,0.7vw,0.7rem)] font-bold text-white transition hover:bg-[rgba(255,255,255,0.24)]"
            style={
              action.ring
                ? { border: `2px solid ${action.ring}` }
                : undefined
            }
          >
            <action.Icon className="relative z-10 h-4 w-4" aria-hidden />
            <span className="relative z-10 truncate text-[clamp(0.78rem,0.95vw,0.95rem)]">
              {action.label}
            </span>
          </Link>
          <Link
            href={settingsHref}
            aria-label={`${camera.name} settings`}
            className="dn-glow-soft grid h-[clamp(2.1rem,3vw,2.6rem)] w-[clamp(2.1rem,3vw,2.6rem)] shrink-0 place-items-center rounded-[var(--dn-radius-inner)] bg-[rgba(255,255,255,0.15)] text-white transition hover:bg-[rgba(255,255,255,0.24)]"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
