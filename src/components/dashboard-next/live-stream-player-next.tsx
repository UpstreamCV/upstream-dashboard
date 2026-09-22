"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, Play, Radio, RefreshCw } from "lucide-react";
import { reportError } from "@/lib/error";
import type { StreamParams } from "@/lib/api/types";
import {
  WhepNotFoundError,
  closeWhepSession,
  connectWhep,
} from "@/lib/webrtc/whep-client";
import { dispatchPlayerState } from "@/components/stream/player-state-event";
import { useDemoMode } from "@/lib/demo/demo-mode-context";
import { DemoVideo } from "@/lib/demo/demo-video";

// Light-theme port of src/components/stream/live-stream-player.tsx. The
// WebRTC / WHEP connection logic is preserved verbatim — backoff schedule,
// visibility/bfcache teardown, gesture-play fallback, player-state event
// broadcast for cross-component status mirroring. Only the JSX shell and
// overlay are restyled for the dashboard-next light theme (white .dn-tile
// frame, dark overlay reads on black video).
//
// The video element keeps its dark backdrop because video frames live on
// black — that matches the existing dashboard.

type PlayerState =
  | { kind: "connecting" }
  | { kind: "connected" }
  | { kind: "reconnecting"; nextAttemptInMs: number }
  | { kind: "failed"; reason: string }
  | { kind: "needs-gesture" }
  | { kind: "unsupported" };

const BACKOFF_SCHEDULE_MS = [500, 1_000, 2_000, 4_000, 8_000];

export function LiveStreamPlayerNext({
  demoClip,
  ...props
}: {
  sessionId: string;
  cameraId: string;
  approved: StreamParams;
  overlay?: React.ReactNode;
  // Demo-only: which clip the looping demo video should show — the raw "clean"
  // feed before detection is set up, then the annotated strong/weak output.
  demoClip?: "clean" | "weak" | "strong";
}) {
  // Demo mode: skip WHEP entirely — loop the local clip with the overlay on top.
  const demo = useDemoMode();
  if (demo) {
    return (
      <DemoVideo
        approved={props.approved}
        overlay={props.overlay}
        cameraId={props.cameraId}
        clip={demoClip}
      />
    );
  }
  return <RealLiveStreamPlayerNext {...props} />;
}

function RealLiveStreamPlayerNext({
  sessionId,
  cameraId,
  approved,
  overlay,
}: {
  sessionId: string;
  cameraId: string;
  approved: StreamParams;
  // Optional visual layer drawn over the video (perception overlay). Generic
  // on purpose — the player knows nothing about perception; it just stacks
  // this absolutely over the <video>, beneath the connection-state scrim, and
  // never lets it intercept pointer events. Mirrors the legacy player's
  // `overlay` slot in src/components/stream/live-stream-player.tsx.
  overlay?: React.ReactNode;
}) {
  // WHEP signaling goes through /api/upstream/* so the api-server enforces
  // account-scoped auth. Same-origin relative URL — no mixed-content risk.
  const whepUrl = useMemo(
    () => `/api/upstream/v1/stream-sessions/${sessionId}/whep`,
    [sessionId],
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const resourceUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const backoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);
  const [manualRetryKey, setManualRetryKey] = useState(0);

  const [state, setState] = useState<PlayerState>(() => {
    if (typeof RTCPeerConnection === "undefined") return { kind: "unsupported" };
    return { kind: "connecting" };
  });

  // Broadcast every state change so listeners outside this subtree (the
  // detail header's badge) can mirror live viewer state instead of just the
  // upstream session-state DB column. Listeners filter on cameraId — the
  // event is window-scoped and other camera tabs share the same window.
  useEffect(() => {
    dispatchPlayerState({ cameraId, kind: state.kind });
  }, [cameraId, state.kind]);

  const teardown = useCallback(() => {
    if (backoffTimerRef.current) {
      clearTimeout(backoffTimerRef.current);
      backoffTimerRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.ontrack = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    closeWhepSession(resourceUrlRef.current);
    resourceUrlRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (state.kind === "unsupported") {
      return () => {
        mountedRef.current = false;
      };
    }

    let cancelled = false;

    const scheduleReconnect = (reason: string) => {
      if (cancelled || !mountedRef.current) return;
      const attempt = attemptRef.current;
      if (attempt >= BACKOFF_SCHEDULE_MS.length) {
        setState({ kind: "failed", reason });
        return;
      }
      const delay = BACKOFF_SCHEDULE_MS[attempt];
      attemptRef.current = attempt + 1;
      setState({ kind: "reconnecting", nextAttemptInMs: delay });
      backoffTimerRef.current = setTimeout(() => {
        backoffTimerRef.current = null;
        void attempt$();
      }, delay);
    };

    const attempt$ = async () => {
      if (cancelled || !mountedRef.current) return;
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      closeWhepSession(resourceUrlRef.current);
      resourceUrlRef.current = null;

      const controller = new AbortController();
      abortRef.current = controller;
      setState({ kind: "connecting" });

      try {
        const { pc, stream, resourceUrl } = await connectWhep({
          url: whepUrl,
          signal: controller.signal,
        });
        if (cancelled || !mountedRef.current) {
          pc.close();
          closeWhepSession(resourceUrl);
          return;
        }
        pcRef.current = pc;
        resourceUrlRef.current = resourceUrl;

        pc.oniceconnectionstatechange = () => {
          const s = pc.iceConnectionState;
          if (s === "connected" || s === "completed") {
            attemptRef.current = 0;
            if (mountedRef.current) setState({ kind: "connected" });
          } else if (s === "failed" || s === "disconnected") {
            scheduleReconnect(`ice ${s}`);
          }
        };

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          try {
            await video.play();
          } catch (err) {
            if (mountedRef.current) {
              setState({ kind: "needs-gesture" });
            }
            reportError(err, {
              area: "dashboard/live-stream-player",
              phase: "autoplay",
            });
          }
        }
      } catch (err) {
        if (cancelled || !mountedRef.current) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof WhepNotFoundError) {
          scheduleReconnect("path not ready");
          return;
        }
        reportError(err, {
          area: "dashboard/live-stream-player",
          phase: "connect",
        });
        scheduleReconnect(err instanceof Error ? err.message : String(err));
      }
    };

    void attempt$();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      teardown();
    };
    // The mutable refs used inside (attemptRef, mountedRef, pcRef,
    // resourceUrlRef, abortRef, backoffTimerRef) and the stable callback
    // `teardown` deliberately do NOT trigger this effect — they don't drive
    // re-renders, and adding them to the deps array would re-run the WHEP
    // negotiation on every state change. Only whepUrl (session id changes)
    // and manualRetryKey (user clicked Retry / tab became visible again)
    // should reconnect from scratch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whepUrl, manualRetryKey]);

  // Tear down when the tab is hidden; reconnect on visibility-return. Also
  // handle bfcache pagehide.
  useEffect(() => {
    if (state.kind === "unsupported") return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        teardown();
      } else {
        attemptRef.current = 0;
        setManualRetryKey((k) => k + 1);
      }
    };
    const onPageHide = () => {
      teardown();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [state.kind, teardown]);

  const handleManualRetry = useCallback(() => {
    attemptRef.current = 0;
    setManualRetryKey((k) => k + 1);
  }, []);

  const handleGesturePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    void video
      .play()
      .then(() => {
        if (mountedRef.current) setState({ kind: "connected" });
      })
      .catch((err) => {
        reportError(err, {
          area: "dashboard/live-stream-player",
          phase: "gesture-play",
        });
      });
  }, []);

  if (state.kind === "unsupported") {
    return (
      <PlayerShell>
        <div className="px-6 py-10 text-center">
          <AlertTriangle className="w-7 h-7 mx-auto text-[var(--dn-text-50)]" />
          <h3 className="font-bold text-lg mt-3">WebRTC unavailable</h3>
          <p className="text-sm text-[var(--dn-text-50)] mt-2 max-w-md mx-auto">
            This browser doesn&rsquo;t expose{" "}
            <span className="font-mono">RTCPeerConnection</span>. Try the latest
            Chrome, Firefox, or Safari.
          </p>
        </div>
      </PlayerShell>
    );
  }

  const showOverlay =
    state.kind === "connecting" ||
    state.kind === "reconnecting" ||
    state.kind === "failed" ||
    state.kind === "needs-gesture";

  return (
    <PlayerShell>
      <div className="relative bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-auto block aspect-video"
        />
        {overlay ? (
          // Sits between the video and the connection-state scrim. Later
          // siblings stack on top in HTML, so the scrim still wins when both
          // are visible (e.g. "Reconnecting…" must occlude the perception SVG).
          <div className="pointer-events-none absolute inset-0">{overlay}</div>
        ) : null}
        {showOverlay ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <Overlay
              state={state}
              onRetry={handleManualRetry}
              onPlay={handleGesturePlay}
            />
          </div>
        ) : null}
      </div>
      <div className="px-4 py-3 text-[12px] flex items-center justify-between gap-3 font-mono text-[var(--dn-text-50)]">
        <span className="flex items-center gap-2">
          <StatusDot state={state} />
          <span>{statusLabel(state)}</span>
        </span>
        <span>
          {approved.width}×{approved.height} · {approved.fps} fps ·{" "}
          {approved.codec} · {approved.bitrate_kbps} kbps
        </span>
      </div>
    </PlayerShell>
  );
}

function PlayerShell({ children }: { children: React.ReactNode }) {
  return <div className="dn-tile overflow-hidden">{children}</div>;
}

function StatusDot({ state }: { state: PlayerState }) {
  const color =
    state.kind === "connected"
      ? "#5fb869"
      : state.kind === "failed"
        ? "#e15a4c"
        : "#9aa39a";
  const pulse = state.kind === "connected" ? "animate-pulse" : "";
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${pulse}`}
      style={{ background: color }}
      aria-hidden
    />
  );
}

function statusLabel(state: PlayerState): string {
  switch (state.kind) {
    case "connected":
      return "live";
    case "connecting":
      return "connecting…";
    case "reconnecting":
      return `reconnecting in ${Math.round(state.nextAttemptInMs / 100) / 10}s…`;
    case "failed":
      return "disconnected";
    case "needs-gesture":
      return "tap to play";
    case "unsupported":
      return "unsupported";
  }
}

function Overlay({
  state,
  onRetry,
  onPlay,
}: {
  state: PlayerState;
  onRetry: () => void;
  onPlay: () => void;
}) {
  if (state.kind === "connecting") {
    return (
      <div className="text-center text-white/85">
        <Loader2 className="w-7 h-7 mx-auto animate-spin text-[#5fb869]" />
        <p className="text-sm mt-2">Connecting…</p>
      </div>
    );
  }
  if (state.kind === "reconnecting") {
    return (
      <div className="text-center text-white/85">
        <Radio className="w-7 h-7 mx-auto text-white/65" />
        <p className="text-sm mt-2">
          Reconnecting in {Math.round(state.nextAttemptInMs / 100) / 10}s…
        </p>
      </div>
    );
  }
  if (state.kind === "failed") {
    return (
      <div className="text-center text-white/85 max-w-xs">
        <AlertTriangle className="w-7 h-7 mx-auto text-[#e89e93]" />
        <p className="text-sm mt-2 mb-3">
          Couldn&rsquo;t connect to the stream.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 border border-white/25 text-sm text-white hover:bg-white/25 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    );
  }
  if (state.kind === "needs-gesture") {
    return (
      <button
        type="button"
        onClick={onPlay}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#5fb869] text-white font-bold hover:brightness-110 transition"
      >
        <Play className="w-4 h-4" />
        Tap to play
      </button>
    );
  }
  return null;
}
