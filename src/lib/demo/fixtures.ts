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
  CameraPackageConfigResponse,
  CameraProcessingConfigResponse,
  ConfidenceTrendPoint,
  ConfidenceTrendRange,
  ConfidenceTrendResponse,
  DashboardSummary,
  GeometryConfig,
  GeometryConfigRecord,
  LatestFrame,
  LatestPerceptionPayload,
  LatestPerceptionRecord,
  ModelsListResponse,
  ObservationRecord,
  ProcessingEvidenceRange,
  ProcessingEvidenceResponse,
  ModelMetrics,
  ProcessingPackage,
  ProcessingPackageCatalogResponse,
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
  allowed_stream_types: ["webcam", "rtsp"],
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
    source_type: "webcam",
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

function zoneExit(id: string, observedAt: string): ObservationRecord {
  // An inferred zone exit (P5-Gap): the track disappeared past the grace window
  // rather than being seen to leave. Feeds both the Events tab and the P5-J
  // runtime-evidence lifecycle counts.
  return {
    id,
    camera_id: CAMERA_ID,
    stream_session_id: SESSION_ID,
    processor_id: "proc-demo",
    package_id: "deepstream.yolox_analytics_probe.v0",
    type: "processor.zone_exited",
    payload: {
      zone_id: "dock-roi",
      zone_label: "Dock",
      track_id: "5",
      inferred: true,
      exit_reason: "track_missing_timeout",
      missing_duration_seconds: 2.3,
    },
    observed_at: observedAt,
    created_at: observedAt,
  };
}

export function demoObservations(scene: DemoScene): { observations: ObservationRecord[] } {
  if (!counting(scene)) return { observations: [] };
  const rows = [
    crossing("e3", 3, isoAgo(90_000), MODEL_BASE),
    crossing("e2", 2, isoAgo(140_000), MODEL_BASE),
    crossing("e1", 1, isoAgo(190_000), MODEL_BASE),
    zoneExit("z2", isoAgo(120_000)),
    zoneExit("z1", isoAgo(220_000)),
  ];
  if (fixed(scene)) {
    // The previously-missed crossing now counts (the payoff).
    rows.push(crossing("e4", 4, isoAgo(20_000), MODEL_HIGH_RECALL));
  }
  // Newest first; anchored to "moments ago" so the Time column reads fresh.
  rows.sort((a, b) => (a.observed_at < b.observed_at ? 1 : -1));
  return { observations: rows };
}

// GET /v1/cameras/{id}/processing/evidence — P5-J runtime evidence. Counts +
// inferred-exit lifecycle are DERIVED from demoObservations(scene) so the
// evidence panel and the Events tab can never contradict each other. Lineage /
// tracking / history are synthesized to match the active YOLOX package.
export function demoProcessingEvidence(
  scene: DemoScene,
  range: ProcessingEvidenceRange,
): ProcessingEvidenceResponse {
  const obs = demoObservations(scene).observations;
  const byType = new Map<string, number>();
  for (const o of obs) byType.set(o.type, (byType.get(o.type) ?? 0) + 1);
  const observation_counts = [...byType.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([type, count]) => ({ type, count }));
  const inferred = obs.filter(
    (o) =>
      o.type === "processor.zone_exited" &&
      (o.payload as { inferred?: boolean }).inferred === true,
  ).length;
  const active = obs.length > 0;

  return {
    camera_id: CAMERA_ID,
    window: {
      range,
      started_at: isoAgo(range === "1h" ? HOUR_MS : DAY_MS),
      ended_at: nowIso(),
    },
    package: {
      requested_package_id: "deepstream.yolox_analytics_probe.v0",
      applied_package_id: active ? "deepstream.yolox_analytics_probe.v0" : null,
      state: "active",
      requested_revision: 2,
    },
    lineage: {
      model_id: active ? "yolox_s_v1" : null,
      tracker_profile_id: active ? "deepstream_iou_fast_v1" : null,
      tracker_algorithm: active ? "iou" : null,
      analytics_profile_id: active ? "deepstream_nvdsanalytics_probe_v1" : null,
    },
    status: {
      status: active ? "processing" : null,
      last_seen_at: active ? isoAgo(15_000) : null,
      last_error_code: null,
      updated_at: active ? isoAgo(15_000) : null,
    },
    observation_counts,
    lifecycle: {
      inferred_zone_exits: inferred,
      track_missing_timeout_exits: inferred,
    },
    tracking: active
      ? {
          unique_tracker_ids_count: 8,
          tracker_ids_sample: ["1", "2", "5"],
          is_session_level: true,
        }
      : { unique_tracker_ids_count: null, tracker_ids_sample: [], is_session_level: true },
    package_history: [
      {
        id: "a0000000-0000-4000-8000-0000000000e2",
        event_type: "camera.processing_package_applied",
        package_id: "deepstream.yolox_analytics_probe.v0",
        actor_type: "user",
        actor_user_id: USER_ID,
        summary: "Processing package apply confirmed.",
        created_at: isoAgo(20 * MIN_MS),
      },
      {
        id: "a0000000-0000-4000-8000-0000000000e1",
        event_type: "camera.processing_package_requested",
        package_id: "deepstream.yolox_analytics_probe.v0",
        actor_type: "user",
        actor_user_id: USER_ID,
        summary: "Processing package requested.",
        created_at: isoAgo(22 * MIN_MS),
      },
    ],
    warnings: active
      ? ["dwell_closure_reason_not_persisted", "tracking_metrics_are_session_level"]
      : ["dwell_closure_reason_not_persisted"],
  };
}

// GET /v1/models — the detection model registry the M5/M6 "Model & Detection"
// editor (`configure/detection/page.tsx`) populates its picker from. Two
// people-counter models that mirror the demo's own MODEL_BASE / MODEL_HIGH_RECALL
// strings, so the editor, the observations rows, and the reliability "apply
// high-recall model" beat all name the same models. Scene-invariant: the
// registry is the catalog, not narrative state.
export function demoModels(): ModelsListResponse {
  return {
    models: [
      {
        model_key: MODEL_BASE,
        display_name: "People Counter v1",
        description: "Balanced people detection + counting. The default model.",
        task_type: "detection",
        runtime: "onnx",
        default_confidence_threshold: 0.5,
        supported_classes: ["person"],
        supported_trackers: ["bytetrack", "botsort"],
        model_version: "1.0.0",
        detector_version: "yolo11m",
        resource_profile: "balanced",
        enabled: true,
        notes: null,
        limitations: [],
      },
      {
        model_key: MODEL_HIGH_RECALL,
        display_name: "People Counter v2 (High recall)",
        description:
          "Tuned for crowded / occluded scenes — catches crossings the balanced model misses.",
        task_type: "detection",
        runtime: "onnx",
        default_confidence_threshold: 0.4,
        supported_classes: ["person"],
        supported_trackers: ["bytetrack", "botsort"],
        model_version: "2.0.0",
        detector_version: "yolo11l",
        resource_profile: "accurate",
        enabled: true,
        notes: "Recommended when reliability flags missed detections.",
        limitations: ["Higher compute cost than the balanced model."],
      },
    ],
  };
}

// GET /v1/cameras/{id}/processing-config — the camera's current model/detection
// config the detection editor opens with. Returns the unsaved system default
// (`is_default: true`, `revision: 0`, null id/timestamps) so the editor shows
// its "Not configured yet" state cleanly — the demo's model story is told on the
// Reliability tab ("apply recommended model"), not here. Scene-invariant.
export function demoCameraProcessingConfig(): CameraProcessingConfigResponse {
  return {
    processing_config: {
      id: null,
      account_id: ACCOUNT_ID,
      camera_id: CAMERA_ID,
      revision: 0,
      config: {
        version: 1,
        model_key: MODEL_BASE,
        selected_classes: [],
        tracker: null,
        confidence_threshold: null,
        processing_fps: null,
      },
      is_default: true,
      created_at: null,
      updated_at: null,
    },
  };
}

// --- processing packages (P5-F catalog + P5-G request/apply) -----------------

function demoPkg(over: Partial<ProcessingPackage>): ProcessingPackage {
  return {
    package_id: "demo.pkg",
    display_name: "Package",
    description: null,
    category: "people_analytics",
    status: "probe",
    production_ready: false,
    test_mode_safe: true,
    runtime: "deepstream",
    model_id: null,
    tracker_profile_id: null,
    analytics_profile_id: null,
    supported_classes: [],
    supported_outputs: [],
    supported_shapes: [],
    supported_triggers: [],
    default_settings: {},
    allowed_overrides: [],
    compute_tier: null,
    pricing_tier: "free_probe",
    observation_volume_risk: null,
    license_class: "permissive",
    first_party: true,
    warnings: [],
    limitations: [],
    best_for: [],
    not_recommended_for: [],
    requires_geometry: false,
    requires_restart: true,
    readiness_notes: null,
    related_packages: [],
    model_metrics: null,
    ...over,
  };
}

// GET /v1/processing/packages — the package catalog the Processing tab renders.
// A curated subset mirroring the real catalog (a probe, an experimental, and a
// settings-less diagnostic) so the demo exercises every badge + the experimental
// opt-in guard. Scene-invariant.
const ANALYTICS_OUTPUTS = [
  "processor.line_crossing",
  "processor.roi_occupancy",
  "processor.zone_entered",
  "processor.zone_exited",
  "processor.dwell_started",
  "processor.dwell_exceeded",
];

// P5-L — published reference metrics by model_id, attached to demo packages so
// the model picker shows real comparison stats (and a TAO vendor KPI).
const YOLOX_SRC = "Published reference — YOLOX repo (Megvii)";
const ULTRA_SRC = "Published reference — Ultralytics docs";

function demoCoco(
  coco_map50_95: number,
  params_m: number,
  input_size: number,
  metric_source: string,
): ModelMetrics {
  return {
    metric_source,
    upstream_measured: false,
    metric_dataset: "COCO val2017",
    coco_map50_95,
    coco_map50: null,
    params_m,
    input_size,
    backbone: null,
    vendor_kpi_label: null,
    vendor_kpi_value: null,
    vendor_kpi_note: null,
  };
}

const DEMO_MODEL_METRICS: Record<string, ModelMetrics> = {
  yolox_nano_v1: demoCoco(25.8, 0.91, 416, YOLOX_SRC),
  yolox_tiny_v1: demoCoco(32.8, 5.06, 416, YOLOX_SRC),
  yolox_s_v1: demoCoco(40.5, 9.0, 640, YOLOX_SRC),
  yolox_m_v1: demoCoco(46.9, 25.3, 640, YOLOX_SRC),
  yolov8n_v1: demoCoco(37.3, 3.2, 640, ULTRA_SRC),
  yolo11n_v1: demoCoco(39.5, 2.6, 640, ULTRA_SRC),
  yolo11s_v1: demoCoco(47.0, 9.4, 640, ULTRA_SRC),
  yolo11m_v1: demoCoco(51.5, 20.1, 640, ULTRA_SRC),
  peoplenet_v1: {
    metric_source: "Published reference — NVIDIA TAO PeopleNet model card (NGC)",
    upstream_measured: false,
    metric_dataset: "NVIDIA proprietary eval (IoU>0.5)",
    coco_map50_95: null,
    coco_map50: null,
    params_m: null,
    input_size: null,
    backbone: "ResNet-34",
    vendor_kpi_label: "NVIDIA mAP — person (proprietary eval)",
    vendor_kpi_value: 94.19,
    vendor_kpi_note:
      "NVIDIA-reported on 90k+ proprietary images (IoU>0.5); not comparable to COCO mAP.",
  },
  trafficcamnet_v1: {
    metric_source: "Published reference — NVIDIA TAO TrafficCamNet model card (NGC)",
    upstream_measured: false,
    metric_dataset: "NVIDIA proprietary eval (IoU>0.5)",
    coco_map50_95: null,
    coco_map50: null,
    params_m: null,
    input_size: null,
    backbone: "ResNet-18",
    vendor_kpi_label: "NVIDIA TAO KPI",
    vendor_kpi_value: null,
    vendor_kpi_note:
      "NVIDIA reports precision/recall on a proprietary eval (IoU>0.5); not comparable to COCO mAP.",
  },
};

const DEMO_PEOPLE_TRIGGERS = ["line_crossing", "roi_occupancy", "zone_exited", "dwell_exceeded"];

// A per-model people-analytics demo package (mirrors the real *_people_probe.v0
// catalog entries) so every model shows up in the Advanced model picker.
function demoPeoplePkg(over: Partial<ProcessingPackage>): ProcessingPackage {
  return demoPkg({
    status: "experimental",
    tracker_profile_id: "deepstream_iou_fast_v1",
    analytics_profile_id: "deepstream_nvdsanalytics_probe_v1",
    supported_classes: ["person"],
    supported_outputs: ANALYTICS_OUTPUTS,
    supported_shapes: ["polygon_roi", "line_segment"],
    supported_triggers: DEMO_PEOPLE_TRIGGERS,
    default_settings: { confidence_threshold: 0.4, target_fps: 30 },
    allowed_overrides: ["confidence_threshold", "selected_classes", "processing_fps"],
    best_for: ["person_entry_exit", "zone_presence", "dwell_monitoring"],
    requires_geometry: true,
    ...over,
  });
}

export function demoProcessingPackages(): ProcessingPackageCatalogResponse {
  const packages: ProcessingPackage[] = [
      demoPkg({
        package_id: "deepstream.yolox_analytics_probe.v0",
        display_name: "People Analytics — YOLOX",
        description:
          "Person detection (YOLOX-S) + IOU tracker + analytics. The recommended people-analytics probe today.",
        category: "people_analytics",
        status: "probe",
        model_id: "yolox_s_v1",
        tracker_profile_id: "deepstream_iou_fast_v1",
        analytics_profile_id: "deepstream_nvdsanalytics_probe_v1",
        supported_classes: ["person"],
        supported_outputs: ANALYTICS_OUTPUTS,
        supported_shapes: ["polygon_roi", "line_segment"],
        supported_triggers: ["line_crossing", "roi_occupancy", "zone_exited", "dwell_exceeded"],
        default_settings: { confidence_threshold: 0.4, target_fps: 30 },
        allowed_overrides: ["confidence_threshold", "selected_classes", "processing_fps"],
        compute_tier: "medium",
        observation_volume_risk: "medium",
        best_for: ["person_entry_exit", "zone_presence", "dwell_monitoring"],
        requires_geometry: true,
      }),
      demoPkg({
        package_id: "deepstream.yolox_analytics_nvdcf_probe.v0",
        display_name: "People Analytics — YOLOX + NvDCF (experimental)",
        description:
          "Same YOLOX people-analytics chain, with the NvDCF tracker in place of IOU.",
        category: "people_analytics",
        status: "experimental",
        model_id: "yolox_s_v1",
        tracker_profile_id: "deepstream_nvdcf_balanced_v1",
        analytics_profile_id: "deepstream_nvdsanalytics_probe_v1",
        supported_classes: ["person"],
        supported_outputs: ANALYTICS_OUTPUTS,
        supported_shapes: ["polygon_roi", "line_segment"],
        supported_triggers: ["line_crossing", "roi_occupancy", "zone_exited", "dwell_exceeded"],
        default_settings: { confidence_threshold: 0.4, target_fps: 30 },
        allowed_overrides: ["confidence_threshold", "selected_classes", "processing_fps"],
        compute_tier: "high",
        observation_volume_risk: "medium",
        warnings: [
          "Experimental. A representative person A/B found NvDCF did NOT reduce track fragmentation vs the IOU package — prefer the IOU YOLOX analytics package today.",
        ],
        best_for: ["occlusion_robustness", "track_continuity"],
        not_recommended_for: ["production_sla"],
        readiness_notes:
          "P5-F A/B: NvDCF produced ~83% more track IDs than IOU; not promoted. Remains experimental.",
        requires_geometry: true,
      }),
      demoPkg({
        package_id: "deepstream.yolox_people_occupancy_probe.v0",
        display_name: "People Occupancy",
        description: "People occupancy / capacity / presence in a polygon ROI (YOLOX-S + IOU).",
        category: "people_analytics",
        status: "probe",
        model_id: "yolox_s_v1",
        tracker_profile_id: "deepstream_iou_fast_v1",
        analytics_profile_id: "deepstream_nvdsanalytics_probe_v1",
        supported_classes: ["person"],
        supported_outputs: [
          "processor.roi_occupancy",
          "processor.zone_entered",
          "processor.zone_exited",
        ],
        supported_shapes: ["polygon_roi"],
        supported_triggers: ["roi_occupancy"],
        default_settings: { confidence_threshold: 0.4, target_fps: 30 },
        allowed_overrides: ["confidence_threshold", "selected_classes", "processing_fps"],
        compute_tier: "medium",
        observation_volume_risk: "medium",
        best_for: ["occupancy", "capacity", "presence"],
        requires_geometry: true,
      }),
      demoPkg({
        package_id: "deepstream.yolox_people_dwell_probe.v0",
        display_name: "People Dwell / Loitering",
        description: "People dwell / loitering monitoring in a polygon ROI (YOLOX-S + IOU).",
        category: "people_analytics",
        status: "probe",
        model_id: "yolox_s_v1",
        tracker_profile_id: "deepstream_iou_fast_v1",
        analytics_profile_id: "deepstream_nvdsanalytics_probe_v1",
        supported_classes: ["person"],
        supported_outputs: [
          "processor.dwell_started",
          "processor.dwell_updated",
          "processor.dwell_exceeded",
          "processor.zone_entered",
          "processor.zone_exited",
        ],
        supported_shapes: ["polygon_roi"],
        supported_triggers: ["dwell_exceeded"],
        default_settings: { confidence_threshold: 0.4, target_fps: 30 },
        allowed_overrides: ["confidence_threshold", "selected_classes", "processing_fps"],
        compute_tier: "medium",
        observation_volume_risk: "medium",
        best_for: ["dwell", "dwell_monitoring", "loitering"],
        requires_geometry: true,
      }),
      demoPkg({
        package_id: "deepstream.trafficcamnet_vehicle_probe.v0",
        display_name: "Vehicle / Traffic Analytics (experimental)",
        description:
          "Vehicle counting / occupancy via TrafficCamNet (car/bicycle) + IOU. Experimental.",
        category: "vehicle_analytics",
        status: "experimental",
        model_id: "trafficcamnet_v1",
        tracker_profile_id: "deepstream_iou_fast_v1",
        analytics_profile_id: "deepstream_nvdsanalytics_probe_v1",
        supported_classes: ["car", "bicycle"],
        supported_outputs: [
          "processor.roi_occupancy",
          "processor.line_crossing",
          "processor.zone_entered",
          "processor.zone_exited",
        ],
        supported_shapes: ["polygon_roi", "line_segment"],
        supported_triggers: ["roi_occupancy", "line_crossing"],
        default_settings: { confidence_threshold: 0.4, target_fps: 30 },
        allowed_overrides: ["confidence_threshold", "selected_classes", "processing_fps"],
        compute_tier: "low",
        observation_volume_risk: "medium",
        license_class: "commercial_agreement",
        warnings: ["Experimental — vehicle detection is not yet live-verified in Upstream."],
        best_for: ["vehicle_counting", "traffic_scenes", "parking_occupancy"],
        not_recommended_for: ["person_analytics"],
        requires_geometry: true,
      }),
      demoPkg({
        package_id: "deepstream.yolo11s_people_probe.v0",
        display_name: "People Analytics — YOLO11-S",
        description:
          "People analytics on YOLO11-S + IOU. Experimental; prepared in-repo, not yet live-verified.",
        category: "people_analytics",
        status: "experimental",
        model_id: "yolo11s_v1",
        tracker_profile_id: "deepstream_iou_fast_v1",
        analytics_profile_id: "deepstream_nvdsanalytics_probe_v1",
        supported_classes: ["person"],
        supported_outputs: ANALYTICS_OUTPUTS,
        supported_shapes: ["polygon_roi", "line_segment"],
        supported_triggers: ["line_crossing", "roi_occupancy", "zone_exited", "dwell_exceeded"],
        default_settings: { confidence_threshold: 0.4, target_fps: 30 },
        allowed_overrides: ["confidence_threshold", "selected_classes", "processing_fps"],
        compute_tier: "medium",
        observation_volume_risk: "medium",
        license_class: "restrictive",
        first_party: false,
        warnings: [
          "BYOM / requires your own Ultralytics license — not auto-provided as a first-party package. Detection parser not yet GPU-validated.",
        ],
        best_for: ["person_entry_exit", "zone_presence", "dwell_monitoring"],
        requires_geometry: true,
      }),
      demoPeoplePkg({
        package_id: "deepstream.yolox_nano_people_probe.v0",
        display_name: "People Analytics — YOLOX-Nano",
        model_id: "yolox_nano_v1",
        compute_tier: "low",
      }),
      demoPeoplePkg({
        package_id: "deepstream.yolox_tiny_people_probe.v0",
        display_name: "People Analytics — YOLOX-Tiny",
        model_id: "yolox_tiny_v1",
        compute_tier: "low",
      }),
      demoPeoplePkg({
        package_id: "deepstream.yolox_m_people_probe.v0",
        display_name: "People Analytics — YOLOX-M",
        model_id: "yolox_m_v1",
        compute_tier: "high",
      }),
      demoPeoplePkg({
        package_id: "deepstream.yolo11n_people_probe.v0",
        display_name: "People Analytics — YOLO11-N",
        model_id: "yolo11n_v1",
        compute_tier: "low",
        license_class: "restrictive",
        first_party: false,
        warnings: ["BYOM / requires your own Ultralytics license."],
      }),
      demoPeoplePkg({
        package_id: "deepstream.yolo11m_people_probe.v0",
        display_name: "People Analytics — YOLO11-M",
        model_id: "yolo11m_v1",
        compute_tier: "high",
        license_class: "restrictive",
        first_party: false,
        warnings: ["BYOM / requires your own Ultralytics license."],
      }),
      demoPeoplePkg({
        package_id: "deepstream.yolov8n_people_probe.v0",
        display_name: "People Analytics — YOLOv8-N",
        model_id: "yolov8n_v1",
        compute_tier: "low",
        license_class: "restrictive",
        first_party: false,
        warnings: ["BYOM / requires your own Ultralytics license."],
      }),
      demoPeoplePkg({
        package_id: "deepstream.peoplenet_people_probe.v0",
        display_name: "People Analytics — PeopleNet",
        model_id: "peoplenet_v1",
        compute_tier: "low",
      }),
      demoPkg({
        package_id: "deepstream.decode_probe.v0",
        display_name: "DeepStream Decode Probe",
        description: "Minimal RTSP decode probe (no inference). Diagnostic only.",
        category: "diagnostic",
        status: "probe",
        compute_tier: "low",
        limitations: ["Decode only; emits no observations."],
        allowed_overrides: [],
        requires_geometry: false,
      }),
  ];
  return {
    packages: packages.map((p) => ({
      ...p,
      model_metrics: p.model_id ? (DEMO_MODEL_METRICS[p.model_id] ?? null) : null,
    })),
    categories: [
      { id: "people_analytics", display_name: "People Analytics" },
      { id: "vehicle_analytics", display_name: "Vehicle Analytics" },
      { id: "diagnostic", display_name: "Diagnostic Probes" },
    ],
    warnings: [],
  };
}

// GET/PUT/apply /v1/cameras/{id}/processing-config/package — the camera's
// requested/applied package state. The demo camera has the recommended IOU
// package requested AND applied (state "active") so the populated state header
// renders; clicking another package opens its editor. Save/Apply resolve here
// too (demo serverFetch is path-keyed), so the buttons round-trip cleanly.
export function demoCameraPackageConfig(): CameraPackageConfigResponse {
  return {
    camera_id: CAMERA_ID,
    requested: {
      package_id: "deepstream.yolox_analytics_probe.v0",
      settings: { confidence_threshold: 0.4 },
      revision: 2,
      updated_at: isoAgo(2 * HOUR_MS),
      updated_by: `user:${USER_ID}`,
    },
    applied: {
      package_id: "deepstream.yolox_analytics_probe.v0",
      model_id: "yolox_s_v1",
      tracker_profile_id: "deepstream_iou_fast_v1",
      analytics_profile_id: "deepstream_nvdsanalytics_probe_v1",
      status: "processing",
      applied_at: isoAgo(90 * MIN_MS),
    },
    state: "active",
    warnings: [],
  };
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
  const reliabilityHref = `/cameras/${CAMERA_ID}/reliability`;
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
      href: `/cameras/${CAMERA_ID}/monitor`,
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
