import { redirect } from "next/navigation";

// P5-H — the Model & Detection editor was consolidated into the Processing tab
// (a processing package embodies the model/detection choice, so a separate
// editor here was redundant). This route now redirects so existing deep links /
// bookmarks don't 404. The legacy per-field model_key backend
// (src/lib/api/camera-processing-config.ts) is intact and still works; it is
// just no longer surfaced as a standalone editor.

export default async function CameraDetectionPage({
  params,
}: {
  params: Promise<{ cameraId: string }>;
}) {
  const { cameraId } = await params;
  redirect(`/cameras/${cameraId}/processing`);
}
