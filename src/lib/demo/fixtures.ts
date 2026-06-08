// All canned data for demo mode. Mirrors upstream-demo/main-demo/05-data-fixtures.md.
// Every builder is a pure function of the scene so the on-screen data is a pure
// function of (path, scene) — same scene → same pixels, every take.
//
// Return types are annotated against the real API types so `tsc` catches any
// drift between these fixtures and the contracts the dashboard expects.

import type { User } from "@supabase/supabase-js";
import type { Membership } from "@/lib/account/memberships";
import type {
  AccountLimits,
  AccountSummary,
  Agent,
  Camera,
  ConfidenceTrendPoint,
  ConfidenceTrendRange,
  ConfidenceTrendResponse,
  DashboardSummary,
  GeometryConfig,
  GeometryConfigRecord,
  LatestFrame,
  LatestPerceptionPayload,
  LatestPerceptionRecord,
  ObservationRecord,
  ProcessorStatusRecord,
  ReliabilityFinding,
  ReliabilitySummary,
  StreamSession,
  StreamValidation,
} from "@/lib/api/types";
import {
  cameraAdded,
  counting,
  fixed,
  findingOpen,
  lineSaved,
  type DemoScene,
} from "./scene";

// --- shared constants --------------------------------------------------------

export const ACCOUNT_ID = "a0000000-0000-4000-8000-000000000001";
export const USER_ID = "d0000000-0000-4000-8000-0000000000d1";
export const AGENT_ID = "a0000000-0000-4000-8000-0000000000a1";
export const CAMERA_ID = "c0000000-0000-4000-8000-0000000000c1";
export const SESSION_ID = "55550000-0000-4000-8000-000000000051";

// Anchor demo timestamps to the real clock so every relative label ("moments
// ago") reads fresh no matter when the demo is recorded or how long the dev
// server has been up. Per-scene builders call isoAgo()/nowIso() each request;
// the const fixtures below re-anchor on module (re)load. Scene determinism
// (counts/findings/verdicts) is unaffected — only the wall-clock labels move.
const MIN_MS = 60_000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 24 * HOUR_MS;
const isoAgo = (msAgo: number): string => new Date(Date.now() - msAgo).toISOString();
const nowIso = (): string => isoAgo(0);

const ACCOUNT_CREATED = isoAgo(32 * DAY_MS);
const CAMERA_CREATED = isoAgo(13 * DAY_MS);

const LINE_ID = "dock-door";
const LINE_LABEL = "Dock Door";
const MODEL_BASE = "people-counter@1";
const MODEL_HIGH_RECALL = "people-counter-highrecall@2";

const packageFor = (scene: DemoScene) =>
  fixed(scene) ? MODEL_HIGH_RECALL : MODEL_BASE;

// --- demo identity (overrides, not /v1/* endpoints) --------------------------

export const DEMO_MEMBERSHIP: Membership = {
  accountId: ACCOUNT_ID,
  accountName: "Northgate Logistics",
  accountSlug: "northgate",
  role: "owner",
};

// Minimal stub of the Supabase User shape — only id/email are read by the chrome.
export const DEMO_USER = {
  id: USER_ID,
  email: "elkan@northgate.example",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: ACCOUNT_CREATED,
} as unknown as User;

// --- static fixtures ---------------------------------------------------------

export const demoAccount: AccountSummary = {
  id: ACCOUNT_ID,
  name: "Northgate Logistics",
  slug: "northgate",
  plan: "Pro",
  status: "active",
  metadata: {},
  created_at: ACCOUNT_CREATED,
  updated_at: nowIso(),
};

export const demoLimits: AccountLimits = {
  account_id: ACCOUNT_ID,
  max_cameras: 25,
  max_concurrent_sessions: 10,
  max_fps: 60,
  max_width: 1920,
  max_height: 1080,
  max_bitrate_kbps: 8000,
  allowed_codecs: ["h264", "h265"],
  monthly_minutes_quota: 100000,
  snapshot_storage_mb: 5000,
  created_at: ACCOUNT_CREATED,
  updated_at: nowIso(),
};

// Built per request (not a frozen const) so `last_seen_at` / `updated_at` stay
// fresh however long the demo server has been up. As a module-level const these
// timestamps froze at server start, so after a few hours the Home "Agents
// online" tile decayed to a stale red — contradicting the healthy story.
export function demoAgent(): Agent {
  return {
    id: AGENT_ID,
    account_id: ACCOUNT_ID,
    name: "dock-pi-01",
    hostname: "dock-pi-01.local",
    version: "0.1.0",
    os: "Linux 6.1 aarch64",
    python_version: "3.11.6",
    capabilities: { ffmpeg: true, srt: true, h264: true },
    status: "active",
    last_seen_at: isoAgo(25_000),
    created_at: CAMERA_CREATED,
    updated_at: nowIso(),
  };
}

// Built per request so `updated_at` stays fresh (see demoAgent note).
export function demoCamera(): Camera {
  return {
    id: CAMERA_ID,
    account_id: ACCOUNT_ID,
    agent_id: AGENT_ID,
    name: "Dock Door — Bay 3",
    external_id: "bay-3-dock",
    device_path: "/dev/video0",
    default_width: 1280,
    default_height: 720,
    default_fps: 30,
    default_codec: "h264",
    default_bitrate_kbps: 3000,
    default_latency_mode: "balanced",
    metadata: { location: "Warehouse A · Bay 3" },
    status: "streaming",
    created_at: CAMERA_CREATED,
    updated_at: nowIso(),
  };
}

// The cameras LIST is empty until the camera is added (the part-1 add-camera
// flow advances `adding` → `connected`). The /{id} detail still resolves.
export function demoCameras(scene: DemoScene): Camera[] {
  return cameraAdded(scene) ? [demoCamera()] : [];
}

const STREAM_PARAMS = {
  width: 1280,
  height: 720,
  fps: 30,
  codec: "h264",
  bitrate_kbps: 3000,
  latency_mode: "balanced" as const,
};

// Built per request so the session age ("started N minutes ago") stays fresh.
export function demoSession(): StreamSession {
  return {
    id: SESSION_ID,
    account_id: ACCOUNT_ID,
    agent_id: AGENT_ID,
    camera_id: CAMERA_ID,
    state: "streaming",
    srt_url: "srt://ingest.upstreamcv.com:8890",
    streamid: "northgate-bay3-051",
    expires_at: isoAgo(-50 * MIN_MS),
    created_at: isoAgo(10 * MIN_MS + 5_000),
    started_at: isoAgo(10 * MIN_MS),
    ended_at: null,
    requested: { ...STREAM_PARAMS },
    approved: { ...STREAM_PARAMS },
  };
}

export const demoValidations: StreamValidation[] = [
  {
    id: "90000000-0000-4000-8000-000000000091",
    session_id: SESSION_ID,
    passed: true,
    observed: { width: 1280, height: 720, fps: 30, codec: "h264" },
    expected: { width: 1280, height: 720, fps: 30, codec: "h264" },
    mismatch_fields: [],
    created_at: isoAgo(9 * MIN_MS + 30_000),
  },
];

// Built per request so "captured N seconds ago" stays fresh.
export function demoLatestFrame(): LatestFrame {
  return {
    storage_key: "demo/dock-frame.jpg",
    bytes: 184320,
    width: 1280,
    height: 720,
    captured_at: isoAgo(8_000),
    created_at: isoAgo(7_000),
    signed_url: "/demo/dock-frame.jpg",
    expires_at: isoAgo(-55 * MIN_MS),
  };
}

export const demoTokens = {
  tokens: [
    {
      id: "70000000-0000-4000-8000-000000000071",
      account_id: ACCOUNT_ID,
      name: "dock-pi-01",
      prefix: "ups_live",
      last_four: "9f2a",
      scopes: ["agent"],
      last_used_at: isoAgo(25_000),
      expires_at: null,
      revoked_at: null,
      created_at: "2026-05-20T14:00:00Z",
    },
  ],
};

export const demoProcessingConfig = { processing_enabled: true };

export function demoDashboardSummary(scene: DemoScene): DashboardSummary {
  if (!cameraAdded(scene)) {
    return {
      total_cameras: 0,
      online_cameras: 0,
      offline_cameras: 0,
      streaming_cameras: 0,
      cameras_with_errors: 0,
      active_streams: 0,
      validation_errors_24h: 0,
    };
  }
  return {
    total_cameras: 1,
    online_cameras: 1,
    offline_cameras: 0,
    streaming_cameras: 1,
    cameras_with_errors: 0,
    active_streams: 1,
    validation_errors_24h: 0,
  };
}

// --- per-scene builders ------------------------------------------------------

const SAVED_LINE = {
  id: LINE_ID,
  label: LINE_LABEL,
  points: [
    { x: 0.3, y: 0.56 },
    { x: 0.7, y: 0.56 },
  ],
  direction: "in" as const,
  enabled: true,
};

export function demoGeometryConfig(scene: DemoScene): GeometryConfigRecord {
  const frame = {
    width: 1280,
    height: 720,
    coordinate_space: "normalized" as const,
  };
  if (!lineSaved(scene)) {
    const config: GeometryConfig = { version: 1, frame, rois: [], lines: [] };
    return {
      id: null,
      camera_id: CAMERA_ID,
      revision: 0,
      config,
      is_default: true,
      created_at: null,
      updated_at: null,
    };
  }
  const config: GeometryConfig = {
    version: 1,
    frame,
    rois: [],
    lines: [SAVED_LINE],
  };
  return {
    id: "60000000-0000-4000-8000-000000000061",
    camera_id: CAMERA_ID,
    revision: 1,
    config,
    is_default: false,
    created_at: "2026-06-01T17:24:00Z",
    updated_at: "2026-06-01T17:24:00Z",
  };
}

export function demoProcessorStatus(scene: DemoScene): ProcessorStatusRecord {
  const applied_geometry = lineSaved(scene)
    ? { source: "operator_saved" as const, revision: 1, line_count: 1, roi_count: 0 }
    : { source: "default" as const, revision: null, line_count: 0, roi_count: 0 };
  return {
    id: "80000000-0000-4000-8000-000000000081",
    camera_id: CAMERA_ID,
    stream_session_id: SESSION_ID,
    processor_id: "proc-demo",
    runtime: "python",
    package_id: packageFor(scene),
    status: "processing",
    fps_input: 6,
    fps_processed: 6,
    last_frame_at: nowIso(),
    last_observation_at: nowIso(),
    error_code: null,
    error_message: null,
    payload: { applied_geometry },
    created_at: isoAgo(10 * MIN_MS),
    updated_at: nowIso(),
  };
}

// The crossing worker (track 7) is detected with solid confidence in `counting`
// and `fixed`; it's missing during `problem`/`fixing` (the low-light miss).
const BACKGROUND_OBJECTS = [
  { track_id: "4", label: "person", confidence: 0.79, bbox_normalized: { x: 0.12, y: 0.5, w: 0.08, h: 0.28 } },
  { track_id: "9", label: "person", confidence: 0.74, bbox_normalized: { x: 0.8, y: 0.46, w: 0.09, h: 0.3 } },
];
const CROSSER = { track_id: "7", label: "person", confidence: 0.86, bbox_normalized: { x: 0.46, y: 0.4, w: 0.1, h: 0.34 } };

export function demoPerception(scene: DemoScene): { snapshot: LatestPerceptionRecord } {
  // Detection only "turns on" once the operator sets up the counting line. Before
  // that (adding/connected) the live view is the raw clean clip with NO boxes and
  // no objects — the camera is just streaming; nothing is being detected yet.
  const detecting = lineSaved(scene);
  const showCrosser = scene === "counting" || scene === "fixed";
  const objects = !detecting
    ? []
    : showCrosser
      ? [CROSSER, ...BACKGROUND_OBJECTS]
      : [...BACKGROUND_OBJECTS];
  const payload: LatestPerceptionPayload = {
    frame: { width: 1280, height: 720, frame_num: 1042, fps: 6 },
    objects,
    geometry: {
      rois: [],
      lines: lineSaved(scene)
        ? [{ id: LINE_ID, label: LINE_LABEL, points: SAVED_LINE.points }]
        : [],
    },
    // `clip` picks which clip the live view loops: the raw "clean" feed before
    // detection is set up, then an annotated demo-cv-model output — the weaker
    // baseline while the issue is open, the high-recall model otherwise. The
    // overlay reads this and drives <DemoVideo>.
    source: {
      processor: "demo",
      clip: !detecting ? "clean" : findingOpen(scene) ? "weak" : "strong",
    },
    debug: scene === "problem" || scene === "fixing"
      ? { note: "low-light: track 7 dropped below threshold" }
      : {},
  };
  return {
    snapshot: {
      id: "b0000000-0000-4000-8000-0000000000b1",
      camera_id: CAMERA_ID,
      stream_session_id: SESSION_ID,
      processor_id: "proc-demo",
      package_id: packageFor(scene),
      observed_at: nowIso(),
      updated_at: nowIso(),
      snapshot: payload,
    },
  };
}

function crossing(
  id: string,
  cumulative: number,
  observedAt: string,
  pkg: string,
): ObservationRecord {
  return {
    id,
    camera_id: CAMERA_ID,
    stream_session_id: SESSION_ID,
    processor_id: "proc-demo",
    package_id: pkg,
    type: "processor.line_crossing",
    payload: {
      line_id: LINE_ID,
      line_label: LINE_LABEL,
      direction: "in",
      cumulative_count: cumulative,
      count_delta: 1,
    },
    observed_at: observedAt,
    created_at: observedAt,
  };
}

export function demoObservations(scene: DemoScene): { observations: ObservationRecord[] } {
  if (!counting(scene)) return { observations: [] };
  // Newest first; anchored to "moments ago" so the Time column reads fresh.
  const rows = [
    crossing("e3", 3, isoAgo(90_000), MODEL_BASE),
    crossing("e2", 2, isoAgo(140_000), MODEL_BASE),
    crossing("e1", 1, isoAgo(190_000), MODEL_BASE),
  ];
  if (fixed(scene)) {
    // The previously-missed crossing now counts (the payoff) — most recent row.
    rows.unshift(crossing("e4", 4, isoAgo(20_000), MODEL_HIGH_RECALL));
  }
  return { observations: rows };
}

// --- reliability -------------------------------------------------------------

const RECOMMENDED_ACTION =
  "Switch to the high-recall detection model tuned for low-light scenes. It trades a little speed for far steadier detections here.";

function openFinding(): ReliabilityFinding {
  return {
    id: "f0000000-0000-4000-8000-0000000000f1",
    camera_id: CAMERA_ID,
    stream_session_id: SESSION_ID,
    processor_status_id: "80000000-0000-4000-8000-000000000081",
    finding_type: "unstable_detection_confidence",
    category: "detection",
    severity: "warning",
    status: "open",
    title: "Unstable detection confidence",
    message:
      "Person detections at the dock door are dropping in and out. Average confidence fell from 0.82 to 0.46 over the last 3 hours, and at least one crossing went uncounted.",
    likely_cause:
      "Low ambient light at the bay, plus a detection model that's too small for this scene.",
    recommended_action: RECOMMENDED_ACTION,
    evidence: {
      window_hours: 3,
      avg_confidence_before: 0.82,
      avg_confidence_after: 0.46,
      low_confidence_ratio: 0.41,
      suspected_missed_crossings: 1,
      demo_apply_model: true,
    },
    dedupe_key: "unstable_detection_confidence:dock-door",
    detector_version: "reliability@1",
    first_seen_at: isoAgo(150_000),
    last_seen_at: nowIso(),
    resolved_at: null,
    resolved_reason: null,
    created_at: isoAgo(150_000),
    updated_at: nowIso(),
  };
}

function resolvedFinding(): ReliabilityFinding {
  return {
    ...openFinding(),
    status: "resolved",
    resolved_at: isoAgo(30_000),
    resolved_reason: "Model upgraded — confidence recovered",
    last_seen_at: isoAgo(40_000),
    updated_at: isoAgo(20_000),
  };
}

export function demoFindings(
  scene: DemoScene,
  status?: string,
): { findings: ReliabilityFinding[]; last_evaluated_at: string } {
  // The Reliability tab calls this twice — status=open and status=resolved.
  const findings: ReliabilityFinding[] =
    status === "resolved"
      ? fixed(scene)
        ? [resolvedFinding()]
        : []
      : findingOpen(scene)
        ? [openFinding()]
        : [];
  return { findings, last_evaluated_at: nowIso() };
}

export function demoReliabilitySummary(scene: DemoScene): ReliabilitySummary {
  if (findingOpen(scene)) {
    return {
      camera_id: CAMERA_ID,
      status: "needs_review",
      highest_severity: "warning",
      open_findings_count: 1,
      top_findings: [openFinding()],
      recommended_next_action: "Switch to the high-recall detection model tuned for low-light scenes.",
      last_evaluated_at: nowIso(),
    };
  }
  return {
    camera_id: CAMERA_ID,
    status: "healthy",
    highest_severity: null,
    open_findings_count: 0,
    top_findings: [],
    recommended_next_action: null,
    last_evaluated_at: nowIso(),
  };
}

// --- confidence trend --------------------------------------------------------

function trendPoints(avgs: number[]): ConfidenceTrendPoint[] {
  // Hourly buckets, oldest→newest, the last bucket ending ~now (anchored to the
  // real clock so the trend reads as "the last few hours", not a fixed date).
  const n = avgs.length;
  return avgs.map((avg, i) => {
    const low = avg >= 0.8 ? 0.06 : avg >= 0.65 ? 0.2 : 0.4;
    return {
      bucket_start: isoAgo((n - i) * HOUR_MS),
      bucket_end: isoAgo((n - i - 1) * HOUR_MS),
      avg_confidence: avg,
      min_confidence: Math.round(Math.max(0, avg - 0.2) * 100) / 100,
      max_confidence: Math.round(Math.min(1, avg + 0.12) * 100) / 100,
      low_confidence_ratio: low,
      confidence_stddev: 0.07,
      metric_count: 1180,
      object_count_total: 1180,
      confidence_sample_count: 1180,
    };
  });
}

const TREND_FLAT = [0.82, 0.83, 0.81, 0.82, 0.84, 0.82, 0.83, 0.82];
const TREND_DECLINING = [0.83, 0.82, 0.81, 0.8, 0.74, 0.66, 0.55, 0.46];
const TREND_RECOVERING = [0.83, 0.82, 0.81, 0.8, 0.74, 0.66, 0.55, 0.82];

export function demoConfidenceTrend(
  scene: DemoScene,
  range: ConfidenceTrendRange,
): ConfidenceTrendResponse {
  const avgs = findingOpen(scene)
    ? TREND_DECLINING
    : fixed(scene)
      ? TREND_RECOVERING
      : TREND_FLAT;
  const points = trendPoints(avgs);
  const definedAvgs = avgs;
  return {
    camera_id: CAMERA_ID,
    range,
    bucket_size: "1h",
    points,
    summary: {
      point_count: points.length,
      latest_avg_confidence: definedAvgs[definedAvgs.length - 1],
      lowest_avg_confidence: Math.min(...definedAvgs),
      highest_avg_confidence: Math.max(...definedAvgs),
      total_confidence_samples: points.reduce((n, p) => n + p.confidence_sample_count, 0),
      latest_bucket_start: points[points.length - 1]?.bucket_start ?? null,
    },
  };
}

// --- in-app terminal (Act 1) -------------------------------------------------
// Cleaned `upstream run` happy-path output for the demo (based on
// upstream-agent cli.py / supervisor.py). The terminal scene AND the
// add-camera modal type these with per-line delays.

export const DEMO_TERMINAL_LINES: { text: string; delayMs: number }[] = [
  { text: "$ upstream run", delayMs: 600 },
  { text: "Starting UpStream agent...", delayMs: 700 },
  { text: "Camera opened: webcam 0", delayMs: 500 },
  { text: "API session approved", delayMs: 500 },
  { text: "Approved config: h264, 1280x720 @ 30 FPS, 3000 kbps, balanced", delayMs: 600 },
  { text: "FFmpeg started — encoding live", delayMs: 600 },
  { text: "API session streaming confirmed", delayMs: 800 },
  { text: "Heartbeat reporting started", delayMs: 500 },
  { text: "Streaming started (frames flowing to streaming server).", delayMs: 300 },
  { text: "Press Ctrl+C to stop.", delayMs: 1500 },
];

// --- alert rule (Part 2 trigger on the line) ---------------------------------

export interface DemoAlertRule {
  lineLabel: string;
  direction: "in" | "out" | "any";
  action: string;
  enabled: boolean;
}

export const demoAlertRule: DemoAlertRule = {
  lineLabel: LINE_LABEL,
  direction: "in",
  action: "Notify me",
  enabled: true,
};

// --- notifications (Parts 3 & 6) ---------------------------------------------

export type DemoNotificationKind = "issue" | "success" | "info";

export interface DemoNotification {
  id: string;
  kind: DemoNotificationKind;
  title: string;
  body: string;
  at: string;
  unread: boolean;
  href?: string;
}

export function demoNotifications(scene: DemoScene): DemoNotification[] {
  const reliabilityHref = `/dashboard/cameras/${CAMERA_ID}/reliability`;
  const list: DemoNotification[] = []; // newest first

  if (fixed(scene)) {
    list.push({
      id: "n-ok",
      kind: "success",
      title: "Dock Door — Bay 3 is healthy",
      body: "Detection confidence recovered after the model upgrade — counting is back to normal.",
      at: isoAgo(20_000),
      unread: true,
      href: reliabilityHref,
    });
  }
  if (findingOpen(scene) || fixed(scene)) {
    list.push({
      id: "n-issue",
      kind: "issue",
      title: "Dock Door — Bay 3: detection unstable",
      body: "Confidence is dropping in low light and a crossing went uncounted. See the suggested fixes.",
      at: isoAgo(150_000),
      unread: findingOpen(scene),
      href: reliabilityHref,
    });
  }
  if (cameraAdded(scene)) {
    list.push({
      id: "n-online",
      kind: "info",
      title: "Dock Door — Bay 3 is online",
      body: "The camera connected and started streaming.",
      at: isoAgo(10 * MIN_MS),
      unread: false,
      href: `/dashboard/cameras/${CAMERA_ID}/monitor`,
    });
  }
  return list;
}

export function demoUnreadCount(scene: DemoScene): number {
  return demoNotifications(scene).filter((n) => n.unread).length;
}

// --- suggested fixes (Part 4) ------------------------------------------------

export type DemoFixKind = "model" | "parameter" | "scene";

export interface DemoSuggestedFix {
  id: string;
  kind: DemoFixKind;
  title: string;
  detail: string;
  primary?: boolean;
}

export const demoSuggestedFixes: DemoSuggestedFix[] = [
  {
    id: "model",
    kind: "model",
    title: "Switch to the high-recall model",
    detail:
      "best_person — tuned for people in low light. Trades a little speed for far steadier detections.",
    primary: true,
  },
  {
    id: "threshold",
    kind: "parameter",
    title: "Lower the confidence threshold",
    detail:
      "0.25 → 0.15 keeps the marginal detections the baseline model was dropping in the low light.",
  },
  {
    id: "exposure",
    kind: "scene",
    title: "Raise camera exposure",
    detail:
      "The dock light dipped at dusk — a small exposure bump restores contrast for detection.",
  },
];
