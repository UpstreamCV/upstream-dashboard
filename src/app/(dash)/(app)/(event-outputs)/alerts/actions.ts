"use server";

// Server Actions for the Rules/Triggers M1 alert inbox. Mark-read is any
// member; resolve is owner/admin (the api-server enforces the role
// regardless — these actions just relay). Returns a structured envelope so
// the client toasts failures instead of crashing on raw API errors.

import { revalidatePath } from "next/cache";
import { getActiveAccount } from "@/lib/account/active";
import { UpstreamApiError, friendlyMessage } from "@/lib/api/errors";
import { markAlertRead, resolveAlert } from "@/lib/api/alerts";
import type { Alert } from "@/lib/api/types";

export type AlertActionResult =
  | { ok: true; alert: Alert }
  | { ok: false; message: string };

export async function markAlertReadAction(
  formData: FormData,
): Promise<AlertActionResult> {
  const alertId = String(formData.get("alert_id") ?? "").trim();
  if (!alertId) return { ok: false, message: "Malformed alert payload." };

  const { activeAccountId } = await getActiveAccount();
  try {
    const alert = await markAlertRead({ accountId: activeAccountId, alertId });
    revalidatePath("/alerts");
    return { ok: true, alert };
  } catch (err) {
    if (err instanceof UpstreamApiError) {
      return { ok: false, message: friendlyMessage(err) };
    }
    return { ok: false, message: "Could not mark the alert read. Try again." };
  }
}

export async function resolveAlertAction(
  formData: FormData,
): Promise<AlertActionResult> {
  const alertId = String(formData.get("alert_id") ?? "").trim();
  if (!alertId) return { ok: false, message: "Malformed alert payload." };

  const { activeAccountId } = await getActiveAccount();
  try {
    const alert = await resolveAlert({ accountId: activeAccountId, alertId });
    revalidatePath("/alerts");
    return { ok: true, alert };
  } catch (err) {
    if (err instanceof UpstreamApiError) {
      return { ok: false, message: friendlyMessage(err) };
    }
    return { ok: false, message: "Could not resolve the alert. Try again." };
  }
}
