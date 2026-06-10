import "server-only";

import { serverFetch } from "./server";
import type {
  WorkflowRun,
  WorkflowRunListResponse,
  WorkflowRunStatus,
} from "./types";

// Workflow run history wrapper (Workflow Engine M2).
// Contract: ../upstream-api-server/docs/api-contracts.md
//   GET /v1/workflow-runs?status=…&camera_id=…&rule_id=…&limit=…
//   GET /v1/workflow-runs/{workflow_run_id}
//
// Read-path only: runs are created and finalized exclusively by the
// api-server's rule evaluator on the observation ingest path. Every rule
// match produces a run — including cooldown-suppressed matches that send no
// alert — so this history is the system of record for camera workflows.

export async function listWorkflowRuns(opts: {
  accountId: string;
  status?: WorkflowRunStatus;
  cameraId?: string;
  ruleId?: string;
  limit?: number;
}): Promise<WorkflowRun[]> {
  const res = await serverFetch<WorkflowRunListResponse>("/v1/workflow-runs", {
    accountId: opts.accountId,
    query: {
      status: opts.status,
      camera_id: opts.cameraId,
      rule_id: opts.ruleId,
      limit: opts.limit,
    },
  });
  return res.runs;
}

export async function getWorkflowRun(opts: {
  accountId: string;
  workflowRunId: string;
}): Promise<WorkflowRun> {
  return serverFetch<WorkflowRun>(`/v1/workflow-runs/${opts.workflowRunId}`, {
    accountId: opts.accountId,
  });
}
