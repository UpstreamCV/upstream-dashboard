"use client";

import { useEffect } from "react";
import type { StreamParams } from "@/lib/api/types";
import { dispatchPlayerState } from "@/components/stream/player-state-event";

// Demo-mode stand-in for the WHEP live player. Loops the local warehouse clip
// (public/demo/dock-loop.mp4) and keeps the player's `overlay` slot so the
// perception SVG (line + detection boxes) still composites on top. Mirrors the
// real player's white .dn-tile shell + "live" status row so it reads identically
// on camera. No WebRTC, no network.
export function DemoVideo({
  approved,
  overlay,
  cameraId,
  clip = "strong",
}: {
  approved: StreamParams;
  overlay?: React.ReactNode;
  cameraId: string;
  // Which clip to loop: the raw "clean" feed (no boxes — before any detection is
  // set up), or an annotated demo-cv-model output — the high-recall model
  // ("strong") or the weaker baseline that misses detections ("weak").
  clip?: "clean" | "weak" | "strong";
}) {
  // No WHEP handshake in demo mode — announce "connected" so the status badge
  // and overlay chip don't sit on "connecting" forever.
  useEffect(() => {
    dispatchPlayerState({ cameraId, kind: "connected" });
  }, [cameraId]);

  return (
    <div className="dn-tile overflow-hidden">
      <div className="relative bg-black">
        <video
          key={clip}
          src={
            clip === "clean"
              ? "/demo/dock-loop-clean.mp4"
              : clip === "weak"
                ? "/demo/dock-loop-weak.mp4"
                : "/demo/dock-loop.mp4"
          }
          poster="/demo/dock-frame.jpg"
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-auto block aspect-video"
        />
        {overlay ? (
          <div className="pointer-events-none absolute inset-0">{overlay}</div>
        ) : null}
      </div>
      <div className="px-4 py-3 text-[12px] flex items-center justify-between gap-3 font-mono text-[var(--dn-text-50)]">
        <span className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full animate-pulse"
            style={{ background: "#5fb869" }}
            aria-hidden
          />
          <span>live</span>
        </span>
        <span>
          {approved.width}×{approved.height} · {approved.fps} fps ·{" "}
          {approved.codec} · {approved.bitrate_kbps} kbps
        </span>
      </div>
    </div>
  );
}
