"use client";

import { useEffect, useState } from "react";
import { StatusDot, type DotStatus } from "./status-dot";
import {
  PLAYER_STATE_EVENT,
  type PlayerStateEventDetail,
  type PlayerStateKind,
} from "@/components/stream/player-state-event";
import { useDemoMode } from "@/lib/demo/demo-mode-context";

// Light-theme port of src/components/stream/camera-stream-status-badge.tsx.
//
// The DB column `cameras.status` flips to "streaming" the moment MediaMTX
// accepts the SRT publish, but the dashboard's WebRTC player needs another
// 1-3 seconds to complete the WHEP handshake + first keyframe. During that
// gap a plain status badge says "streaming" above a "Connecting…" video.
// This component bridges: while DB says "streaming" but the player hasn't
// dispatched `connected`, we display "connecting" instead.
//
// Listeners filter by `cameraId` because the event is window-scoped — two
// tabs on different cameras share the same window.

type Display =
  | "streaming"
  | "connecting"
  | "idle"
  | "error"
  | "disabled"
  | string;

const DOT: Partial<Record<string, DotStatus>> = {
  streaming: "green",
  connecting: "yellow",
  idle: "neutral",
  error: "red",
  disabled: "neutral",
};
const TEXT: Partial<Record<string, string>> = {
  streaming: "#3f7d4e",
  connecting: "#8a6d1f",
  idle: "var(--dn-text-50)",
  error: "#c0473b",
  disabled: "var(--dn-text-50)",
};

export function CameraStreamStatusBadgeNext({
  cameraId,
  initialStatus,
}: {
  cameraId: string;
  initialStatus: string;
}) {
  const [playerKind, setPlayerKind] = useState<PlayerStateKind | null>(null);
  const [prevStatus, setPrevStatus] = useState(initialStatus);

  // Reset cached player state whenever the page leaves the streaming state.
  // Calling setState during render is React 19's recommended pattern for
  // prop-driven state resets.
  if (initialStatus !== prevStatus) {
    setPrevStatus(initialStatus);
    if (initialStatus !== "streaming") {
      setPlayerKind(null);
    }
  }

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<PlayerStateEventDetail>).detail;
      if (detail.cameraId !== cameraId) return;
      setPlayerKind(detail.kind);
    };
    window.addEventListener(PLAYER_STATE_EVENT, handler);
    return () => window.removeEventListener(PLAYER_STATE_EVENT, handler);
  }, [cameraId]);

  // In demo mode there's no WHEP handshake, so don't bridge "streaming" →
  // "connecting" (the player loops a local clip; no `connected` event arrives
  // on the cameras list at all). Just show the DB status.
  const demo = useDemoMode();
  const display: Display =
    !demo &&
    initialStatus === "streaming" &&
    playerKind !== "connected"
      ? "connecting"
      : initialStatus;

  const dot = DOT[display] ?? "neutral";
  const color = TEXT[display] ?? "var(--dn-text-50)";

  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <StatusDot status={dot} />
      <span
        className="font-bold capitalize text-[clamp(0.78rem,1vw,0.95rem)]"
        style={{ color }}
      >
        {display}
      </span>
    </span>
  );
}
