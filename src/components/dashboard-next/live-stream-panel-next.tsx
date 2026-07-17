import type { ReactNode } from "react";
import { Radio } from "lucide-react";
import clsx from "clsx";
import type { LatestFrame, StreamSession } from "@/lib/api/types";
import { LiveStreamPlayerNext } from "./live-stream-player-next";

// Light-theme port of src/components/stream/live-stream-panel.tsx. Picks the
// right rendering for the session's current state: missing, waiting, live,
// or terminal. Server Component — only the player itself is client-side.
//
// When the camera is NOT streaming, the last captured frame (if any) backs the
// state message as a key image. A standalone latest-frame card was removed from
// this tab once before as "redundant with the live stream" — that objection only
// ever held while video was playing, which is exactly when this doesn't render.

function StreamState({
  tone = "muted",
  title,
  capitalizeTitle = false,
  children,
  latestFrame,
}: {
  tone?: "muted" | "live";
  title: string;
  // The terminal state interpolates a lowercase session state into the title.
  capitalizeTitle?: boolean;
  children: ReactNode;
  latestFrame?: LatestFrame | null;
}) {
  const message = (
    <div className="text-center">
      <Radio
        className={
          tone === "live"
            ? "w-7 h-7 mx-auto text-[#5fb869]"
            : "w-7 h-7 mx-auto text-[var(--dn-text-50)]"
        }
        aria-hidden
      />
      <h3
        className={clsx(
          "font-bold text-[clamp(1rem,1.4vw,1.3rem)] mt-3",
          capitalizeTitle && "capitalize",
        )}
      >
        {title}
      </h3>
      <p className="text-sm text-[var(--dn-text-50)] mt-2 max-w-md mx-auto">
        {children}
      </p>
    </div>
  );

  if (!latestFrame) {
    return (
      <div className="dn-tile p-[clamp(1.5rem,3vw,2.5rem)]">{message}</div>
    );
  }

  // Key image + why there's no live video, in one tile. The signed URL is
  // minted per render (60s TTL); the layout's Realtime listener re-renders this
  // page on session transitions, so a shown frame is never many minutes stale.
  //
  // min-h floors the frame box at the message's own height: the message is
  // absolutely positioned and the tile clips, so a wide/short frame (or a
  // narrow viewport) would otherwise scale the image below the text and cut it
  // off. The image is centered/cropped rather than stretched so the floor never
  // distorts its aspect ratio.
  return (
    <div className="dn-tile overflow-hidden">
      <div className="relative bg-black min-h-[clamp(200px,22vw,300px)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={latestFrame.signed_url}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        {/* Scrim. The body copy is --dn-text-50 = rgba(255,255,255,0.5); over a
            blown-out frame (a daylight doorway) the image's own 40% opacity
            leaves it at 2.7:1, well under WCAG AA 4.5. This floors the backdrop
            so the copy holds regardless of what the camera was looking at:
            measured worst case across the full tonal range is 4.80:1 at /60
            (/50 only reaches 4.43 and still fails on highlights). Same
            treatment the player uses for text over live video — see
            live-stream-player-next.tsx. */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />
        <div className="relative flex min-h-[clamp(200px,22vw,300px)] items-center justify-center p-[clamp(1rem,2vw,2rem)]">
          {message}
        </div>
      </div>
      <div className="px-4 py-3 text-[12px] text-[var(--dn-text-50)] flex items-center justify-between gap-3 font-mono">
        <span>last frame</span>
        <span>
          {latestFrame.width && latestFrame.height
            ? `${latestFrame.width}×${latestFrame.height}`
            : "—"}
        </span>
      </div>
    </div>
  );
}

export function LiveStreamPanelNext({
  session,
  renderStreaming,
  latestFrame = null,
}: {
  session: StreamSession | null;
  // Optional override for the `streaming` state. Lets a caller wrap the live
  // player (e.g. the perception overlay) without this panel needing to know
  // anything about perception — it still owns the session-state → UI mapping
  // for every other state. Mirrors the legacy panel's renderStreaming prop.
  renderStreaming?: (session: StreamSession) => ReactNode;
  // Last captured frame, used as the key image behind every non-streaming
  // state. Null (the default) reproduces the original icon-only empty states.
  latestFrame?: LatestFrame | null;
}) {
  if (!session) {
    return (
      <StreamState title="No session yet" latestFrame={latestFrame}>
        When the agent calls{" "}
        <span className="font-mono text-white/80">
          POST /v1/stream-sessions/start
        </span>{" "}
        and begins publishing, live video appears here.
      </StreamState>
    );
  }

  if (session.state === "approved") {
    return (
      <StreamState tone="live" title="Waiting for stream" latestFrame={latestFrame}>
        The session is approved but the agent hasn&rsquo;t started publishing
        yet. Live video appears here as soon as the SRT publish is accepted.
      </StreamState>
    );
  }

  if (session.state === "streaming") {
    if (renderStreaming) return <>{renderStreaming(session)}</>;
    return (
      <LiveStreamPlayerNext
        sessionId={session.id}
        cameraId={session.camera_id}
        approved={session.approved}
      />
    );
  }

  // ended | expired | failed
  return (
    <StreamState
      title={`Stream ${session.state}`}
      capitalizeTitle
      latestFrame={latestFrame}
    >
      {session.state === "failed"
        ? "The last session failed validation. Check the validation panel for the mismatched fields."
        : "Live video will return when the agent starts a new session."}
    </StreamState>
  );
}
