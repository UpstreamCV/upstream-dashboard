import "server-only";
import { serverFetch } from "./server";
import type {
  StreamSession,
  StreamSessionListResponse,
  StreamSessionState,
} from "./types";

export async function listStreamSessions(opts: {
  accountId: string;
  agentId?: string;
  cameraId?: string;
  state?: StreamSessionState;
  limit?: number;
}): Promise<StreamSession[]> {
  const res = await serverFetch<StreamSessionListResponse>(
    "/v1/stream-sessions",
    {
      accountId: opts.accountId,
      query: {
        agent_id: opts.agentId,
        camera_id: opts.cameraId,
        state: opts.state,
        limit: opts.limit,
      },
    },
  );
  return res.sessions;
}
