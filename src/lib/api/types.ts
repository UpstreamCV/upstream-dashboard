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
