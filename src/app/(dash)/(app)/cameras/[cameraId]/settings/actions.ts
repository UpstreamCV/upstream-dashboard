"use server";

// Server Action behind the camera settings edit form. Partial PATCH — only
// the provided fields change; the api-server re-validates the merged config
// against account limits so an edit can never exceed caps.

import { revalidatePath } from "next/cache";
import { getActiveAccount } from "@/lib/account/active";
import { UpstreamApiError, friendlyMessage } from "@/lib/api/errors";
import { serverFetch } from "@/lib/api/server";
import type { Camera } from "@/lib/api/types";
import type { CameraFormResult } from "../../new/actions";

export async function updateCameraAction(
  formData: FormData,
): Promise<CameraFormResult> {
  const cameraId = String(formData.get("camera_id") ?? "").trim();
  if (!cameraId) return { ok: false, error: "Missing camera id." };

  const { activeAccountId, activeAccount } = await getActiveAccount();
  if (activeAccount.role !== "owner" && activeAccount.role !== "admin") {
    return { ok: false, error: "Only owners and admins can edit cameras." };
  }

  const body: Record<string, unknown> = {};
  const text = (field: string) => String(formData.get(field) ?? "").trim();
  if (text("name")) body.name = text("name");
  if (text("source_type")) body.source_type = text("source_type");
  if (text("device_path")) body.device_path = text("device_path");
  for (const field of [
    "default_width",
    "default_height",
    "default_fps",
    "default_bitrate_kbps",
  ]) {
    const raw = text(field);
    if (!raw) continue;
    const value = Number.parseInt(raw, 10);
    if (Number.isNaN(value) || value <= 0) {
      return { ok: false, error: "Width, height, FPS, and bitrate must be positive numbers." };
    }
    body[field] = value;
  }
  if (Object.keys(body).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  try {
    const camera = await serverFetch<Camera>(`/v1/cameras/${cameraId}`, {
      accountId: activeAccountId,
      method: "PATCH",
      body,
    });
    revalidatePath(`/cameras/${cameraId}/settings`);
    revalidatePath("/cameras");
    return { ok: true, cameraId: camera.id };
  } catch (err) {
    if (err instanceof UpstreamApiError) {
      return { ok: false, error: friendlyMessage(err) };
    }
    return { ok: false, error: "Could not update camera. Try again." };
  }
}
