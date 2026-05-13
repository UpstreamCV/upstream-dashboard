import "server-only";
import { serverFetch } from "./server";
import type { Camera, CameraListResponse } from "./types";

export async function listCameras(opts: {
  accountId: string;
  agentId?: string;
  status?: string;
  limit?: number;
}): Promise<Camera[]> {
  const res = await serverFetch<CameraListResponse>("/v1/cameras", {
    accountId: opts.accountId,
    query: {
      agent_id: opts.agentId,
      status: opts.status,
      limit: opts.limit,
    },
  });
  return res.cameras;
}

export async function getCamera(opts: {
  accountId: string;
  cameraId: string;
}): Promise<Camera> {
  return serverFetch<Camera>(`/v1/cameras/${opts.cameraId}`, {
    accountId: opts.accountId,
  });
}
