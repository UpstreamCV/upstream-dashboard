import { redirect } from "next/navigation";

// The Command Center tab was consolidated into Live Monitor. It rendered the
// same six panels the Monitor rail already composes (ReliabilityPanel,
// SessionPanel, AppliedGeometryPanel, AgentPanel, CameraMetaPanel,
// ValidationPanel) minus the live stream, so it carried no unique surface —
// only a roomier layout for the verdict panels, which Monitor now adopts.
// This route redirects so existing deep links / bookmarks don't 404.

export default async function CameraOverviewPage({
  params,
}: {
  params: Promise<{ cameraId: string }>;
}) {
  const { cameraId } = await params;
  redirect(`/cameras/${cameraId}/monitor`);
}
