import "server-only";

import { serverFetch } from "./server";
import type { AuditLogListResponse } from "./types";

// Tenant audit log reads (Module 7 M3).
// Contract: ../upstream-api-server/docs/api-contracts.md
//   GET /v1/audit-logs?account_id=&limit=&before=&event_type=&resource_type=&resource_id=
// Any account member can read. The API stores ip/user_agent but never
// returns them here.

export async function listAuditLogs(opts: {
  accountId: string;
  limit?: number;
  before?: string;
  eventType?: string;
  resourceType?: string;
  resourceId?: string;
}): Promise<AuditLogListResponse> {
  return serverFetch<AuditLogListResponse>("/v1/audit-logs", {
    accountId: opts.accountId,
    query: {
      limit: opts.limit?.toString(),
      before: opts.before,
      event_type: opts.eventType,
      resource_type: opts.resourceType,
      resource_id: opts.resourceId,
    },
  });
}
