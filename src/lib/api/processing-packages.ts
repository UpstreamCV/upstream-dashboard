import "server-only";

import { serverFetch } from "./server";
import type {
  ProcessingPackage,
  ProcessingPackageCatalogResponse,
} from "./types";

// Processing package catalog wrapper (P5-F).
//
// Endpoints already exist on upstream-api-server; no backend changes here.
// Contract: ../upstream-api-server/docs/api-contracts.md
//   GET /v1/processing/packages       → ProcessingPackageCatalogResponse
//   GET /v1/processing/packages/{id}  → ProcessingPackage
//
// The catalog is a platform-global, account-agnostic snapshot (no DB). It is the
// source of truth for which packages exist, their readiness/status, the
// classes/outputs they support, and the safe overrides each allows. The
// dashboard reads it to render the Processing tab's package selector and to
// validate a save client-side before the PUT. Backend validation is still
// authoritative.

/** GET the full processing-package catalog (visible packages + categories). */
export async function listProcessingPackages(opts: {
  accountId: string;
}): Promise<ProcessingPackageCatalogResponse> {
  return serverFetch<ProcessingPackageCatalogResponse>(
    "/v1/processing/packages",
    { accountId: opts.accountId },
  );
}

/** GET one package by id. Throws UpstreamApiError(404) if unknown/hidden. */
export async function getProcessingPackage(opts: {
  accountId: string;
  packageId: string;
}): Promise<ProcessingPackage> {
  return serverFetch<ProcessingPackage>(
    `/v1/processing/packages/${encodeURIComponent(opts.packageId)}`,
    { accountId: opts.accountId },
  );
}
