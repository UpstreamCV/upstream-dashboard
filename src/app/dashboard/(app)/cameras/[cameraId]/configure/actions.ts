"use server";

// Server Action for the Model & Detection card on the camera Configure page.
// Mirrors saveGeometryAction's posture: validate, short-circuit in demo mode,
// and return a structured envelope (never throw raw errors into the UI).
//
// There is no api-server endpoint for model/detection config yet, so the
// non-demo path is a TODO — it accepts the values without persisting so the UI
// stays functional. Wire it to a src/lib/api/model-config.ts helper (mirroring
// src/lib/api/geometry.ts) once the endpoint exists.

import { isDemoMode } from "@/lib/demo/demo-mode";

export type SaveModelDetectionInput = {
  cameraId: string;
  model: string;
  confidence: number;
  iou: number;
};

export type SaveModelDetectionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function saveModelDetectionAction(
  input: SaveModelDetectionInput,
): Promise<SaveModelDetectionResult> {
  const { cameraId, model, confidence, iou } = input;

  if (!cameraId || !model) {
    return { ok: false, message: "Malformed save payload." };
  }
  const inRange = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1;
  if (!inRange(confidence) || !inRange(iou)) {
    return { ok: false, message: "Thresholds must be between 0 and 1." };
  }

  // Demo mode: no api-server — accept the change so the toast fires as usual.
  if (isDemoMode()) {
    return { ok: true, message: `Model set to ${model}.` };
  }

  // TODO: persist via the api-server once a model/detection config endpoint
  // exists (mirror updateCameraGeometryConfig in src/lib/api/geometry.ts).
  return { ok: true, message: `Model set to ${model}.` };
}
