import "server-only";
import { serverFetch } from "./server";
import type { ApiToken, ApiTokenListResponse } from "./types";

export async function listTokens(accountId: string): Promise<ApiToken[]> {
  const res = await serverFetch<ApiTokenListResponse>("/v1/api-tokens", {
    accountId,
  });
  return res.tokens;
}
