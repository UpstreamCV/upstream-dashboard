import { redirect } from "next/navigation";

// Camera detail root — redirects to the Command Center (overview) tab, the
// camera's status-first landing. Each tab is a real route segment so deep links
// / per-tab loading boundaries / per-tab fetches all work cleanly. Bare
// /cameras/[id] URLs still resolve via this redirect.

export default async function CameraDetailIndex({
  params,
}: {
  params: Promise<{ cameraId: string }>;
}) {
  const { cameraId } = await params;
  redirect(`/cameras/${cameraId}/overview`);
}
