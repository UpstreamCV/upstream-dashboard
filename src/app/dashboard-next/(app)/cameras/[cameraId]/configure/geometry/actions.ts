"use server";

// Server Action for the P6-B1 geometry editor. Wraps
// updateCameraGeometryConfig with defense-in-depth validation (the client
// already validated; we re-validate here so a forged payload still can't
// reach the api-server) and revalidates the editor route on success so the
// sidebar's server-rendered revision banner reflects the new state.
//
// Returns a structured envelope — never throws raw API errors into the UI.
// The call site (GeometryEditorPanel) renders `issues` inline and toasts
// `message` for generic failures. Mirrors the precedent in
// src/app/dashboard-next/(app)/api-tokens/actions.ts.

import { revalidatePath } from "next/cache";
import { getActiveAccount } from "@/lib/account/active";
import { UpstreamApiError, friendlyMessage } from "@/lib/api/errors";
import { updateCameraGeometryConfig } from "@/lib/api/geometry";
import type { GeometryConfig, GeometryConfigRecord } from "@/lib/api/types";
import {
  type GeometryValidationIssue,
  validateGeometryConfig,
} from "@/lib/perception/geometry-schema";

export type SaveGeometryActionResult =
  | { ok: true; message: string; record: GeometryConfigRecord }
  | { ok: false; message: string; issues?: GeometryValidationIssue[] };

export async function saveGeometryAction(
  formData: FormData,
): Promise<SaveGeometryActionResult> {
  const cameraId = String(formData.get("camera_id") ?? "").trim();
  const configRaw = String(formData.get("config") ?? "");
  if (!cameraId || !configRaw) {
    return { ok: false, message: "Malformed save payload." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(configRaw);
  } catch {
    return { ok: false, message: "Geometry config is not valid JSON." };
  }

  // Defense-in-depth: the client validates before calling, but a forged
  // payload would bypass that. Re-run the same validator server-side so the
  // api-server never sees a structurally-broken config.
  const issues = validateGeometryConfig(parsed);
  if (issues.length > 0) {
    return {
      ok: false,
      message:
        "Fix the validation issues below before saving.",
      issues,
    };
  }
  const config = parsed as GeometryConfig;

  const { activeAccountId } = await getActiveAccount();

  try {
    const record = await updateCameraGeometryConfig({
      accountId: activeAccountId,
      cameraId,
      config,
    });
    revalidatePath(
      `/dashboard-next/cameras/${cameraId}/configure/geometry`,
    );
    return { ok: true, message: "Geometry saved.", record };
  } catch (err) {
    if (err instanceof UpstreamApiError) {
      return { ok: false, message: friendlyMessage(err) };
    }
    return { ok: false, message: "Could not save geometry. Try again." };
  }
}
