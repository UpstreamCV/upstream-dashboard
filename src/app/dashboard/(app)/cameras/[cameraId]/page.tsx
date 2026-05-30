import { redirect } from "next/navigation";

// Camera detail root — redirects to the Monitor tab. Each tab is a real route
// segment so deep links / per-tab loading boundaries / per-tab fetches all
// work cleanly. Bare /dashboard-next/cameras/[id] URLs still resolve via this
// redirect.

export default async function CameraDetailIndex({
  params,
}: {
  params: Promise<{ cameraId: string }>;
}) {
  const { cameraId } = await params;
  redirect(`/dashboard/cameras/${cameraId}/monitor`);
}
