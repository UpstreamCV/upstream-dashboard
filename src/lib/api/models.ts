import "server-only";

import { serverFetch } from "./server";
import type { ModelRegistryEntry, ModelsListResponse } from "./types";

// Detection model registry wrapper (M5).
//
// Endpoints already exist on upstream-api-server; no backend changes here.
// Contract: ../upstream-api-server/docs/api-contracts.md
//   GET /v1/models  → ModelsListResponse
//
// The registry is the source of truth for which models exist, which classes
// each supports, and whether a model is `enabled` (selectable). The dashboard
// reads it to populate the Model & Detection picker and to validate a save
// client-side before the PUT. Backend validation is still authoritative.

/**
 * GET the detection model registry. Returns every entry — including disabled
 * ones, which the picker renders as non-selectable so an operator can see why
 * a previously-saved model is no longer available.
 */
export async function listModels(opts: {
  accountId: string;
}): Promise<ModelRegistryEntry[]> {
  const res = await serverFetch<ModelsListResponse>("/v1/models", {
    accountId: opts.accountId,
  });
  return res.models;
}
