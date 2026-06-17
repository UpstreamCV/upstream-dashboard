import "server-only";

import { serverFetch } from "./server";
import type {
  CameraPackageConfigResponse,
  CameraPackageRequest,
} from "./types";

// Camera processing PACKAGE config wrapper (P5-G).
//
// Endpoints already exist on upstream-api-server; no backend changes here.
// Contract: ../upstream-api-server/docs/api-contracts.md
//   GET  /v1/cameras/{camera_id}/processing-config/package → CameraPackageConfigResponse
//   PUT  /v1/cameras/{camera_id}/processing-config/package → CameraPackageConfigResponse
//   POST /v1/cameras/{camera_id}/processing-config/apply   → CameraPackageConfigResponse
//
// This is the package-bundle request/apply concept (model + tracker + analytics
// + safe overrides + lifecycle state). It is DISTINCT from the legacy per-field
// model_key editor in camera-processing-config.ts; the names are prefixed
// CameraPackage* so the two never collide.
//
// Notes:
// - GET always returns 200 for a reachable camera (state "unset" when nothing
//   is requested). Only `camera_not_found` (404) throws.
// - PUT validates the request against the catalog (deprecated rejected;
//   experimental requires allow_experimental; selected_classes ⊆ supported;
//   setting keys ⊆ allowed_overrides) → 422 on failure.
// - POST apply confirms the requested config as the active intent; it takes
//   effect on the camera's NEXT session (no live restart). 409
//   `no_requested_config` if there is nothing requested to apply.

/** GET the requested/applied package state for one camera. */
export async function getCameraPackageConfig(opts: {
  accountId: string;
  cameraId: string;
}): Promise<CameraPackageConfigResponse> {
  return serverFetch<CameraPackageConfigResponse>(
    `/v1/cameras/${opts.cameraId}/processing-config/package`,
    { accountId: opts.accountId },
  );
}

/** PUT a requested package + safe settings. Validation failures throw 422. */
export async function putCameraPackageConfig(opts: {
  accountId: string;
  cameraId: string;
  request: CameraPackageRequest;
}): Promise<CameraPackageConfigResponse> {
  return serverFetch<CameraPackageConfigResponse>(
    `/v1/cameras/${opts.cameraId}/processing-config/package`,
    { accountId: opts.accountId, method: "PUT", body: opts.request },
  );
}

/**
 * POST apply — confirm the requested config as the active intent. Takes effect
 * on the camera's next session (no live restart). Throws UpstreamApiError(409
 * `no_requested_config`) when nothing is requested.
 */
export async function applyCameraPackageConfig(opts: {
  accountId: string;
  cameraId: string;
}): Promise<CameraPackageConfigResponse> {
  return serverFetch<CameraPackageConfigResponse>(
    `/v1/cameras/${opts.cameraId}/processing-config/apply`,
    { accountId: opts.accountId, method: "POST" },
  );
}
