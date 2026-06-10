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

export type CameraStatus = "idle" | "streaming" | "error" | "disabled";
export interface Camera {
  id: Uuid;
  account_id: Uuid;
  agent_id: Uuid;
  name: string;
  external_id: string | null;
  device_path: string | null;
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
