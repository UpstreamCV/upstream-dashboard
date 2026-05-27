import "server-only";

import { serverFetch } from "./server";
import type {
  GeometryConfig,
  GeometryConfigRecord,
  GeometryConfigResponse,
} from "./types";

// Camera Geometry Config wrapper (P6-A).
//
// Endpoints already exist on upstream-api-server; no backend changes here.
// Contract: ../upstream-api-server/docs/api-contracts.md
//   GET /v1/cameras/{camera_id}/geometry-config  → GeometryConfigResponse
//   PUT /v1/cameras/{camera_id}/geometry-config  → GeometryConfigResponse
//
// Notes:
//
// - GET always returns 200. When a camera has no operator-saved config the
//   server synthesizes a probe-default config and returns `is_default: true`,
//   `revision: 0`, `id: null`, null timestamps. There is no "no geometry yet"
//   404 branch — only `camera_not_found` (404) when the camera id is unknown
//   or belongs to a different account. Callers decide between `notFound()`
//   and other handling for that one case.
//
// - PUT replaces the whole config (no PATCH) and bumps `revision` by one.
//   Returns the new GeometryConfigRecord with `is_default: false`. Validation
//   failures (unknown fields, point out of range, duplicate ids, etc.)
//   surface as 422 `validation_error`. The dashboard should call
//   validateGeometryConfig from @/lib/perception/geometry-schema before this
//   wrapper so authoring errors render inline instead of round-tripping.
//
// - There is no `listCameraGeometryVersions` — the server keeps no version
//   history endpoint today. `revision` is the only version-like field, and
//   only the *current* row is queryable. Add a list wrapper here if/when
//   that endpoint lands.
//
// - `updateCameraGeometryConfig` has no caller in this preflight pass — the
//   editor (P6-B) will wrap it from a Server Action (mirroring the pattern
//   in src/app/dashboard-next/(app)/api-tokens/actions.ts). It's exported now
//   so the typed wrapper is ready when the editor lands.

/**
 * GET the current geometry config for one camera. Always resolves to a valid
 * `GeometryConfigRecord` for any reachable camera — the server returns the
 * system probe-default when nothing is saved (`is_default: true`, `revision:
 * 0`). Only `camera_not_found` (404) throws.
 */
export async function getCameraGeometryConfig(opts: {
  accountId: string;
  cameraId: string;
}): Promise<GeometryConfigRecord> {
  const res = await serverFetch<GeometryConfigResponse>(
    `/v1/cameras/${opts.cameraId}/geometry-config`,
    { accountId: opts.accountId },
  );
  return res.geometry_config;
}

/**
 * PUT a full replacement geometry config. Returns the new
 * `GeometryConfigRecord` with `is_default: false` and `revision` bumped.
 * Validation failures throw `UpstreamApiError(422)`.
 */
export async function updateCameraGeometryConfig(opts: {
  accountId: string;
  cameraId: string;
  config: GeometryConfig;
}): Promise<GeometryConfigRecord> {
  const res = await serverFetch<GeometryConfigResponse>(
    `/v1/cameras/${opts.cameraId}/geometry-config`,
    {
      accountId: opts.accountId,
      method: "PUT",
      body: { config: opts.config },
    },
  );
  return res.geometry_config;
}
