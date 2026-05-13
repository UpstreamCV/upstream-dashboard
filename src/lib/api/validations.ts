import "server-only";

import { serverFetch } from "./server";
import type {
  StreamValidation,
  StreamValidationListResponse,
} from "./types";

export async function listValidations(opts: {
  accountId: string;
  sessionId: string;
}): Promise<StreamValidation[]> {
  const res = await serverFetch<StreamValidationListResponse>(
    `/v1/stream-sessions/${opts.sessionId}/validations`,
    { accountId: opts.accountId },
  );
  return res.validations;
}
