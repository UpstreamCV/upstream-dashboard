import "server-only";

import { serverFetch } from "./server";
import type { Alert, AlertListResponse, AlertStatus } from "./types";

// Alert inbox wrapper (Rules/Triggers M1).
// Contract: ../upstream-api-server/src/upstream_api/routers/alerts.py
//   GET  /v1/alerts?status=…&camera_id=…&limit=…  → AlertListResponse
//   POST /v1/alerts/{alert_id}/read               → Alert (any member)
//   POST /v1/alerts/{alert_id}/resolve            → Alert (owner/admin)
//
// Alerts are written only by the api-server's rule evaluator when a
// processor observation matches an enabled rule. Both transitions are
// idempotent server-side (timestamps set once via coalesce).

export async function listAlerts(opts: {
  accountId: string;
  status?: AlertStatus;
  cameraId?: string;
  limit?: number;
}): Promise<Alert[]> {
  const res = await serverFetch<AlertListResponse>("/v1/alerts", {
    accountId: opts.accountId,
    query: {
      status: opts.status,
      camera_id: opts.cameraId,
      limit: opts.limit,
    },
  });
  return res.alerts;
}

export async function markAlertRead(opts: {
  accountId: string;
  alertId: string;
}): Promise<Alert> {
  return serverFetch<Alert>(`/v1/alerts/${opts.alertId}/read`, {
    accountId: opts.accountId,
    method: "POST",
  });
}

export async function resolveAlert(opts: {
  accountId: string;
  alertId: string;
}): Promise<Alert> {
  return serverFetch<Alert>(`/v1/alerts/${opts.alertId}/resolve`, {
    accountId: opts.accountId,
    method: "POST",
  });
}
