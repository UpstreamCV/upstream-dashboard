import "server-only";

import { serverFetch } from "./server";
import type { IsoDateTime } from "./types";

/**
 * Account-level processing master switch (M3).
 *
 * ON = the processor service runs all eligible streams as before (current
 * default for every existing account).
 *
 * OFF = the processor's eligibility SQL drops every session under this
 * account, so no DeepStream / mock workers spawn -- no GPU. The supervisor
 * itself stays up at minimal cost.
 *
 * Backed by GET / PATCH /v1/account/processing-config.
 */
export interface ProcessingConfig {
  account_id: string;
  processing_enabled: boolean;
  updated_at: IsoDateTime;
}

export async function getProcessingConfig(opts: {
  accountId: string;
}): Promise<ProcessingConfig> {
  return serverFetch<ProcessingConfig>("/v1/account/processing-config", {
    accountId: opts.accountId,
  });
}

export async function patchProcessingConfig(opts: {
  accountId: string;
  processingEnabled: boolean;
}): Promise<ProcessingConfig> {
  return serverFetch<ProcessingConfig>("/v1/account/processing-config", {
    accountId: opts.accountId,
    method: "PATCH",
    body: { processing_enabled: opts.processingEnabled },
  });
}
