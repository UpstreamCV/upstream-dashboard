import { RecentObservationsPanelNext } from "@/components/dashboard-next/recent-observations-panel-next";
import { getActiveAccount } from "@/lib/account/active";
import { UpstreamApiError } from "@/lib/api/errors";
import { listRecentObservations } from "@/lib/api/observations";
import type { ObservationRecord } from "@/lib/api/types";
import { DEFAULT_OBSERVATION_LIMIT } from "@/lib/perception/summarize-observation";

// Observations tab — recent processor observations for this camera. Server-
// renders the default (unfiltered) view and hands it to the client panel,
// which adds type/limit filters, live polling, and per-row JSON expand.
//
// 404 on the camera here means the row vanished between layout-time and
// page-time. Degrade to an empty panel rather than blowing up the tab.

export default async function CameraObservationsPage({
  params,
}: {
  params: Promise<{ cameraId: string }>;
}) {
  const { cameraId } = await params;
  const { activeAccountId } = await getActiveAccount();

  const initialObservations: ObservationRecord[] = await listRecentObservations(
    {
      accountId: activeAccountId,
      cameraId,
      limit: DEFAULT_OBSERVATION_LIMIT,
    },
  ).catch((err): ObservationRecord[] => {
    if (err instanceof UpstreamApiError && err.status === 404) return [];
    throw err;
  });

  return (
    <RecentObservationsPanelNext
      cameraId={cameraId}
      initialObservations={initialObservations}
    />
  );
}
