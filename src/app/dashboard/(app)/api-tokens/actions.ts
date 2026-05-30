"use server";

// Server Actions for /dashboard-next/api-tokens. Mirror of
// src/app/dashboard/settings/api-tokens/actions.ts — the upstream POST/DELETE
// shapes are identical, only the revalidate path differs (so the new dashboard
// segment refreshes after each mutation).

import { revalidatePath } from "next/cache";
import { getActiveAccount } from "@/lib/account/active";
import { UpstreamApiError, friendlyMessage } from "@/lib/api/errors";
import { serverFetch } from "@/lib/api/server";
import type { ApiTokenCreated } from "@/lib/api/types";

const REVALIDATE_PATH = "/dashboard/api-tokens";

export type CreateTokenResult =
  | { ok: true; tokenId: string; plaintext: string; prefix: string }
  | { ok: false; error: string };

export async function createTokenAction(
  formData: FormData,
): Promise<CreateTokenResult> {
  const name = String(formData.get("name") ?? "").trim();
  const expiresRaw = String(formData.get("expires_at") ?? "").trim();
  if (!name) {
    return { ok: false, error: "Token name is required." };
  }

  const { activeAccountId, activeAccount } = await getActiveAccount();
  if (activeAccount.role !== "owner" && activeAccount.role !== "admin") {
    return {
      ok: false,
      error: "Only owners and admins can generate API tokens.",
    };
  }

  const body: Record<string, unknown> = {
    account_id: activeAccountId,
    name,
    scopes: ["agent"],
  };
  if (expiresRaw) {
    const d = new Date(expiresRaw);
    if (Number.isNaN(d.getTime())) {
      return { ok: false, error: "Expiration date is invalid." };
    }
    body.expires_at = d.toISOString();
  }

  try {
    const created = await serverFetch<ApiTokenCreated>("/v1/api-tokens", {
      accountId: activeAccountId,
      method: "POST",
      body,
    });
    revalidatePath(REVALIDATE_PATH);
    return {
      ok: true,
      tokenId: created.token.id,
      prefix: created.token.prefix,
      plaintext: created.plaintext,
    };
  } catch (err) {
    if (err instanceof UpstreamApiError) {
      return { ok: false, error: friendlyMessage(err) };
    }
    return { ok: false, error: "Could not create token. Try again." };
  }
}

export type RevokeTokenResult = { ok: true } | { ok: false; error: string };

export async function revokeTokenAction(
  formData: FormData,
): Promise<RevokeTokenResult> {
  const tokenId = String(formData.get("token_id") ?? "");
  if (!tokenId) return { ok: false, error: "Missing token id." };

  const { activeAccountId } = await getActiveAccount();
  try {
    await serverFetch<void>(`/v1/api-tokens/${tokenId}`, {
      accountId: activeAccountId,
      method: "DELETE",
    });
    revalidatePath(REVALIDATE_PATH);
    return { ok: true };
  } catch (err) {
    if (err instanceof UpstreamApiError) {
      return { ok: false, error: friendlyMessage(err) };
    }
    return { ok: false, error: "Could not revoke token. Try again." };
  }
}
