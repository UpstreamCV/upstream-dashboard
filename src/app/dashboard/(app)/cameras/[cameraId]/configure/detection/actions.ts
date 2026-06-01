"use server";

// Server Action for the M5 Model & Detection editor. Wraps
// putCameraProcessingConfig with defense-in-depth validation (the client
// already validated; we re-validate here so a forged payload still can't
// reach the api-server) and revalidates the editor route on success so the
// sidebar's server-rendered revision banner reflects the new state.
//
// Returns a structured envelope — never throws raw API errors into the UI.
// The call site (ModelDetectionPanel) renders `issues` inline and toasts
// `message` for generic failures. Mirrors the precedent in
// configure/geometry/actions.ts.

import { revalidatePath } from "next/cache";
import { getActiveAccount } from "@/lib/account/active";
import { putCameraProcessingConfig } from "@/lib/api/camera-processing-config";
import { UpstreamApiError, friendlyMessage } from "@/lib/api/errors";
import { listModels } from "@/lib/api/models";
import type {
  CameraProcessingConfig,
  CameraProcessingConfigRecord,
  ModelRegistryEntry,
} from "@/lib/api/types";
import {
  type ProcessingConfigValidationIssue,
  validateProcessingConfig,
} from "@/lib/perception/processing-config-schema";

export type SaveProcessingConfigActionResult =
  | { ok: true; message: string; record: CameraProcessingConfigRecord }
  | { ok: false; message: string; issues?: ProcessingConfigValidationIssue[] };

export async function saveProcessingConfigAction(
  formData: FormData,
): Promise<SaveProcessingConfigActionResult> {
  const cameraId = String(formData.get("camera_id") ?? "").trim();
  const configRaw = String(formData.get("config") ?? "");
  if (!cameraId || !configRaw) {
    return { ok: false, message: "Malformed save payload." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(configRaw);
  } catch {
    return { ok: false, message: "Processing config is not valid JSON." };
  }

  const { activeAccountId } = await getActiveAccount();

  // Defense-in-depth: the client validates before calling, but a forged
  // payload would bypass that. Re-run the same validator server-side, looking
  // up the chosen model in the registry so the model_key + selected_classes
  // checks have the registry facts to validate against.
  const modelKey =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>).model_key
      : undefined;
  let model: ModelRegistryEntry | undefined;
  try {
    const models = await listModels({ accountId: activeAccountId });
    model =
      typeof modelKey === "string"
        ? models.find((m) => m.model_key === modelKey)
        : undefined;
  } catch (err) {
    if (err instanceof UpstreamApiError) {
      return { ok: false, message: friendlyMessage(err) };
    }
    return { ok: false, message: "Could not load models. Try again." };
  }

  const issues = validateProcessingConfig(parsed, model);
  if (issues.length > 0) {
    return {
      ok: false,
      message: "Fix the validation issues below before saving.",
      issues,
    };
  }
  const config = parsed as CameraProcessingConfig;

  try {
    const record = await putCameraProcessingConfig({
      accountId: activeAccountId,
      cameraId,
      config,
    });
    revalidatePath(`/dashboard/cameras/${cameraId}/configure/detection`);
    return { ok: true, message: "Detection config saved.", record };
  } catch (err) {
    if (err instanceof UpstreamApiError) {
      return { ok: false, message: friendlyMessage(err) };
    }
    return { ok: false, message: "Could not save detection config. Try again." };
  }
}
