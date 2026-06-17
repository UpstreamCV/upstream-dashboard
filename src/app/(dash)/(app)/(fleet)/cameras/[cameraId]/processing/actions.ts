"use server";

// Server Actions for the P5-H Processing (package) panel. Both wrap the
// camera-package-config api client with a structured envelope (never throw raw
// API errors into the UI) and revalidate the Processing route on success so the
// server-rendered requested/applied/state re-derives. Mirrors the precedent in
// configure/detection/actions.ts.
//
// `saveCameraPackageAction` re-validates the request server-side against the
// catalog (defense-in-depth: the client already validated, but a forged payload
// would bypass that), then PUTs. `applyCameraPackageAction` confirms the
// requested config as the active intent (takes effect next session).

import { revalidatePath } from "next/cache";
import { getActiveAccount } from "@/lib/account/active";
import {
  applyCameraPackageConfig,
  putCameraPackageConfig,
} from "@/lib/api/camera-package-config";
import { UpstreamApiError, friendlyMessage } from "@/lib/api/errors";
import { listProcessingPackages } from "@/lib/api/processing-packages";
import type {
  CameraPackageConfigResponse,
  CameraPackageRequest,
} from "@/lib/api/types";
import {
  type PackageConfigValidationIssue,
  validatePackageRequest,
} from "@/lib/perception/package-config-schema";

export type SavePackageActionResult =
  | { ok: true; message: string; response: CameraPackageConfigResponse }
  | { ok: false; message: string; issues?: PackageConfigValidationIssue[] };

export type ApplyPackageActionResult =
  | { ok: true; message: string; response: CameraPackageConfigResponse }
  | { ok: false; message: string };

export async function saveCameraPackageAction(
  formData: FormData,
): Promise<SavePackageActionResult> {
  const cameraId = String(formData.get("camera_id") ?? "").trim();
  const requestRaw = String(formData.get("request") ?? "");
  if (!cameraId || !requestRaw) {
    return { ok: false, message: "Malformed save payload." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(requestRaw);
  } catch {
    return { ok: false, message: "Package request is not valid JSON." };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, message: "Package request must be an object." };
  }
  const request = parsed as CameraPackageRequest;

  const { activeAccountId } = await getActiveAccount();

  try {
    // Defense-in-depth: re-validate against the live catalog before the PUT.
    const catalog = await listProcessingPackages({ accountId: activeAccountId });
    const pkg = catalog.packages.find(
      (p) => p.package_id === request.package_id,
    );
    const issues = validatePackageRequest(request, pkg);
    if (issues.length > 0) {
      return {
        ok: false,
        message: "Fix the issues below before saving.",
        issues,
      };
    }

    const response = await putCameraPackageConfig({
      accountId: activeAccountId,
      cameraId,
      request,
    });
    revalidatePath(`/cameras/${cameraId}/processing`);
    return { ok: true, message: "Package request saved.", response };
  } catch (err) {
    if (err instanceof UpstreamApiError) {
      return { ok: false, message: friendlyMessage(err) };
    }
    return { ok: false, message: "Could not save the package request. Try again." };
  }
}

export async function applyCameraPackageAction(
  formData: FormData,
): Promise<ApplyPackageActionResult> {
  const cameraId = String(formData.get("camera_id") ?? "").trim();
  if (!cameraId) {
    return { ok: false, message: "Malformed apply payload." };
  }

  const { activeAccountId } = await getActiveAccount();

  try {
    const response = await applyCameraPackageConfig({
      accountId: activeAccountId,
      cameraId,
    });
    revalidatePath(`/cameras/${cameraId}/processing`);
    return {
      ok: true,
      message: "Package applied — it takes effect on the camera's next session.",
      response,
    };
  } catch (err) {
    if (err instanceof UpstreamApiError) {
      // 409: there's no requested config to apply yet.
      if (err.code === "no_requested_config") {
        return { ok: false, message: "Save a package request before applying." };
      }
      return { ok: false, message: friendlyMessage(err) };
    }
    return { ok: false, message: "Could not apply the package. Try again." };
  }
}
