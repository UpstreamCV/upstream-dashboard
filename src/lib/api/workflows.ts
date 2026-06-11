import "server-only";

import { serverFetch } from "./server";
import type {
  RuleSeverity,
  Workflow,
  WorkflowListResponse,
  WorkflowType,
} from "./types";

// Workflow definition CRUD wrapper (Workflow Engine M5).
// Contract: ../upstream-api-server/docs/api-contracts.md
//   POST   /v1/workflows                 → Workflow (201)
//   GET    /v1/workflows?camera_id=&type= → WorkflowListResponse
//   GET    /v1/workflows/{workflow_id}   → Workflow
//   PATCH  /v1/workflows/{workflow_id}   → Workflow
//   DELETE /v1/workflows/{workflow_id}   → 204
//
// Mutations are owner/admin; reads any member. workflow_type is immutable.
// Config problems surface as 422 `invalid_workflow_config`; the dashboard
// runs validateSequenceConfig from @/lib/workflows/sequence-config-schema
// first so authoring errors render inline.

export async function listWorkflows(opts: {
  accountId: string;
  cameraId?: string;
  workflowType?: string;
}): Promise<Workflow[]> {
  const res = await serverFetch<WorkflowListResponse>("/v1/workflows", {
    accountId: opts.accountId,
    query: { camera_id: opts.cameraId, type: opts.workflowType },
  });
  return res.workflows;
}

export async function createWorkflow(opts: {
  accountId: string;
  cameraId: string;
  name: string;
  description?: string;
  workflowType: WorkflowType;
  config: Record<string, unknown>;
  severity: RuleSeverity;
  cooldownSeconds: number;
}): Promise<Workflow> {
  return serverFetch<Workflow>("/v1/workflows", {
    accountId: opts.accountId,
    method: "POST",
    body: {
      account_id: opts.accountId,
      camera_id: opts.cameraId,
      name: opts.name,
      ...(opts.description ? { description: opts.description } : {}),
      workflow_type: opts.workflowType,
      config: opts.config,
      severity: opts.severity,
      cooldown_seconds: opts.cooldownSeconds,
    },
  });
}

export async function updateWorkflow(opts: {
  accountId: string;
  workflowId: string;
  name?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
  severity?: RuleSeverity;
  cooldownSeconds?: number;
}): Promise<Workflow> {
  return serverFetch<Workflow>(`/v1/workflows/${opts.workflowId}`, {
    accountId: opts.accountId,
    method: "PATCH",
    body: {
      ...(opts.name !== undefined ? { name: opts.name } : {}),
      ...(opts.enabled !== undefined ? { enabled: opts.enabled } : {}),
      ...(opts.config !== undefined ? { config: opts.config } : {}),
      ...(opts.severity !== undefined ? { severity: opts.severity } : {}),
      ...(opts.cooldownSeconds !== undefined
        ? { cooldown_seconds: opts.cooldownSeconds }
        : {}),
    },
  });
}

export async function deleteWorkflow(opts: {
  accountId: string;
  workflowId: string;
}): Promise<void> {
  await serverFetch<void>(`/v1/workflows/${opts.workflowId}`, {
    accountId: opts.accountId,
    method: "DELETE",
  });
}
