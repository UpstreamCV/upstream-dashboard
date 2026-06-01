import "server-only";

import { serverFetch } from "./server";
import type {
  CameraProcessingConfig,
  CameraProcessingConfigRecord,
  CameraProcessingConfigResponse,
} from "./types";

// Camera Processing Config wrapper (M5).
//
// Endpoints already exist on upstream-api-server; no backend changes here.
// Contract: ../upstream-api-server/docs/api-contracts.md
//   GET /v1/cameras/{camera_id}/processing-config  → CameraProcessingConfigResponse
//   PUT /v1/cameras/{camera_id}/processing-config  → CameraProcessingConfigResponse
//
// Notes:
//
// - GET always returns 200. When a camera has no operator-saved config the
//   server synthesizes a default config and returns `is_default: true`,
//   `revision: 0`, `id: null`, null timestamps. There is no "no config yet"
//   404 branch — only `camera_not_found` (404) when the camera id is unknown
//   or belongs to a different account. Callers decide between `notFound()`
//   and other handling for that one case.
//
// - PUT replaces the whole config (no PATCH) and bumps `revision` by one.
//   Returns the new CameraProcessingConfigRecord with `is_default: false`.
//   Validation failures (unknown model_key, disabled model, a class outside
//   the model's supported_classes, etc.) surface as 422 `validation_error`.
//   The dashboard should call validateProcessingConfig from
//   @/lib/perception/processing-config-schema before this wrapper so authoring
//   errors render inline instead of round-tripping.
//
// - This is account-level distinct from src/lib/api/processing-config.ts (the
//   account master switch). Names are prefixed CameraProcessingConfig* so the
//   two never collide.

/**
 * GET the current processing config for one camera. Always resolves to a valid
 * `CameraProcessingConfigRecord` for any reachable camera — the server returns
 * the system default when nothing is saved (`is_default: true`, `revision: 0`).
 * Only `camera_not_found` (404) throws.
 */
export async function getCameraProcessingConfig(opts: {
  accountId: string;
  cameraId: string;
}): Promise<CameraProcessingConfigRecord> {
  const res = await serverFetch<CameraProcessingConfigResponse>(
    `/v1/cameras/${opts.cameraId}/processing-config`,
    { accountId: opts.accountId },
  );
  return res.processing_config;
}

/**
 * PUT a full replacement processing config. Returns the new
 * `CameraProcessingConfigRecord` with `is_default: false` and `revision`
 * bumped. Validation failures throw `UpstreamApiError(422)`.
 */
export async function putCameraProcessingConfig(opts: {
  accountId: string;
  cameraId: string;
  config: CameraProcessingConfig;
}): Promise<CameraProcessingConfigRecord> {
  const res = await serverFetch<CameraProcessingConfigResponse>(
    `/v1/cameras/${opts.cameraId}/processing-config`,
    {
      accountId: opts.accountId,
      method: "PUT",
      body: { config: opts.config },
    },
  );
  return res.processing_config;
}
