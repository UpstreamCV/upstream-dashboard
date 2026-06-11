export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown> | null;
    request_id?: string;
  };
}

export class UpstreamApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown> | null;
  readonly requestId: string | undefined;

  constructor(status: number, envelope: ApiErrorEnvelope) {
    super(envelope.error.message);
    this.name = "UpstreamApiError";
    this.status = status;
    this.code = envelope.error.code;
    this.details = envelope.error.details ?? null;
    this.requestId = envelope.error.request_id;
  }
}

export type ErrorCategory =
  | "auth"
  | "permission"
  | "not_found"
  | "limit"
  | "conflict"
  | "validation"
  | "internal";

export function classify(code: string): ErrorCategory {
  if (
    code === "missing_credentials" ||
    code === "invalid_auth_scheme" ||
    code === "invalid_token" ||
    code === "token_revoked" ||
    code === "token_expired" ||
    code === "invalid_user_token"
  ) {
    return "auth";
  }
  if (code.startsWith("forbidden") || code === "invalid_scopes") {
    return "permission";
  }
  if (code.endsWith("_not_found") || code === "not_found") {
    return "not_found";
  }
  if (code.startsWith("limit_exceeded") || code === "snapshot_quota_exceeded") {
    return "limit";
  }
  if (
    code === "camera_already_streaming" ||
    code === "agent_account_mismatch" ||
    code === "stream_state_invalid"
  ) {
    return "conflict";
  }
  if (
    code === "validation_error" ||
    code === "invalid_content_type" ||
    code === "snapshot_too_large"
  ) {
    return "validation";
  }
  return "internal";
}

const FRIENDLY: Record<string, string> = {
  billing_not_configured:
    "Billing isn't set up on this deployment yet. Contact support to change your plan.",
  billing_no_customer:
    "This account has no billing profile yet. Start an upgrade first.",
  invalid_webhook_signature: "Webhook signature verification failed.",
  "limit_exceeded.monthly_minutes_quota":
    "You have reached your monthly streaming minutes quota. Contact support or wait until your usage period resets.",
  "limit_exceeded.max_cameras":
    "Camera slot limit reached. Free a camera or contact your administrator.",
  "limit_exceeded.max_concurrent_sessions":
    "All available stream slots are in use. Wait for a session to end and try again.",
  "limit_exceeded.fps_too_high":
    "The requested frame rate is above this account's limit.",
  "limit_exceeded.resolution_too_high":
    "The requested resolution is above this account's limit.",
  "limit_exceeded.bitrate_too_high":
    "The requested bitrate is above this account's limit.",
  "limit_exceeded.codec_not_allowed":
    "The requested codec isn't enabled on this account.",
  camera_already_streaming:
    "Another session is already streaming for this camera.",
  agent_account_mismatch:
    "That agent doesn't belong to the current account.",
  stream_state_invalid:
    "That session is no longer in a state where this action is valid.",
  forbidden_account: "You aren't a member of this account.",
  "forbidden.role":
    "You don't have permission to do this. Owner or admin role required.",
  account_id_required:
    "Pick an account to continue. Use the account switcher in the top bar.",
  invalid_scopes: "Those scopes aren't allowed on this token.",
  token_revoked: "This token has been revoked.",
  token_expired: "This token has expired.",
  invalid_user_token: "Your session has expired. Sign in again.",
  validation_error: "Some fields didn't pass validation.",
};

export function friendlyMessage(err: UpstreamApiError): string {
  return FRIENDLY[err.code] ?? err.message ?? "Something went wrong.";
}
