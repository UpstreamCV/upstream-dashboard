"use client";

import { useEffect, useMemo, useState } from "react";
import { Boxes, RefreshCw, Radio, Spline, Tag } from "lucide-react";
import clsx from "clsx";
import { UpstreamApiError } from "@/lib/api/errors";
import { useUpstreamList } from "@/lib/api/use-list";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client-lazy";
import type {
  LatestPerceptionRecord,
  LatestPerceptionResponse,
  StreamParams,
} from "@/lib/api/types";
import {
  CONFIDENCE_THRESHOLDS,
  buildLatestPerceptionPath,
  computeRealtimeGate,
  deriveOverlayConnectionState,
  formatCountdown,
  formatOverlayAge,
  hasFrameDimensions,
  isNewerPerceptionRecord,
  normalizeSnapshot,
  observedAtAgeSeconds,
  perceptionRecordFromRealtimeRow,
  perceptionRecordFromWsMessage,
  selectOverlayObjects,
  type OverlayConnectionMode,
  type RealtimeStatus,
} from "@/lib/perception/overlay-helpers";
import { connectPerceptionStream } from "@/lib/perception/perception-ws-client";
import { fetchPerceptionStreamToken } from "@/lib/api/perception-stream";
import { PerceptionOverlaySvg } from "@/lib/perception/overlay-svg";
import { useSmoothedDetections } from "@/lib/perception/use-smoothed-detections";
import {
  PLAYER_STATE_EVENT,
  type PlayerStateEventDetail,
  type PlayerStateKind,
} from "@/components/stream/player-state-event";
import { LiveStreamPlayerNext } from "./live-stream-player-next";
import { useDemoMode } from "@/lib/demo/demo-mode-context";
import { StatusDot, type DotStatus } from "./status-dot";
import { usePageVisible } from "./use-page-visible";
import {
  useLiveDetectionSession,
  type LiveDetectionSession,
  type LiveSessionStatus,
} from "./use-live-detection-session";

// Poll cadence. Polling is gated to an active live-detections session (see
// `shouldPoll`), so an off/hidden overlay makes no requests — but while a
// session IS active we always poll fast. Polling hits OUR API, not Supabase,
// so it costs nothing against the Supabase Free plan; the free-plan safety of
// M5 comes entirely from gating the realtime SUBSCRIPTION, not from slowing the
// poll. Realtime push is purely additive on top (sub-poll latency when it's
// actually delivering). We do NOT slow the poll just because the channel is
// SUBSCRIBED: a channel can report SUBSCRIBED yet deliver no events (e.g. the
// table isn't in the supabase_realtime publication in this environment), and
// slowing the poll there would make the overlay LESS live, not more.
const LIVE_OVERLAY_POLL_MS = 250;
// Demo mode poll cadence. Demo perception fixtures are STATIC per scene — the
// boxes/geometry never move between polls (only `observed_at` re-anchors, and
// the demo overlay hardcodes its age label to "just now"), and every scene
// transition already pushes fresh data via the stepper/demo-flow's
// router.refresh() (which re-seeds `initialPerception`). So the live 250ms
// cadence buys ZERO visual fidelity here while flooding the single-process dev
// server (~4 req/s, forever) and measurably starving navigation. Poll slowly,
// just to keep the SWR cache warm. Prod (non-demo) is untouched.
const DEMO_OVERLAY_POLL_MS = 10_000;
// A realtime row event seen within this window means the push path is actually
// delivering (not merely SUBSCRIBED) -> the chip can honestly say "connected".
const REALTIME_DELIVERING_WINDOW_MS = 8_000;
// A perception-fanout WS frame seen within this window means the 10-15 Hz hot
// path is carrying the overlay. Short on purpose: the moment the WS goes
// silent the 250ms poll must resume, and the gap between "last frame" and
// "poll back at full speed" is bounded by this window + one keep-warm tick.
const WS_DELIVERING_WINDOW_MS = 2_000;
// Poll cadence while the WS hot path is delivering. The poll never stops (it
// is how the overlay recovers if the WS dies between renders) but at 15 Hz
// push there is no point also polling at 4 req/s — downshift to a keep-warm
// tick and let the WS frames drive the cache.
const WS_KEEPWARM_POLL_MS = 2_000;

// Default age after which the snapshot is considered stale. A live processor
// publishes every ~0.3-1s, so anything older than ~10s almost certainly means
// the processor is silent or the camera stopped -- the overlay is no longer
// telling the truth about the current scene (and we stop opening Realtime).
const DEFAULT_STALE_AFTER_SECONDS = 10;

const SELECT_CLASS =
  "rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-sm text-white transition focus:border-[var(--dn-creek-mid)] focus:outline-none";

const CHIP_ACTIVE =
  "border-[var(--dn-creek-mid)]/40 bg-[var(--dn-creek-mid)]/15 text-[var(--dn-creek-deep)]";
const CHIP_INACTIVE =
  "border-white/10 bg-white/[0.06] text-[var(--dn-text-50)] hover:text-white hover:bg-white/[0.08]";
const PILL_BTN =
  "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-sm text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY_BTN =
  "inline-flex items-center gap-1.5 rounded-full bg-[var(--dn-creek-deep)] px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90";

// Connection chip presentation. The backend owns facts; the frontend owns hue.
const MODE_DOT: Record<OverlayConnectionMode, DotStatus> = {
  expired: "neutral",
  off: "neutral",
  processing_disabled: "neutral",
  stream_inactive: "yellow",
  processor_stale: "yellow",
  connecting: "yellow",
  ws_connected: "green",
  connected: "green",
  reconnecting: "yellow",
  fallback_polling: "yellow",
};
const TEXT_GREEN = "#3f7d4e";
const TEXT_WARN = "#8a6d1f";
const TEXT_MUTED = "var(--dn-text-50)";
const MODE_TEXT: Record<OverlayConnectionMode, string> = {
  expired: TEXT_MUTED,
  off: TEXT_MUTED,
  processing_disabled: TEXT_MUTED,
  stream_inactive: TEXT_WARN,
  processor_stale: TEXT_WARN,
  connecting: TEXT_WARN,
  ws_connected: TEXT_GREEN,
  connected: TEXT_GREEN,
  reconnecting: TEXT_WARN,
  fallback_polling: TEXT_WARN,
};

/**
 * Dashboard-next live perception overlay (P5-E + M5). Draws the latest P5-C
 * perception snapshot over the live WebRTC video by reusing the shared
 * <PerceptionOverlaySvg /> renderer + helpers, wrapping <LiveStreamPlayerNext />
 * and feeding the SVG into the player's `overlay` slot — one WebRTC connection
 * per session.
 *
 * M5 — Free-Plan-Safe Realtime Sessions: live detections are OFF by default.
 * The user opts into a 15-minute viewing session; only then (and only while the
 * stream is connected, processing is on, output is fresh, and the tab is
 * visible) do we open a Supabase Realtime subscription. Everything else falls
 * back to gated polling. The video preview always plays regardless.
 *
 * The overlay does NOT stream frame-synced metadata — see the disclaimer: the
 * in-browser boxes are a preview that may lag the video, while the processor's
 * detections/events are created from the actual camera stream.
 */
export function LivePerceptionOverlayNext({
  sessionId,
  cameraId,
  approved,
  initialPerception,
  // M3 master switch threaded down from the Monitor page. When false we never
  // open Realtime and the body shows "enable processing in Settings".
  processingEnabled = true,
  staleAfterSeconds = DEFAULT_STALE_AFTER_SECONDS,
  // Injectable so tests can pin a deterministic "now". Production uses Date.now.
  now = Date.now,
}: {
  sessionId: string;
  cameraId: string;
  approved: StreamParams;
  initialPerception: LatestPerceptionRecord | null;
  processingEnabled?: boolean;
  staleAfterSeconds?: number;
  now?: () => number;
}) {
  const [showBoxes, setShowBoxes] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showGeometry, setShowGeometry] = useState(true);
  const [minConfidence, setMinConfidence] = useState(0);

  // M5: the opt-in 15-minute live-detections session (defaults OFF).
  const session = useLiveDetectionSession(now);
  const liveDetectionsEnabled = session.status === "on";
  const isExpired = session.status === "expired";
  // Demo mode drives detections from the scene (no manual session / WHEP signal).
  const demo = useDemoMode();

  const pageVisible = usePageVisible();

  // Stream-active signal: the WebRTC player dispatches PLAYER_STATE_EVENT (the
  // same channel the status badge consumes). "connected" means the video is
  // actually playing in this browser — the truest "stream is live here" signal.
  const [playerKind, setPlayerKind] = useState<PlayerStateKind | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<PlayerStateEventDetail>).detail;
      if (detail.cameraId !== cameraId) return;
      setPlayerKind(detail.kind);
    };
    window.addEventListener(PLAYER_STATE_EVENT, handler);
    return () => window.removeEventListener(PLAYER_STATE_EVENT, handler);
  }, [cameraId]);
  const streamActive = demo || playerKind === "connected";

  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>(null);
  // When the last realtime row event arrived (epoch ms), or null. Used to tell
  // "subscribed and actually receiving" from "subscribed but silent".
  const [lastRealtimeEventAt, setLastRealtimeEventAt] = useState<number | null>(
    null,
  );
  // When the last perception-fanout WS frame arrived (epoch ms), or null.
  // Recomputed every render — at 10-15 Hz the frames themselves are the
  // renders, so this stays current while the hot path is alive.
  const [lastWsMessageAt, setLastWsMessageAt] = useState<number | null>(null);
  const wsDelivering =
    lastWsMessageAt !== null && now() - lastWsMessageAt < WS_DELIVERING_WINDOW_MS;

  // Polling is gated to an active session (no boxes wanted ⇒ no requests), but
  // runs fast whenever active. NOT slowed by realtime status — see the cadence
  // note above. (Not gated by freshness either — polling is how a stale overlay
  // recovers.) The one downshift: while the WS hot path is demonstrably
  // delivering frames, drop to a keep-warm tick — unlike a merely-SUBSCRIBED
  // realtime channel, `wsDelivering` is evidence of actual data, and the next
  // keep-warm poll restores the 250ms cadence within ~2s if the WS goes quiet.
  const shouldPoll =
    demo ||
    (liveDetectionsEnabled &&
      !isExpired &&
      processingEnabled &&
      streamActive &&
      pageVisible);
  const refreshInterval = shouldPoll
    ? demo
      ? DEMO_OVERLAY_POLL_MS
      : wsDelivering
        ? WS_KEEPWARM_POLL_MS
        : LIVE_OVERLAY_POLL_MS
    : 0;

  const { data, error, isValidating, mutate } =
    useUpstreamList<LatestPerceptionResponse>(
      buildLatestPerceptionPath(cameraId),
      {
        refreshInterval,
        fallbackData: initialPerception
          ? { snapshot: initialPerception }
          : undefined,
        // Opt down from the shared 3s dedupe so the realtime cache writes and
        // the fast fallback poll aren't coalesced. In demo there's no realtime
        // and the slow keep-alive poll never needs sub-second resolution, so
        // keep the default dedupe to coalesce any incidental duplicate keys.
        dedupingInterval: demo ? undefined : 250,
        // Newer-wins ordering guard: the poll fetches the ~1 Hz cold path,
        // which is usually OLDER than the latest WS frame already in the
        // cache. SWR keeps the current data when compare returns true — so
        // an equal-or-older fetch result is treated as "no change" instead
        // of shoving the overlay's boxes backward in time (the periodic
        // hitch). A genuinely newer result (incl. recovery after WS silence)
        // still applies. Non-snapshot shapes fall through to reference
        // equality so error/empty handling is untouched.
        compare: (a, b) =>
          a?.snapshot && b?.snapshot
            ? !isNewerPerceptionRecord(b.snapshot, a.snapshot)
            : a === b,
      },
    );

  const missing =
    error instanceof UpstreamApiError &&
    (error.status === 404 || error.code === "perception_snapshot_not_found");
  const record: LatestPerceptionRecord | null = missing
    ? null
    : (data?.snapshot ?? initialPerception ?? null);
  const errored = !missing && error != null;

  // Demo: which clip to loop, read from the perception fixture's `source.clip` —
  // "clean" (raw feed, no boxes) before detection is set up, then "weak" (baseline,
  // while the issue is open) or "strong" (high-recall). The overlay re-renders on
  // each poll, so it tracks the scene.
  const rawClip = (record?.snapshot.source as { clip?: string } | undefined)?.clip;
  const demoClip: "clean" | "weak" | "strong" | undefined = demo
    ? rawClip === "clean"
      ? "clean"
      : rawClip === "weak"
        ? "weak"
        : "strong"
    : undefined;

  // In demo, detection is "set up" only once the operator saves a counting line —
  // the fixture marks the pre-setup state with clip="clean". Until then, show a
  // "not set up yet" panel rather than an active live-preview reporting 0 objects.
  const demoConfigured = demo ? demoClip !== "clean" : true;
  // The active overlay panel renders while a live session is on (real) or once
  // detection is set up (demo).
  const detectionsActive = (liveDetectionsEnabled || demo) && demoConfigured;

  // Memoized on the SWR record identity: a cache write (WS frame / Realtime
  // row / poll) produces a new selection array; mere re-renders do not. The
  // smoothing hook keys its animation effect on this identity.
  const snapshot = useMemo(
    () => (record ? normalizeSnapshot(record.snapshot) : null),
    [record],
  );
  const dimsOk = snapshot != null && hasFrameDimensions(snapshot);

  const overlayObjects = useMemo(
    () =>
      snapshot && hasFrameDimensions(snapshot)
        ? selectOverlayObjects(
            snapshot.objects,
            snapshot.frameWidth,
            snapshot.frameHeight,
            minConfidence,
          )
        : [],
    [snapshot, minConfidence],
  );

  // Display-only smoothing of the detection boxes (lerp toward the latest
  // raw targets + a short fading grace window for briefly-missed tracks).
  // The raw snapshot stays the source of truth everywhere else — counts,
  // messages, and analytics all read the unsmoothed data. Disabled in demo
  // (boxes are hidden there) and whenever boxes are off.
  const smoothingEnabled = detectionsActive && !demo && showBoxes && dimsOk;
  const displayObjects = useSmoothedDetections(
    overlayObjects,
    smoothingEnabled,
    now,
  );

  // Only draw boxes while a live-detections session is active.
  const svg =
    detectionsActive && snapshot && dimsOk ? (
      <PerceptionOverlaySvg
        snapshot={snapshot}
        showBoxes={demo ? false : showBoxes}
        showLabels={demo ? false : showLabels}
        showGeometry={showGeometry}
        minConfidence={minConfidence}
        objects={smoothingEnabled ? displayObjects : undefined}
      />
    ) : null;

  const geometryCount = snapshot
    ? snapshot.rois.length + snapshot.lines.length
    : 0;

  // Age + stale gate against the injected ``now``. ``ageSeconds`` is null with
  // no snapshot yet -- treated as fresh so the first realtime event can arrive.
  const ageSeconds = record
    ? observedAtAgeSeconds(record.observed_at, now())
    : null;
  // Demo snapshots are always "live" (the fixture re-anchors each poll); never
  // surface a stale "Nh old" age from the fixed fixture timestamp.
  const ageLabel = demo
    ? "just now"
    : record
      ? formatOverlayAge(record.observed_at, now())
      : null;
  const isStale = !demo && ageSeconds !== null && ageSeconds > staleAfterSeconds;
  const processorOutputFresh = !isStale;

  // The single gate for holding a Supabase Realtime subscription open.
  const shouldUseRealtime = computeRealtimeGate({
    liveDetectionsEnabled,
    isExpired,
    streamActive,
    processingEnabled,
    processorOutputFresh,
    pageVisible,
  });

  // Realtime push, gated. Subscribe ONLY while `shouldUseRealtime`; any gate
  // closing (session off/expired, processing off, stream drop, stale, tab
  // hidden) or an unmount tears the channel down. We capture the subscribe
  // status for the connection chip, and write each broadcast row straight into
  // the SWR cache (revalidate:false) so the overlay renders at the processor's
  // publish rate rather than the dedupe-throttled refetch rate.
  useEffect(() => {
    if (demo) return; // demo mode: the fixture poll carries the overlay, no Supabase
    if (!shouldUseRealtime) return;
    let supabase: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    void (async () => {
      // The Supabase SDK is loaded lazily (kept off the camera-route critical
      // bundle), so await the client before touching it. The 250ms SWR poll is
      // already carrying the overlay, so a slightly-later Realtime connect is
      // invisible.
      const client = await getSupabaseBrowserClient();
      if (cancelled) return;
      supabase = client;
      // Authorize the Realtime socket with the user's JWT BEFORE subscribing.
      // postgres_changes on an RLS table authorizes each record read against
      // this token; if it isn't set, the payload comes back "Error 401:
      // Unauthorized" (the socket authorizes as anon) and the channel churns
      // SUBSCRIBED -> CLOSED. Relying on the client's eager/background setAuth
      // races the subscribe, so set it explicitly and await it here.
      const { data } = await client.auth.getSession();
      if (cancelled) return;
      await client.realtime.setAuth(data.session?.access_token ?? null);
      if (cancelled) return;

      channel = client
        .channel(`camera:${cameraId}:perception`)
        .on(
          "postgres_changes",
          // No server-side `filter`: Supabase only applies a postgres_changes
          // filter on UPDATEs against columns in the table's REPLICA IDENTITY,
          // so a `camera_id=eq.` filter drops the (UPSERT-driven) UPDATE events.
          // RLS (member_select) scopes delivery to the account; we narrow to
          // this camera in the handler.
          {
            event: "*",
            schema: "public",
            table: "latest_perception_snapshots",
          },
          (payload) => {
            // CRITICAL: ignore errored change events. When Realtime can't
            // authorize the record read it still emits the change, but with an
            // empty row + errors (e.g. "Error 401: Unauthorized"), and these
            // arrive in BURSTS during the reconnect churn an auth failure
            // causes. Acting on each (setState + refetch) thrashes React and
            // starves the 250ms poll — which is why the overlay went from ~4fps
            // to barely updating. Drop them entirely; the poll carries the
            // overlay. Real (authorized) events arrive WITHOUT errors and drive
            // the direct cache write below.
            if (payload.errors?.length) return;
            const rec = perceptionRecordFromRealtimeRow(payload.new);
            if (rec) {
              // Usable broadcast row: drop other cameras, else write it straight
              // into the SWR cache — true real-time, no refetch. Newer-wins:
              // a ~1 Hz cold row must not replace a fresher WS frame.
              if (rec.camera_id !== cameraId) return;
              setLastRealtimeEventAt(now());
              void mutate(
                (prev) =>
                  prev?.snapshot && !isNewerPerceptionRecord(rec, prev.snapshot)
                    ? prev
                    : { snapshot: rec },
                { revalidate: false },
              );
            } else {
              // Usable-but-unmappable row (no error): refetch the authoritative
              // snapshot; /perception/latest returns what the broadcast lacked.
              setLastRealtimeEventAt(now());
              void mutate();
            }
          },
        )
        .subscribe((status) => {
          setRealtimeStatus(status as RealtimeStatus);
        });
    })();

    return () => {
      cancelled = true;
      setRealtimeStatus(null);
      setLastRealtimeEventAt(null);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [shouldUseRealtime, cameraId, mutate, now, demo]);

  // Perception-fanout WS hot path (10-15 Hz), gated by the SAME gate as
  // Realtime — any gate closing tears the socket down. Purely additive: the
  // Realtime subscription and the poll keep running (poll downshifted while
  // frames arrive), so a dead sidecar degrades to exactly today's behavior.
  // Each frame is written straight into the SWR cache (revalidate:false),
  // identical to the Realtime handler — the SVG overlay renders unchanged,
  // just at the processor's publish rate instead of ~1 Hz.
  useEffect(() => {
    if (demo) return; // demo mode: fixture polls carry the overlay, no sidecar
    if (!shouldUseRealtime) return;
    const handle = connectPerceptionStream({
      getToken: async () => {
        try {
          const res = await fetchPerceptionStreamToken(cameraId);
          return { token: res.token, wsUrl: res.ws_url };
        } catch (err) {
          if (
            err instanceof UpstreamApiError &&
            (err.status === 503 || err.status === 404)
          ) {
            // 503 perception_stream_not_configured (deployment has no
            // sidecar) or 404 (camera/membership gone): permanent for this
            // session — stop quietly and let Realtime + polling carry on.
            return null;
          }
          // Transient (network blip, 5xx): the client backs off and retries.
          throw err;
        }
      },
      onSnapshot: (msg) => {
        const rec = perceptionRecordFromWsMessage(msg);
        if (!rec || rec.camera_id !== cameraId) return;
        setLastWsMessageAt(now());
        // Newer-wins (defensive — WS frames are normally the freshest, but
        // `seq` gaps + racing writers make ordering worth enforcing here too).
        void mutate(
          (prev) =>
            prev?.snapshot && !isNewerPerceptionRecord(rec, prev.snapshot)
              ? prev
              : { snapshot: rec },
          { revalidate: false },
        );
      },
    });
    return () => {
      handle.close();
      setLastWsMessageAt(null);
    };
  }, [shouldUseRealtime, cameraId, mutate, now, demo]);

  const realtimeDelivering =
    lastRealtimeEventAt !== null &&
    now() - lastRealtimeEventAt < REALTIME_DELIVERING_WINDOW_MS;

  const connection = demo
    ? demoConfigured
      ? { mode: "connected" as const, label: "live preview" }
      : { mode: "off" as const, label: "detection not set up" }
    : deriveOverlayConnectionState({
        processingEnabled,
        liveDetectionsEnabled,
        isExpired,
        streamActive,
        isStale,
        shouldUseRealtime,
        realtimeStatus,
        realtimeDelivering,
        wsDelivering,
      });

  return (
    <>
      <LiveStreamPlayerNext
        sessionId={sessionId}
        cameraId={cameraId}
        approved={approved}
        overlay={svg}
        demoClip={demoClip}
      />

      <div className="dn-tile mt-4 md:mt-6 p-[clamp(1rem,1.6vw,1.3rem)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
              live perception overlay
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-[var(--dn-text-50)]">
              <span className="inline-flex items-center gap-1.5">
                <StatusDot status={MODE_DOT[connection.mode]} />
                <span style={{ color: MODE_TEXT[connection.mode] }}>
                  {connection.label}
                </span>
              </span>
              {detectionsActive && record && snapshot ? (
                <span>
                  {" · "}
                  {ageLabel ?? "live"} · {snapshot.objects.length} object
                  {snapshot.objects.length === 1 ? "" : "s"} · {geometryCount}{" "}
                  geometry
                  {/* In demo the overlay polls every 250ms over static per-scene
                      data, so isValidating flips ~4x/s — surfacing it just flickers
                      the panel. Hide the in-flight indicator in demo, and also
                      while the WS hot path is delivering (the 2s keep-warm poll
                      would blink it for no user-visible reason). */}
                  {!demo && !wsDelivering && isValidating ? " · refreshing…" : ""}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {detectionsActive ? (
              <>
                <ToggleChip
                  label="Boxes"
                  icon={Boxes}
                  active={showBoxes}
                  onClick={() => setShowBoxes((v) => !v)}
                />
                <ToggleChip
                  label="Labels"
                  icon={Tag}
                  active={showLabels}
                  onClick={() => setShowLabels((v) => !v)}
                />
                <ToggleChip
                  label="Geometry"
                  icon={Spline}
                  active={showGeometry}
                  onClick={() => setShowGeometry((v) => !v)}
                />
                <select
                  aria-label="Minimum object confidence"
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(Number(e.target.value))}
                  className={SELECT_CLASS}
                >
                  {CONFIDENCE_THRESHOLDS.map((t) => (
                    <option key={t} value={t}>
                      {t === 0 ? "All confidence" : `≥ ${Math.round(t * 100)}%`}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void mutate()}
                  disabled={!demo && isValidating}
                  className={PILL_BTN}
                >
                  <RefreshCw
                    className={clsx(
                      "h-3.5 w-3.5",
                      !demo && isValidating && "animate-spin",
                    )}
                  />
                  Refresh
                </button>
              </>
            ) : null}
            {!demo && <LiveDetectionsControl session={session} />}
          </div>
        </div>

        {detectionsActive ? (
          <OverlayMessage
            missing={missing}
            errored={errored}
            hasRecord={record != null}
            dimsOk={dimsOk}
            objectCount={snapshot?.objects.length ?? 0}
            drawnCount={overlayObjects.length}
            processingEnabled={processingEnabled}
            streamActive={streamActive}
            isStale={isStale}
          />
        ) : demo ? (
          <DemoNotConfiguredMessage />
        ) : (
          <SessionOffMessage status={session.status} />
        )}

        {demo && !demoConfigured ? null : <DetectionDisclaimer />}
      </div>
    </>
  );
}

/**
 * The live-detections session toggle. Off/expired: a single CTA that starts a
 * 15-minute session. On: the countdown plus extend / turn-off.
 */
function LiveDetectionsControl({ session }: { session: LiveDetectionSession }) {
  if (session.status === "on") {
    return (
      <div className="inline-flex flex-wrap items-center gap-2">
        <span className="text-sm text-white">
          Live detections on · expires in {formatCountdown(session.remainingMs)}
        </span>
        <button
          type="button"
          onClick={session.extend}
          className={clsx(
            "rounded-full border px-2.5 py-1.5 text-sm transition",
            CHIP_INACTIVE,
          )}
        >
          Extend 15 min
        </button>
        <button
          type="button"
          onClick={session.disable}
          className={clsx(
            "rounded-full border px-2.5 py-1.5 text-sm transition",
            CHIP_ACTIVE,
          )}
        >
          Turn off
        </button>
      </div>
    );
  }
  return (
    <button type="button" onClick={session.enable} className={PRIMARY_BTN}>
      <Radio className="h-3.5 w-3.5" />
      {session.status === "expired"
        ? "Turn on for 15 minutes"
        : "Turn on live detections"}
    </button>
  );
}

/** Off / expired body copy shown when no live-detections session is active. */
function SessionOffMessage({ status }: { status: LiveSessionStatus }) {
  if (status === "expired") {
    return (
      <p className="mt-2 text-sm text-[var(--dn-text-50)]">
        Live detections expired. Turn them back on when you want to view live
        boxes again.
      </p>
    );
  }
  return (
    <p className="mt-2 text-sm text-[var(--dn-text-50)]">
      Live detections are off. Turn on for 15 minutes to see detection boxes on
      the video preview.
    </p>
  );
}

/**
 * Demo-only: shown on the Monitor tab before detection is set up (no counting
 * line saved yet), so the panel doesn't claim to be detecting when nothing is
 * configured.
 */
function DemoNotConfiguredMessage() {
  return (
    <p className="mt-2 text-sm text-[var(--dn-text-50)]">
      No detection running yet. Draw a counting line in{" "}
      <span className="font-medium text-white">Configure</span>{" "}and save it —
      Upstream starts detecting as soon as it&rsquo;s set up.
    </p>
  );
}

/**
 * Plain-language disclaimer (M5), shown while detection is active. The wording is
 * deliberate: it must make clear the processor analyzes the REAL stream and only
 * the browser box preview may lag — never that the processor is delayed or out of
 * sync.
 */
function DetectionDisclaimer() {
  return (
    <div className="mt-3 border-t border-white/10 pt-3 text-[clamp(0.78rem,0.9vw,0.85rem)] text-[var(--dn-text-50)]">
      <p>Live detections show what Upstream is seeing from the camera.</p>
      <p className="mt-2">
        The boxes are drawn in your browser as a preview, so they may be
        slightly delayed compared with the video. This does not mean the
        processor is delayed or out of sync — detections and events are still
        created from the actual camera stream.
      </p>
    </div>
  );
}

/**
 * Single contextual line under the controls while a session is active. The live
 * video keeps playing in every branch — these only describe the overlay layer.
 */
function OverlayMessage({
  missing,
  errored,
  hasRecord,
  dimsOk,
  objectCount,
  drawnCount,
  processingEnabled,
  streamActive,
  isStale,
}: {
  missing: boolean;
  errored: boolean;
  hasRecord: boolean;
  dimsOk: boolean;
  objectCount: number;
  drawnCount: number;
  processingEnabled: boolean;
  streamActive: boolean;
  isStale: boolean;
}) {
  if (errored && !hasRecord) {
    return (
      <p className="mt-2 text-sm text-[#c0473b]">
        Couldn&rsquo;t load the perception snapshot — the live video is
        unaffected. Use Refresh to retry.
      </p>
    );
  }
  if (errored && hasRecord) {
    return (
      <p className="mt-2 text-xs text-[#c0473b]">
        Couldn&rsquo;t refresh — showing the last snapshot.
      </p>
    );
  }
  // Processing disabled is the most fundamental blocker once detections are on.
  if (!processingEnabled) {
    return (
      <p className="mt-2 text-sm text-[var(--dn-text-50)]">
        Processing is disabled. Enable processing in Settings to see detections.
      </p>
    );
  }
  if (!streamActive) {
    return (
      <p className="mt-2 text-sm text-[var(--dn-text-50)]">
        Stream is not active. Start the stream to see live detections.
      </p>
    );
  }
  if (missing || !hasRecord) {
    return (
      <p className="mt-2 text-sm text-[var(--dn-text-50)]">
        No perception data yet. Start processing to see detections.
      </p>
    );
  }
  // Stale sits above dims/empty so the operator hears the bigger story
  // ("this isn't current") before the smaller one ("no objects here").
  if (isStale) {
    return (
      <p className="mt-2 text-sm text-[#8a6d1f]">
        Processor output is stale. Overlay may not reflect the current scene.
      </p>
    );
  }
  if (!dimsOk) {
    return (
      <p className="mt-2 text-sm text-[#8a6d1f]">
        Snapshot frame dimensions are missing — the overlay is disabled for this
        snapshot.
      </p>
    );
  }
  if (objectCount === 0) {
    return (
      <p className="mt-2 text-sm text-[var(--dn-text-50)]">
        No detections in latest perception snapshot.
      </p>
    );
  }
  if (drawnCount === 0) {
    return (
      <p className="mt-2 text-sm text-[var(--dn-text-50)]">
        No objects to draw — all were filtered out or have no bounding box.
      </p>
    );
  }
  return null;
}

function ToggleChip({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof Boxes;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-sm transition",
        active ? CHIP_ACTIVE : CHIP_INACTIVE,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
