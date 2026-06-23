// TS mirrors of upstream-api-server pydantic schemas.
// Source of truth: ../upstream-api-server/src/upstream_api/schemas/
// Unknown fields from upstream are intentionally tolerated; zod is used at
// the proxy boundary only where downstream code depends on strict shapes.

export type Uuid = string;
export type IsoDateTime = string;

export type LatencyMode = "low" | "balanced" | "stable";

export type AgentStatus = "active" | "disabled";
export interface Agent {
  id: Uuid;
  account_id: Uuid;
  name: string;
  hostname: string | null;
  version: string | null;
  os: string | null;
  python_version: string | null;
  capabilities: Record<string, unknown>;
  status: AgentStatus;
  last_seen_at: IsoDateTime | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

// Per-agent (and per-camera) heartbeat history. Source:
// ../upstream-api-server/src/upstream_api/schemas/heartbeats.py — returned
// newest-first by GET /v1/agents/{id}/heartbeats and GET /v1/cameras/{id}/heartbeats.
export type HeartbeatStatus =
  | "online"
  | "streaming"
  | "error"
  | "reconnecting";
export interface HeartbeatRecord {
  id: Uuid;
  agent_id: Uuid;
  camera_id: Uuid | null;
  session_id: Uuid | null;
  status: HeartbeatStatus;
  fps: number | null;
  bitrate_kbps: number | null;
  width: number | null;
  height: number | null;
  codec: string | null;
  last_error: string | null;
  agent_version: string | null;
  reported_at: IsoDateTime;
  created_at: IsoDateTime;
}

export type CameraStatus = "idle" | "streaming" | "error" | "disabled";
export interface Camera {
  id: Uuid;
  account_id: Uuid;
  // Null for dashboard-created cameras no agent has claimed yet.
  agent_id: Uuid | null;
  name: string;
  external_id: string | null;
  device_path: string | null;
  // "webcam" | "rtsp" | future types; null for cameras registered before
  // source types existed.
  source_type: string | null;
  default_width: number | null;
  default_height: number | null;
  default_fps: number | null;
  default_codec: string | null;
  default_bitrate_kbps: number | null;
  default_latency_mode: LatencyMode;
  metadata: Record<string, unknown>;
  status: CameraStatus;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface StreamParams {
  width: number;
  height: number;
  fps: number;
  codec: string;
  bitrate_kbps: number;
  latency_mode: LatencyMode;
}

export type StreamSessionState =
  | "approved"
  | "streaming"
  | "ended"
  | "expired"
  | "failed";

export interface StreamSession {
  id: Uuid;
  account_id: Uuid;
  agent_id: Uuid;
  camera_id: Uuid;
  state: StreamSessionState;
  srt_url: string;
  streamid: string;
  expires_at: IsoDateTime;
  created_at: IsoDateTime;
  started_at: IsoDateTime | null;
  ended_at: IsoDateTime | null;
  requested: StreamParams;
  approved: StreamParams;
}

export interface ApiToken {
  id: Uuid;
  account_id: Uuid;
  name: string;
  prefix: string;
  last_four: string;
  scopes: string[];
  last_used_at: IsoDateTime | null;
  expires_at: IsoDateTime | null;
  revoked_at: IsoDateTime | null;
  created_at: IsoDateTime;
}

export interface ApiTokenCreated {
  token: ApiToken;
  plaintext: string;
}

export interface AgentListResponse {
  agents: Agent[];
}
export interface HeartbeatListResponse {
  heartbeats: HeartbeatRecord[];
}
export interface CameraListResponse {
  cameras: Camera[];
}
export interface StreamSessionListResponse {
  sessions: StreamSession[];
}

export interface StreamValidation {
  id: Uuid;
  session_id: Uuid;
  passed: boolean;
  observed: Record<string, unknown>;
  expected: Record<string, unknown>;
  mismatch_fields: string[];
  created_at: IsoDateTime;
}

export interface LatestFrame {
  storage_key: string;
  bytes: number;
  width: number | null;
  height: number | null;
  captured_at: IsoDateTime;
  created_at: IsoDateTime;
  signed_url: string;
  expires_at: IsoDateTime;
}

export interface ApiTokenListResponse {
  tokens: ApiToken[];
}

export interface StreamValidationListResponse {
  validations: StreamValidation[];
}

export interface DashboardSummary {
  total_cameras: number;
  online_cameras: number;
  offline_cameras: number;
  streaming_cameras: number;
  cameras_with_errors: number;
  active_streams: number;
  validation_errors_24h: number;
}

export interface MembershipSummary {
  account_id: Uuid;
  account_name: string;
  account_slug: string;
  role: "owner" | "admin" | "viewer";
}

export interface CurrentUser {
  user_id: Uuid;
  aal: string;
  amr: string[];
  memberships: MembershipSummary[];
}

export interface AccountSummary {
  id: Uuid;
  name: string;
  slug: string;
  plan: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface AccountLimits {
  account_id: Uuid;
  max_cameras: number;
  max_concurrent_sessions: number;
  max_fps: number;
  max_width: number;
  max_height: number;
  max_bitrate_kbps: number;
  allowed_codecs: string[];
  allowed_stream_types: string[];
  monthly_minutes_quota: number;
  snapshot_storage_mb: number;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

// The seven processor observation types P4 emits. `ObservationRecord.type`
// stays a plain `string` (not this union) because `observations.type` is an
// open-vocabulary column server-side — an older or future type must never
// break a read. This union is for the filter dropdown's known options.
export type ObservationType =
  | "processor.line_crossing"
  | "processor.line_crossing_object"
  | "processor.roi_occupancy"
  | "processor.zone_entered"
  | "processor.zone_exited"
  | "processor.dwell_started"
  | "processor.dwell_updated"
  | "processor.dwell_exceeded";

export interface ObservationRecord {
  id: Uuid;
  camera_id: Uuid;
  stream_session_id: Uuid;
  processor_id: string | null;
  package_id: string | null;
  type: string;
  payload: Record<string, unknown>;
  observed_at: IsoDateTime;
  created_at: IsoDateTime;
}

export interface RecentObservationsResponse {
  observations: ObservationRecord[];
}

// --- Perception snapshot (P5-C latest-perception API; consumed by the P5-D
// latest-frame overlay) -------------------------------------------------------
// The `snapshot` payload is stored server-side as opaque JSONB — the api-server
// validates only the envelope, never the nested objects/geometry. These types
// describe the *expected* shape; treat every nested field as possibly-absent
// and normalize defensively before rendering (see `perception-overlay.ts`).

export interface PerceptionPoint {
  x: number;
  y: number;
}

export interface PerceptionBBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PerceptionObject {
  track_id?: string | null;
  class_id?: number | null;
  label?: string | null;
  confidence?: number | null;
  bbox?: PerceptionBBox | null;
  bbox_normalized?: PerceptionBBox | null;
  roi_labels?: string[];
}

export interface PerceptionGeometryRoi {
  id: string;
  label?: string | null;
  points: PerceptionPoint[];
}

export interface PerceptionGeometryLine {
  id: string;
  label?: string | null;
  points: PerceptionPoint[];
}

export interface LatestPerceptionPayload {
  frame: {
    width?: number | null;
    height?: number | null;
    frame_num?: number | null;
    fps?: number | null;
  };
  objects: PerceptionObject[];
  geometry: {
    rois?: PerceptionGeometryRoi[];
    lines?: PerceptionGeometryLine[];
  };
  source?: Record<string, unknown>;
  debug?: Record<string, unknown>;
}

export interface LatestPerceptionRecord {
  id: Uuid;
  camera_id: Uuid;
  stream_session_id: Uuid;
  processor_id: string | null;
  package_id: string | null;
  observed_at: IsoDateTime;
  updated_at: IsoDateTime;
  snapshot: LatestPerceptionPayload;
}

export interface LatestPerceptionResponse {
  snapshot: LatestPerceptionRecord;
}

/**
 * Response of `POST /v1/cameras/{id}/perception/stream-token` — short-lived
 * credentials for the perception-fanout WS hot path (10–15 Hz detection
 * overlays). `ws_url` is the full browser-reachable subscribe endpoint; the
 * client appends `?token=...`. The token must never be logged or persisted.
 */
export interface PerceptionStreamTokenResponse {
  token: string;
  ws_url: string;
  expires_at: IsoDateTime;
}

// --- Camera Geometry Config (P6-A) ------------------------------------------
// Dashboard-authored ROI/line geometry for one camera. *Processing geometry
// only* — presentation (colors, strokes, fill) stays frontend-owned. The
// server uses Pydantic models with `extra="forbid"`, so any unknown field
// in a PUT body is rejected with 422 `validation_error`.
//
// Source of truth (do not drift): ../upstream-api-server/src/upstream_api/
// schemas/geometry.py and ../upstream-api-server/docs/api-contracts.md
// (`/v1/cameras/{camera_id}/geometry-config` GET + PUT, ~line 818).
//
// Two version-like numbers, never conflated:
//  - `GeometryConfig.version`  — JSON schema version (always 1 today).
//  - `GeometryConfigRecord.revision` — DB row revision: 0 = unsaved
//    probe-default the server returns when nothing is saved yet, 1 = first
//    save, +1 on every subsequent PUT.

export type GeometryLineDirection = "any" | "in" | "out";

/** Normalized vertex; origin top-left, x/y both in [0, 1]. */
export interface GeometryPoint {
  x: number;
  y: number;
}

/** Reference frame the geometry was authored against (provenance only). */
export interface GeometryFrame {
  width?: number | null;
  height?: number | null;
  coordinate_space: "normalized";
}

/** Analytics ROI as an ordered polygon (≥ 3 vertices, ≤ 64). */
export interface GeometryRoi {
  id: string;
  label?: string | null;
  type: "polygon";
  points: GeometryPoint[];
  enabled: boolean;
}

/** Crossing line — exactly two segment endpoints. */
export interface GeometryLine {
  id: string;
  label?: string | null;
  points: GeometryPoint[];
  direction: GeometryLineDirection;
  enabled: boolean;
}

/** Full geometry config payload stored in `camera_geometry_configs.config`. */
export interface GeometryConfig {
  version: 1;
  frame: GeometryFrame;
  rois: GeometryRoi[];
  lines: GeometryLine[];
}

/**
 * One camera's geometry config, shaped for a read response. `id` and
 * timestamps are `null` and `revision` is `0` when this is the unsaved
 * probe-default (`is_default = true`). The GET endpoint always returns a
 * valid record — there is no "no geometry yet" 404 branch.
 */
export interface GeometryConfigRecord {
  id: Uuid | null;
  camera_id: Uuid;
  revision: number;
  config: GeometryConfig;
  is_default: boolean;
  created_at: IsoDateTime | null;
  updated_at: IsoDateTime | null;
}

/** GET /v1/cameras/{camera_id}/geometry-config response envelope. */
export interface GeometryConfigResponse {
  geometry_config: GeometryConfigRecord;
}

/** PUT /v1/cameras/{camera_id}/geometry-config request body. */
export interface GeometryConfigUpdateRequest {
  config: GeometryConfig;
}

// --- Model Registry + Camera Processing Config (M5) -------------------------
// Operator-chosen detection model + which object classes to detect for one
// camera. *Processing facts only* — presentation (hue, ordering) stays
// frontend-owned; no styling fields ride the wire. The server uses Pydantic
// models, so any unknown field in a PUT body is rejected with 422
// `validation_error`.
//
// Source of truth (do not drift): ../upstream-api-server/docs/api-contracts.md
//   GET /v1/models                                  → ModelsListResponse
//   GET/PUT /v1/cameras/{camera_id}/processing-config → CameraProcessingConfigResponse
//
// Backend validation is authoritative: `model_key` must exist + be enabled;
// `selected_classes` of `[]` means "all supported classes", otherwise it must
// be a subset of the chosen model's `supported_classes`; `tracker` (if set)
// must be one of `supported_trackers`. The M5 dashboard only authors
// `model_key` + `selected_classes` — `tracker` / `confidence_threshold` /
// `processing_fps` ride as `null` (those controls land in M6).
//
// Two version-like numbers, never conflated:
//  - `CameraProcessingConfig.version` — JSON schema version (always 1 today).
//  - `CameraProcessingConfigRecord.revision` — DB row revision: 0 = unsaved
//    default the server returns when nothing is saved, 1 = first save, +1 on
//    every subsequent PUT.

/** One model in the registry the operator can pick from. */
export interface ModelRegistryEntry {
  model_key: string;
  display_name: string;
  description: string | null;
  task_type: string;
  runtime: string;
  default_confidence_threshold: number | null;
  supported_classes: string[];
  supported_trackers: string[];
  model_version: string | null;
  detector_version: string | null;
  resource_profile: string | null;
  enabled: boolean;
  notes: string | null;
  limitations: string[] | null;
}

/** GET /v1/models response envelope. */
export interface ModelsListResponse {
  models: ModelRegistryEntry[];
}

/**
 * Full processing config payload stored in
 * `camera_processing_configs.config`. `selected_classes` of `[]` is the
 * "all supported classes" sentinel — never conflate it with "detect nothing".
 */
export interface CameraProcessingConfig {
  version: 1;
  model_key: string;
  selected_classes: string[];
  tracker: string | null;
  confidence_threshold: number | null;
  processing_fps: number | null;
}

/**
 * One camera's processing config, shaped for a read response. `id` and
 * timestamps are `null` and `revision` is `0` when this is the unsaved
 * default (`is_default = true`). The GET endpoint always returns a valid
 * record — there is no "no config yet" 404 branch.
 */
export interface CameraProcessingConfigRecord {
  id: Uuid | null;
  account_id: Uuid;
  camera_id: Uuid;
  revision: number;
  config: CameraProcessingConfig;
  is_default: boolean;
  created_at: IsoDateTime | null;
  updated_at: IsoDateTime | null;
}

/** GET/PUT /v1/cameras/{camera_id}/processing-config response envelope. */
export interface CameraProcessingConfigResponse {
  processing_config: CameraProcessingConfigRecord;
}

// --- Processing packages (P5-F catalog + P5-G camera request/apply) ----------
// TS mirrors of the api-server schemas. Source of truth (do not drift):
// ../upstream-api-server/src/upstream_api/schemas/processing_packages.py and
// schemas/processing_config_camera.py; services/package_catalog.py for the
// curated catalog data. See ../upstream-api-server/docs/api-contracts.md.

/** Curation/readiness status of a processing package. */
export type ProcessingPackageStatus =
  | "probe"
  | "experimental"
  | "supported"
  | "deprecated";

/**
 * P5-L — PUBLISHED reference benchmarks for a package's backing model, for the
 * model-comparison UI. These are NOT measured by Upstream on customer hardware
 * (`upstream_measured` is always false; `metric_source` is the provenance).
 * COCO fields apply to COCO-trained detectors (YOLOX/Ultralytics); NVIDIA TAO
 * models (TrafficCamNet/PeopleNet) have no COCO mAP, so those are null and a
 * clearly-labelled vendor KPI rides in `vendor_kpi_*` (NOT comparable to COCO).
 */
export interface ModelMetrics {
  metric_source: string;
  upstream_measured: boolean;
  metric_dataset: string | null;
  coco_map50_95: number | null;
  coco_map50: number | null;
  params_m: number | null;
  input_size: number | null;
  backbone: string | null;
  vendor_kpi_label: string | null;
  vendor_kpi_value: number | null;
  vendor_kpi_note: string | null;
}

/**
 * One processing package from the catalog (GET /v1/processing/packages). A
 * package is a curated bundle: a detection model + (optional) tracker +
 * (optional) analytics profile, plus the safe operator overrides it allows.
 * `production_ready` is an honesty gate (true only when status is
 * "supported"); the catalog is all probe/experimental today. `warnings`,
 * `limitations`, and `readiness_notes` are server-authored — render them, never
 * hardcode package guidance.
 */
export interface ProcessingPackage {
  package_id: string;
  display_name: string;
  description: string | null;
  category: string;
  status: ProcessingPackageStatus;
  production_ready: boolean;
  test_mode_safe: boolean;
  runtime: string;
  model_id: string | null;
  tracker_profile_id: string | null;
  analytics_profile_id: string | null;
  supported_classes: string[];
  supported_outputs: string[];
  supported_shapes: string[];
  supported_triggers: string[];
  default_settings: Record<string, unknown>;
  allowed_overrides: string[];
  compute_tier: string | null;
  pricing_tier: string | null;
  observation_volume_risk: string | null;
  // P5-K licensing/provenance (orthogonal to status). license_class:
  // "permissive" | "commercial_agreement" | "restrictive". first_party: may
  // Upstream auto-provide this as a first-party package? false for AGPL/
  // restrictive models — BYOM / your own license (badged in the UI; hidden by
  // the catalog gate in production).
  license_class: string;
  first_party: boolean;
  warnings: string[];
  limitations: string[];
  best_for: string[];
  not_recommended_for: string[];
  requires_geometry: boolean;
  requires_restart: boolean;
  readiness_notes: string | null;
  related_packages: string[];
  // P5-L: published reference benchmarks for the backing model (null for
  // diagnostic/mock packages or models with no curated stats).
  model_metrics: ModelMetrics | null;
}

/** A catalog category bucket (e.g. people_analytics → "People Analytics"). */
export interface ProcessingPackageCategory {
  id: string;
  display_name: string;
}

/** GET /v1/processing/packages response envelope. */
export interface ProcessingPackageCatalogResponse {
  packages: ProcessingPackage[];
  categories: ProcessingPackageCategory[];
  warnings: string[];
}

/**
 * Safe operator overrides on a package. Each key is gated by the package's
 * `allowed_overrides`; only send the ones the package allows. `target_fps`
 * maps to the processor's `processing_fps` seam; `selected_classes` of `[]`
 * means "all supported classes".
 */
export interface CameraPackageSettings {
  confidence_threshold?: number | null;
  target_fps?: number | null;
  selected_classes?: string[];
}

/** PUT /v1/cameras/{camera_id}/processing-config/package request body. */
export interface CameraPackageRequest {
  package_id: string;
  settings: CameraPackageSettings;
  /** Explicit opt-in required to request an `experimental` package. */
  allow_experimental: boolean;
}

/** The operator's requested package + safe settings (revision-tracked). */
export interface RequestedPackageConfig {
  package_id: string;
  settings: CameraPackageSettings;
  revision: number;
  updated_at: IsoDateTime | null;
  updated_by: string | null;
}

/**
 * What the processor last actually ran, derived from the latest
 * `processor_statuses` row. All fields are null until a worker has reported.
 */
export interface AppliedPackageConfig {
  package_id: string | null;
  model_id: string | null;
  tracker_profile_id: string | null;
  analytics_profile_id: string | null;
  status: string | null;
  applied_at: IsoDateTime | null;
}

/**
 * Derived request/apply lifecycle for a camera's package:
 * - unset: no package requested (default processing runs)
 * - active: requested == applied and the latest run is healthy
 * - pending_apply: requested, but no processor run yet
 * - pending_restart: requested != applied (applies next session)
 * - failed_config: latest run for the requested package failed
 * - experimental_selected: the active package is experimental
 */
export type CameraPackageState =
  | "unset"
  | "active"
  | "pending_apply"
  | "pending_restart"
  | "failed_config"
  | "experimental_selected";

/**
 * GET/PUT/apply /v1/cameras/{camera_id}/processing-config/package response.
 * `warnings` is server-authored (experimental / not-production / failure).
 */
export interface CameraPackageConfigResponse {
  camera_id: Uuid;
  requested: RequestedPackageConfig | null;
  applied: AppliedPackageConfig | null;
  state: CameraPackageState;
  warnings: string[];
}

// --- Processing runtime evidence (P5-J) --------------------------------------
// Read-only visibility summary. TS mirror of
// ../upstream-api-server/src/upstream_api/schemas/processing_evidence.py.
// VISIBILITY, NOT recommendations.

export type ProcessingEvidenceRange = "1h" | "24h";

export interface EvidenceWindow {
  range: ProcessingEvidenceRange;
  started_at: IsoDateTime;
  ended_at: IsoDateTime;
}

export interface EvidencePackage {
  requested_package_id: string | null;
  applied_package_id: string | null;
  state: CameraPackageState;
  requested_revision: number | null;
}

/** What actually ran, from the latest processor status payload (all nullable). */
export interface EvidenceLineage {
  model_id: string | null;
  tracker_profile_id: string | null;
  tracker_algorithm: string | null;
  analytics_profile_id: string | null;
}

export interface EvidenceStatus {
  status: string | null;
  last_seen_at: IsoDateTime | null;
  last_error_code: string | null;
  updated_at: IsoDateTime | null;
}

export interface EvidenceObservationCount {
  type: string;
  count: number;
}

export interface EvidenceLifecycle {
  inferred_zone_exits: number;
  track_missing_timeout_exits: number;
}

/** Tracker metrics from the latest status — SESSION-LEVEL, not windowed. */
export interface EvidenceTracking {
  unique_tracker_ids_count: number | null;
  tracker_ids_sample: string[];
  is_session_level: boolean;
}

export interface EvidencePackageHistoryItem {
  id: Uuid;
  event_type: string;
  package_id: string | null;
  actor_type: string;
  actor_user_id: Uuid | null;
  summary: string;
  created_at: IsoDateTime;
}

export interface ProcessingEvidenceResponse {
  camera_id: Uuid;
  window: EvidenceWindow;
  package: EvidencePackage;
  lineage: EvidenceLineage;
  status: EvidenceStatus;
  observation_counts: EvidenceObservationCount[];
  lifecycle: EvidenceLifecycle;
  tracking: EvidenceTracking;
  package_history: EvidencePackageHistoryItem[];
  warnings: string[];
}

// --- Processor Status (P6-D latest-processor-status API) ---------------------
// The latest `processor_statuses` row for one camera, including the `payload`
// JSONB where the P6-C analytics worker stamps the `applied_geometry` lineage
// block. Read counterpart that lets the Monitor-tab Applied Geometry chip
// confirm the processor actually picked up the operator's saved geometry.
//
// Source of truth (do not drift): ../upstream-api-server/src/upstream_api/
// schemas/processor.py (`ProcessorStatusRecord`, `LatestProcessorStatusResponse`)
// and ../upstream-api-server/docs/api-contracts.md
// (`/v1/cameras/{camera_id}/processor-status/latest`).

/**
 * The geometry lineage block the P6-C analytics worker stamps onto every
 * status post via `payload.applied_geometry`. The chip reads this directly.
 *
 * `source` is unioned with `string` so a future server-side source value
 * doesn't crash the type — the chip explicitly handles the unknown case.
 */
export interface AppliedGeometry {
  source:
    | "operator_saved"
    | "default"
    | "fallback_default_on_error"
    | (string & {});
  revision: number | null;
  line_count: number;
  roi_count: number;
  error_reason?: string | null;
}

export type ProcessorStatusValue =
  | "starting"
  | "attached"
  | "processing"
  | "lagging"
  | "failed"
  | "stopped";

export interface ProcessorStatusRecord {
  id: Uuid;
  camera_id: Uuid;
  stream_session_id: Uuid;
  processor_id: string;
  runtime: string;
  package_id: string;
  status: ProcessorStatusValue | (string & {});
  fps_input: number | null;
  fps_processed: number | null;
  last_frame_at: IsoDateTime | null;
  last_observation_at: IsoDateTime | null;
  error_code: string | null;
  error_message: string | null;
  // Opaque JSONB — the server doesn't deep-validate. `applied_geometry` is
  // the P6-C lineage block when present; future runtime metadata may live
  // alongside it under other keys.
  payload: Record<string, unknown> & { applied_geometry?: AppliedGeometry };
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** GET /v1/cameras/{camera_id}/processor-status/latest response envelope. */
export interface LatestProcessorStatusResponse {
  status: ProcessorStatusRecord;
}

// ---------------------------------------------------------------------------
// Reliability findings (M0/M1-A). Source of truth:
// upstream-api-server/src/upstream_api/schemas/reliability.py
// upstream-api-server/supabase/migrations/20260528120000_reliability_findings.sql
//
// `category` and `severity` are closed unions (DB CHECK-constrained) so the
// dashboard switches on them safely. `finding_type` is an open `string` —
// the table column is open vocabulary so the API server can ship new rules
// without a contract change. The `(string & {})` brand keeps known literals
// surfacing in autocomplete while still accepting future values.
// ---------------------------------------------------------------------------

export type ReliabilityCategory =
  | "stream"
  | "processor"
  | "scene_quality"
  | "geometry_config"
  | "detection";

export type ReliabilitySeverity = "info" | "warning" | "critical";

export type ReliabilityStatus = "open" | "resolved" | "suppressed" | "ignored";

export type ReliabilitySummaryStatus =
  | "healthy"
  | "info"
  | "needs_review"
  | "critical"
  | "unknown";

export type ReliabilityFindingType =
  | "stream_valid_processor_silent"
  | "latest_frame_stale"
  | "scene_too_dark_for_reliable_detection"
  | "processor_using_default_geometry"
  | "unstable_detection_confidence"
  | (string & {});

export interface ReliabilityFinding {
  id: string;
  camera_id: string;
  stream_session_id: string | null;
  processor_status_id: string | null;
  finding_type: ReliabilityFindingType;
  category: ReliabilityCategory;
  severity: ReliabilitySeverity;
  status: ReliabilityStatus;
  title: string;
  message: string;
  likely_cause: string | null;
  recommended_action: string | null;
  // Opaque JSONB — evaluators stamp rule-specific keys. The dashboard never
  // reads these directly today; surfacing them through the UI happens via
  // the structured `title` / `message` / `recommended_action` strings.
  evidence: Record<string, unknown>;
  dedupe_key: string;
  detector_version: string;
  first_seen_at: IsoDateTime;
  last_seen_at: IsoDateTime;
  resolved_at: IsoDateTime | null;
  resolved_reason: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ReliabilityFindingsResponse {
  findings: ReliabilityFinding[];
  last_evaluated_at: IsoDateTime;
}

export interface ReliabilitySummary {
  camera_id: string;
  status: ReliabilitySummaryStatus;
  highest_severity: ReliabilitySeverity | null;
  open_findings_count: number;
  top_findings: ReliabilityFinding[];
  recommended_next_action: string | null;
  last_evaluated_at: IsoDateTime;
}

// Reliability M7 — hourly detection-confidence history for the Reliability tab's
// trend chart. Aggregated across packages to one point per hour by the read API
// (backed by detection_confidence_hourly_rollups). Confidence stats are `null`
// for an hour that carried no usable confidence (rendered as a gap).
export type ConfidenceTrendRange = "24h" | "7d";

export interface ConfidenceTrendPoint {
  bucket_start: IsoDateTime;
  bucket_end: IsoDateTime;
  avg_confidence: number | null;
  min_confidence: number | null;
  max_confidence: number | null;
  low_confidence_ratio: number | null;
  confidence_stddev: number | null;
  metric_count: number;
  object_count_total: number;
  confidence_sample_count: number;
}

export interface ConfidenceTrendSummary {
  point_count: number;
  latest_avg_confidence: number | null;
  lowest_avg_confidence: number | null;
  highest_avg_confidence: number | null;
  total_confidence_samples: number;
  latest_bucket_start: IsoDateTime | null;
}

export interface ConfidenceTrendResponse {
  camera_id: Uuid;
  range: ConfidenceTrendRange;
  bucket_size: "1h";
  points: ConfidenceTrendPoint[];
  summary: ConfidenceTrendSummary;
}

// Model-config M9/M10 — the same hourly confidence history split into one
// series per APPLIED processing-config group, served by
// GET /v1/cameras/{id}/reliability/confidence-trend/by-config. Dimension
// fields are `null` for history recorded before the processor stamped
// applied_processing_config (pre-M8) — those rows form their own "no config
// metadata" group rather than being dropped. Honest-data note: grouped trends
// show association under a config, not proven causation; nothing here implies
// model/tracker/FPS apply or class-filtered line/ROI counts are live.

// The processor resolver's status vocabulary (mirrors the api-server Literal).
export type ProcessingConfigStatus =
  | "applied"
  | "partially_applied"
  | "requested_not_applied"
  | "applied_defaults"
  | "fallback_default_on_error";

export interface ConfidenceTrendConfigGroup {
  processing_config_source: string | null;
  processing_config_revision: number | null;
  processing_config_status: string | null;
  applied_model_key: string | null;
  // Canonical key: "all", "person", "car,person" (sorted), or "unknown".
  applied_selected_classes_key: string | null;
  applied_confidence_threshold: number | null;
  // M9.1: dedicated FPS dimensions (M7E output-cadence apply — cadence only,
  // not inference FPS; no GPU-cost implication).
  requested_processing_fps: number | null;
  applied_processing_fps: number | null;
  // Producer warning codes, e.g. "selected_classes_analytics_counts_not_filtered".
  processing_config_warnings: string[] | null;
  points: ConfidenceTrendPoint[];
  summary: ConfidenceTrendSummary;
}

export interface ConfidenceTrendByConfigResponse {
  camera_id: Uuid;
  range: ConfidenceTrendRange;
  bucket_size: "1h";
  group_count: number;
  groups: ConfidenceTrendConfigGroup[];
}

// Model-config M11 — config comparison report card. DESCRIPTIVE only: the
// backend returns factual directions/deltas and a neutral status, never a
// verdict or recommendation; the UI must keep that posture.

export type ConfigComparisonStatus =
  | "comparable"
  | "mixed_metrics"
  | "inconclusive"
  | "no_data";

export type ConfigComparisonMode =
  | "explicit"
  | "latest_vs_previous"
  | "recent_vs_prior"
  | "none";

export interface ConfigComparisonGroup {
  group_key: string;
  label: string;
  processing_config_source: string | null;
  processing_config_revision: number | null;
  processing_config_status: string | null;
  applied_model_key: string | null;
  applied_selected_classes_key: string | null;
  applied_confidence_threshold: number | null;
  requested_processing_fps: number | null;
  applied_processing_fps: number | null;
  warnings: string[];
  sample_count: number;
  avg_confidence: number | null;
  low_confidence_ratio: number | null;
  latest_bucket_start: IsoDateTime | null;
}

export interface ConfigComparisonDeltas {
  avg_confidence_delta: number | null;
  avg_confidence_percent_delta: number | null;
  low_confidence_ratio_delta: number | null;
  sample_count_delta: number;
  applied_processing_fps_delta: number | null;
}

export interface ConfigComparisonSummaryResponse {
  camera_id: Uuid;
  range: ConfidenceTrendRange;
  generated_at: IsoDateTime;
  comparison_mode: ConfigComparisonMode;
  min_samples: number;
  baseline: ConfigComparisonGroup | null;
  candidate: ConfigComparisonGroup | null;
  metric_deltas: ConfigComparisonDeltas | null;
  comparison_status: ConfigComparisonStatus;
  metric_directions: string[];
  summary: string;
  bullets: string[];
  comparability_notes: string[];
  caveats: string[];
}

// --- Rules/Triggers M1 -------------------------------------------------------
// Source: ../upstream-api-server/src/upstream_api/schemas/rules.py + alerts.py

/** Rule types the api-server currently accepts on create. */
export type RuleType =
  | "line_crossing"
  | "roi_occupancy"
  | "zone_entered"
  | "dwell_exceeded"
  // M4 time-based rules — evaluated by the periodic workflow evaluator,
  // not the observation ingest path.
  | "camera_offline"
  | "no_detections_for";

export type RuleSeverity = "info" | "warning" | "critical";

export interface Rule {
  id: Uuid;
  camera_id: Uuid;
  name: string;
  // Plain string (not RuleType) — the DB column is open vocabulary, so reads
  // must tolerate types this build doesn't know yet.
  rule_type: string;
  enabled: boolean;
  config: Record<string, unknown>;
  severity: string;
  cooldown_seconds: number;
  created_by: Uuid | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface RuleListResponse {
  rules: Rule[];
}

export type AlertStatus = "open" | "resolved";

export interface Alert {
  id: Uuid;
  camera_id: Uuid;
  rule_id: Uuid | null;
  observation_id: Uuid | null;
  // M2: the workflow run whose action step created this alert. Null on
  // alerts written before the workflow_runs migration.
  workflow_run_id: Uuid | null;
  severity: string;
  status: string;
  title: string;
  message: string;
  payload: Record<string, unknown>;
  created_at: IsoDateTime;
  read_at: IsoDateTime | null;
  resolved_at: IsoDateTime | null;
}

export interface AlertListResponse {
  alerts: Alert[];
}

// --- Workflow Engine M2 ------------------------------------------------------
// Source: ../upstream-api-server/src/upstream_api/schemas/workflow_runs.py

/** Statuses the api-server currently writes/accepts as a filter. */
export type WorkflowRunStatus =
  | "active"
  | "completed"
  | "failed"
  | "action_required"
  | "suppressed";

export interface WorkflowRunAlertRef {
  id: Uuid;
  status: string;
  severity: string;
}

export interface WorkflowRun {
  id: Uuid;
  camera_id: Uuid | null;
  rule_id: Uuid | null;
  // M5: set on sequence runs (null on simple/timer rule runs).
  workflow_id: Uuid | null;
  trigger_observation_id: Uuid | null;
  // Open vocabulary on reads (workflow_type/trigger_type/action_result are
  // open at the DB layer; status tolerates values a newer deploy writes).
  workflow_type: string;
  status: string;
  title: string;
  summary: string;
  trigger_type: string;
  action_result: string | null;
  evidence: Record<string, unknown>;
  payload: Record<string, unknown>;
  alert: WorkflowRunAlertRef | null;
  // M5: when an active sequence run times out (null otherwise).
  deadline_at: IsoDateTime | null;
  started_at: IsoDateTime;
  ended_at: IsoDateTime | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface WorkflowRunListResponse {
  runs: WorkflowRun[];
}

// --- Workflow Engine M5 ------------------------------------------------------
// Source: ../upstream-api-server/src/upstream_api/schemas/workflows.py

export type WorkflowType = "sequence";

export interface Workflow {
  id: Uuid;
  camera_id: Uuid;
  name: string;
  description: string | null;
  // Plain string — the DB column is open vocabulary.
  workflow_type: string;
  enabled: boolean;
  config: Record<string, unknown>;
  severity: string;
  cooldown_seconds: number;
  created_by: Uuid | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface WorkflowListResponse {
  workflows: Workflow[];
}

// --- Module 7 M1: usage summary ---------------------------------------------
// Source: ../upstream-api-server/src/upstream_api/schemas/usage.py

export type UsageState = "ok" | "near_limit" | "at_limit" | "over_limit";

export interface UsageSummary {
  plan: {
    key: string;
    label: string;
    status: string;
  };
  period: {
    start: IsoDateTime;
    end: IsoDateTime;
  };
  limits: {
    max_cameras: number;
    max_concurrent_sessions: number;
    monthly_minutes_quota: number;
    allowed_stream_types: string[];
  };
  usage: {
    cameras: number;
    active_streams: number;
    // Completed stream minutes only (session_ended events) — active
    // sessions are not counted until they end.
    stream_minutes: number;
    workflow_runs: number;
    alerts: number;
    rules: number;
    workflows: number;
  };
  states: {
    cameras: UsageState;
    active_streams: UsageState;
    stream_minutes: UsageState;
  };
  // Module 7 M2 — no Stripe IDs are exposed, only states/capabilities.
  billing: {
    provider: "stripe";
    // False when the deployment has no Stripe keys (dev/local).
    configured: boolean;
    // Derived: none | active | trialing | past_due | canceled.
    status: string;
    // Raw Stripe subscription status (null before first checkout).
    subscription_status: string | null;
    current_period_start: IsoDateTime | null;
    current_period_end: IsoDateTime | null;
    cancel_at_period_end: boolean;
    // True when a Stripe customer exists — Manage Billing can open the Portal.
    management_available: boolean;
  };
}

// --- Module 7 M3: tenant audit logs ------------------------------------------
// Source: ../upstream-api-server/src/upstream_api/routers/audit_logs.py

export interface AuditLogActor {
  // user | system | stripe | internal (open vocabulary).
  type: string;
  user_id: Uuid | null;
}

export interface AuditLogItem {
  id: Uuid;
  created_at: IsoDateTime;
  actor: AuditLogActor;
  // Dotted verb, e.g. "camera.created", "billing.plan_changed".
  event_type: string;
  resource_type: string | null;
  resource_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
}

export interface AuditLogListResponse {
  items: AuditLogItem[];
  // created_at keyset cursor — pass back as ?before= for the next page.
  next_cursor: IsoDateTime | null;
}

// ---------------------------------------------------------------------------
// Upstream Reliability — Collector (M1a/M1c). Mirrors
// ../upstream-api-server/src/upstream_api/schemas/reliability_observations.py.
// `cv_issues` shape — distinct from the processor-side ReliabilityFinding.
// ---------------------------------------------------------------------------

export type ReliabilityIssueCategory =
  | "count"
  | "confidence"
  | "liveness"
  | "tracker";

export interface ReliabilityIssue {
  id: Uuid;
  camera_id: Uuid | null;
  source_batch_id: Uuid | null;
  external_camera_key: string | null;
  issue_type: string;
  category: ReliabilityIssueCategory;
  severity: ReliabilitySeverity;
  status: ReliabilityStatus;
  title: string;
  message: string;
  likely_cause: string | null;
  recommended_action: string | null;
  evidence: Record<string, unknown>;
  dedupe_key: string;
  detector_version: string;
  source_observation_ids: string[] | null;
  first_seen_at: IsoDateTime;
  last_seen_at: IsoDateTime;
  resolved_at: IsoDateTime | null;
  resolved_reason: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ReliabilityIssueListResponse {
  issues: ReliabilityIssue[];
}

export interface CollectorBatch {
  id: Uuid;
  source: string;
  external_camera_key: string | null;
  observation_count: number;
  status: string;
  received_at: IsoDateTime;
}

export interface CollectorSource {
  source: string;
  external_camera_key: string | null;
  last_seen_at: IsoDateTime | null;
  recent_observations: number;
  recent_events: number;
  recent_detection_summaries: number;
  open_issues: number;
}

// Cloud-visible collector heartbeat — safe counters only (no tokens/payloads).
export interface CollectorHeartbeat {
  observed_at: IsoDateTime;
  source: string | null;
  version: string | null;
  running: boolean | null;
  cloud_reachable: boolean | null;
  spooled_batches: number | null;
  spooled_observations: number | null;
  uploaded_batches: number | null;
  uploaded_observations: number | null;
  dropped_batches: number | null;
  dropped_observations: number | null;
  last_upload_at: IsoDateTime | null;
  last_error_code: string | null;
}

export interface CollectorStatus {
  last_received_at: IsoDateTime | null;
  recent_batch_count: number;
  recent_observation_count: number;
  active_source_count: number;
  open_issue_count: number;
  latest_collector_heartbeat: CollectorHeartbeat | null;
  sources: CollectorSource[];
  recent_batches: CollectorBatch[];
}
