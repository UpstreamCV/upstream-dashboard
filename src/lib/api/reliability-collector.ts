import "server-only";

import { UpstreamApiError } from "./errors";
import { serverFetch } from "./server";
import type {
  CollectorStatus,
  ReliabilityIssue,
  ReliabilityIssueListResponse,
  ReliabilitySource,
  ReliabilitySourcesResponse,
  ReliabilityStatus,
  SourceKind,
  SourceStatusHint,
} from "./types";

// Upstream Reliability Collector wrappers (M1a/M1c/M2a).
// Contract: ../upstream-api-server/src/upstream_api/routers/reliability_issues.py
//   GET  /v1/reliability/collector-status          → CollectorStatus
//   GET  /v1/reliability/sources?source_kind=…&…    → { sources }  (M2a registry)
//   GET  /v1/reliability/issues?status=…&limit=…    → { issues }
//   POST /v1/reliability/issues/{id}/resolve        → ReliabilityIssue (owner/admin)
//
// These observations/sources/issues come from the local Upstream Collector or an
// external CV system, not the managed camera pipeline. List endpoints return 200
// (empty when no data); a 404 (e.g. an older api-server without the endpoint)
// degrades to null/[] so the page can still render its empty state.

export async function getCollectorStatus(opts: {
  accountId: string;
}): Promise<CollectorStatus | null> {
  try {
    return await serverFetch<CollectorStatus>("/v1/reliability/collector-status", {
      accountId: opts.accountId,
    });
  } catch (err) {
    if (err instanceof UpstreamApiError && err.status === 404) return null;
    throw err;
  }
}

export async function getReliabilitySources(opts: {
  accountId: string;
  sourceKind?: SourceKind;
  statusHint?: SourceStatusHint;
  limit?: number;
}): Promise<ReliabilitySource[]> {
  try {
    const res = await serverFetch<ReliabilitySourcesResponse>(
      "/v1/reliability/sources",
      {
        accountId: opts.accountId,
        query: {
          source_kind: opts.sourceKind,
          status_hint: opts.statusHint,
          limit: opts.limit,
        },
      },
    );
    return res.sources;
  } catch (err) {
    if (err instanceof UpstreamApiError && err.status === 404) return [];
    throw err;
  }
}

export async function listReliabilityIssues(opts: {
  accountId: string;
  status?: ReliabilityStatus;
  limit?: number;
}): Promise<ReliabilityIssue[]> {
  try {
    const res = await serverFetch<ReliabilityIssueListResponse>(
      "/v1/reliability/issues",
      {
        accountId: opts.accountId,
        query: { status: opts.status, limit: opts.limit },
      },
    );
    return res.issues;
  } catch (err) {
    if (err instanceof UpstreamApiError && err.status === 404) return [];
    throw err;
  }
}

export async function resolveReliabilityIssue(opts: {
  accountId: string;
  issueId: string;
  reason?: string;
}): Promise<ReliabilityIssue> {
  return serverFetch<ReliabilityIssue>(
    `/v1/reliability/issues/${opts.issueId}/resolve`,
    {
      accountId: opts.accountId,
      method: "POST",
      body: opts.reason ? { resolved_reason: opts.reason } : undefined,
    },
  );
}
