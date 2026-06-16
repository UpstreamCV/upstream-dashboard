"use server";

// Server Action behind the "New camera" form. Cameras created here are
// unassigned (agent_id = null) — an upstream-agent claims one before
// streaming it. Role gating mirrors api-tokens: owners/admins only, checked
// server-side here and enforced again by the api-server.

import { revalidatePath } from "next/cache";
import { getActiveAccount } from "@/lib/account/active";
import { UpstreamApiError, friendlyMessage } from "@/lib/api/errors";
import { serverFetch } from "@/lib/api/server";
import type { Camera } from "@/lib/api/types";

export type CameraFormResult =
  | { ok: true; cameraId: string }
  | { ok: false; error: string };

function parseIntField(
  formData: FormData,
  name: string,
  fallback: number,
): number | null {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isNaN(value) || value <= 0 ? null : value;
}

export async function createCameraAction(
  formData: FormData,
): Promise<CameraFormResult> {
  const name = String(formData.get("name") ?? "").trim();
  const sourceType = String(formData.get("source_type") ?? "").trim();
  const devicePath = String(formData.get("device_path") ?? "").trim();
  if (!name) return { ok: false, error: "Camera name is required." };
  if (!sourceType) return { ok: false, error: "Source type is required." };
  if (!devicePath) {
    return {
      ok: false,
      error:
        "Source is required — a device index for webcams (e.g. 0) or an rtsp:// URL.",
    };
  }

  const width = parseIntField(formData, "default_width", 1280);
  const height = parseIntField(formData, "default_height", 720);
  const fps = parseIntField(formData, "default_fps", 30);
  const bitrate = parseIntField(formData, "default_bitrate_kbps", 3000);
  if (width === null || height === null || fps === null || bitrate === null) {
    return { ok: false, error: "Width, height, FPS, and bitrate must be positive numbers." };
  }

  const { activeAccountId, activeAccount } = await getActiveAccount();
  if (activeAccount.role !== "owner" && activeAccount.role !== "admin") {
    return { ok: false, error: "Only owners and admins can add cameras." };
  }

  // The agent's device_path convention: "<source_type>:<source>".
  const normalizedPath = devicePath.includes(":")
    ? devicePath
    : `${sourceType}:${devicePath}`;

  try {
    const camera = await serverFetch<Camera>("/v1/cameras", {
      accountId: activeAccountId,
      method: "POST",
      body: {
        name,
        source_type: sourceType,
        device_path: normalizedPath,
        default_width: width,
        default_height: height,
        default_fps: fps,
        default_bitrate_kbps: bitrate,
      },
    });
    revalidatePath("/cameras");
    return { ok: true, cameraId: camera.id };
  } catch (err) {
    if (err instanceof UpstreamApiError) {
      return { ok: false, error: friendlyMessage(err) };
    }
    return { ok: false, error: "Could not create camera. Try again." };
  }
}
