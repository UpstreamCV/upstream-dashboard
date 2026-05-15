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
import { dispatchPlayerState } from "./player-state-event";

type PlayerState =
  | { kind: "connecting" }
  | { kind: "connected" }
  | { kind: "reconnecting"; nextAttemptInMs: number }
  | { kind: "failed"; reason: string }
  | { kind: "needs-gesture" }
  | { kind: "unsupported" };

const BACKOFF_SCHEDULE_MS = [500, 1_000, 2_000, 4_000, 8_000];

export function LiveStreamPlayer({
  sessionId,
  cameraId,
  approved,
}: {
  sessionId: string;
  // The camera this player is rendering. Carried through so the
  // window-scoped `upstream:player-state` event can be filtered by
  // listeners — without it a multi-tab user would see one tab's
  // "connected" event flip another tab's status badge.
  cameraId: string;
  approved: StreamParams;
}) {
  // WHEP signaling goes through the dashboard's `/api/upstream/*` proxy so
  // the api-server can enforce account-scoped read auth. Same-origin
  // relative URL — no mixed-content risk.
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

  // Broadcast every state change so listeners outside this subtree (today:
  // the camera detail header's status badge) can mirror the live viewer
  // experience instead of just the upstream session-state DB column.
  // Listeners filter on `cameraId` — the event is window-scoped and other
  // open camera tabs share the same window.
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
      // Reset any prior connection before negotiating a new one.
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
          // `closed` means we tore down — no action.
        };

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          try {
            await video.play();
          } catch (err) {
            // iOS Safari blocks autoplay even with muted in some configurations.
            // Surface a tap-to-play overlay; the user gesture re-attempts play.
            if (mountedRef.current) {
              setState({ kind: "needs-gesture" });
            }
            reportError(err, { area: "live-stream-player", phase: "autoplay" });
          }
        }
      } catch (err) {
        if (cancelled || !mountedRef.current) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof WhepNotFoundError) {
          // Path not yet registered in MediaMTX even though the api-server
          // flipped the session to streaming. This is the common race; retry.
          scheduleReconnect("path not ready");
          return;
        }
        reportError(err, { area: "live-stream-player", phase: "connect" });
        // Network errors and non-404 4xx/5xx from the api-server proxy:
        // retry on the same backoff. Auth failures (401 from the proxy when
        // the Supabase session expired) will fail-then-retry until the
        // schedule exhausts; the next CameraDetailRealtime broadcast will
        // re-render the page in the right state.
        scheduleReconnect(err instanceof Error ? err.message : String(err));
      }
    };

    void attempt$();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      teardown();
    };
    // whepUrl / manualRetryKey trigger a full reconnect from scratch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whepUrl, manualRetryKey]);

  // Tear down when the tab is hidden; reconnect on visibility-return.
  // Also handle bfcache pagehide.
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
        reportError(err, { area: "live-stream-player", phase: "gesture-play" });
      });
  }, []);

  if (state.kind === "unsupported") {
    return (
      <PlayerShell>
        <div className="px-6 py-10 text-center">
          <AlertTriangle className="w-7 h-7 mx-auto text-ink-mute" />
          <h3 className="display text-lg font-semibold mt-3">
            WebRTC <em>unavailable</em>
          </h3>
          <p className="text-sm text-ink-soft mt-2 max-w-md mx-auto">
            This browser doesn&rsquo;t expose <span className="mono">RTCPeerConnection</span>.
            Try the latest Chrome, Firefox, or Safari.
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
      <div className="relative bg-[#0f1809]">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-auto block aspect-video"
        />
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
      <div className="px-4 py-3 text-[12px] text-ink-soft flex items-center justify-between gap-3 mono">
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
  return <div className="glass rounded-3xl overflow-hidden">{children}</div>;
}

function StatusDot({ state }: { state: PlayerState }) {
  const color =
    state.kind === "connected"
      ? "bg-accent"
      : state.kind === "failed"
        ? "bg-[#e89e93]"
        : "bg-ink-mute";
  const pulse = state.kind === "connected" ? "animate-pulse" : "";
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${color} ${pulse}`}
      aria-hidden="true"
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
      <div className="text-center text-ink-soft">
        <Loader2 className="w-7 h-7 mx-auto animate-spin text-accent" />
        <p className="text-sm mt-2">Connecting…</p>
      </div>
    );
  }
  if (state.kind === "reconnecting") {
    return (
      <div className="text-center text-ink-soft">
        <Radio className="w-7 h-7 mx-auto text-ink-mute" />
        <p className="text-sm mt-2">
          Reconnecting in {Math.round(state.nextAttemptInMs / 100) / 10}s…
        </p>
      </div>
    );
  }
  if (state.kind === "failed") {
    return (
      <div className="text-center text-ink-soft max-w-xs">
        <AlertTriangle className="w-7 h-7 mx-auto text-[#e89e93]" />
        <p className="text-sm mt-2 mb-3">
          Couldn&rsquo;t connect to the stream.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-glass-bg border border-ink-mute/30 text-sm text-ink hover:text-accent transition"
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
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent/90 text-[#0f1809] font-semibold hover:bg-accent transition"
      >
        <Play className="w-4 h-4" />
        Tap to play
      </button>
    );
  }
  return null;
}
