"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/data/status-badge";
import {
  PLAYER_STATE_EVENT,
  type PlayerStateEventDetail,
  type PlayerStateKind,
} from "./player-state-event";

/**
 * Camera status badge that mirrors the live viewer experience.
 *
 * The plain `<StatusBadge status={camera.status} />` flips to
 * "streaming" the moment the api-server marks `cameras.status =
 * 'streaming'` — which happens when MediaMTX accepts the SRT publish,
 * not when the dashboard's WebRTC player has actually rendered the
 * first frame. The two events are 1–3 s apart (WHEP handshake + ICE +
 * first-keyframe wait), and during that gap the user sees a confusing
 * "Streaming" badge above a "Connecting…" video pane.
 *
 * This component bridges the gap: when DB says "streaming" but the
 * WebRTC player hasn't broadcast `connected` yet, we render
 * "connecting" instead. Once the player flips to `connected`, the
 * badge flips to "streaming". For every other status value
 * (idle/error/disabled/etc.) we pass through unchanged.
 *
 * Initial-render note: on first paint we have the server-rendered
 * `initialStatus` but no player-state event yet. If `initialStatus`
 * is "streaming" we still need to decide what to show. The player
 * dispatches `connecting` synchronously inside its mount effect, so
 * by the first paint after hydration the listener will already have
 * seen `connecting` — but to avoid a flicker on slower devices we
 * default the local state to "not-yet-connected" while
 * `initialStatus === 'streaming'`.
 */
export function CameraStreamStatusBadge({
  initialStatus,
}: {
  initialStatus: string;
}) {
  const [playerKind, setPlayerKind] = useState<PlayerStateKind | null>(null);
  const [prevStatus, setPrevStatus] = useState(initialStatus);

  // Reset the cached player state whenever the page leaves the streaming
  // state. The player has just unmounted; we want the next live session
  // to start from "connecting" instead of inheriting the prior session's
  // final "connected". Reset is done during render (React 19's
  // recommended pattern for prop-driven state resets) — calling
  // setPlayerKind during render schedules an immediate re-render before
  // the browser sees the stale value.
  if (initialStatus !== prevStatus) {
    setPrevStatus(initialStatus);
    if (initialStatus !== "streaming") {
      setPlayerKind(null);
    }
  }

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<PlayerStateEventDetail>).detail;
      setPlayerKind(detail.kind);
    };
    window.addEventListener(PLAYER_STATE_EVENT, handler);
    return () => window.removeEventListener(PLAYER_STATE_EVENT, handler);
  }, []);

  const displayStatus =
    initialStatus === "streaming" && playerKind !== "connected"
      ? "connecting"
      : initialStatus;

  return <StatusBadge status={displayStatus} />;
}
