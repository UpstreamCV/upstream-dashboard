import { RecentObservationsPanelNext } from "@/components/dashboard-next/recent-observations-panel-next";
import { getActiveAccount } from "@/lib/account/active";
import { getCameraPackageConfig } from "@/lib/api/camera-package-config";
import { UpstreamApiError } from "@/lib/api/errors";
import { listRecentObservations } from "@/lib/api/observations";
import { getProcessingPackage } from "@/lib/api/processing-packages";
import type { ObservationRecord } from "@/lib/api/types";
import { DEFAULT_OBSERVATION_LIMIT } from "@/lib/perception/summarize-observation";
import type { PackageOutputContext } from "@/components/dashboard-next/recent-observations-panel-next";

// Observations tab — recent processor observations for this camera. Server-
// renders the default (unfiltered) view and hands it to the client panel,
// which adds type/limit filters, live polling, and per-row JSON expand.
//
// 404 on the camera here means the row vanished between layout-time and
// page-time. Degrade to an empty panel rather than blowing up the tab.
//
// Also resolves the camera's package so an empty tab can say WHY it's empty.
// Some packages declare `supported_outputs: []` — they emit no Upstream
// observations at all (overhead_people_counter.v1 posts its counts of record
// straight to crowdcount-server and streams boxes to the perception fanout).
// For those, "no observations yet" is not a wait, it's the design, and the
// catalog carries the machine-readable signal to say so.

/**
 * Resolve the camera's package → whether it emits observations at all.
 * Best-effort: any failure returns null, which falls back to the generic empty
 * copy. This is explanatory garnish and must never break the tab.
 */
async function resolvePackageOutputs(
  accountId: string,
  cameraId: string,
): Promise<PackageOutputContext | null> {
  try {
    const config = await getCameraPackageConfig({ accountId, cameraId });
    // Prefer what actually ran; fall back to what's requested but not yet
    // applied, since that's what the next session will emit (or not).
    const packageId =
      config.applied?.package_id ?? config.requested?.package_id ?? null;
    if (!packageId) return null;

    const pkg = await getProcessingPackage({ accountId, packageId });
    return {
      displayName: pkg.display_name,
      emitsObservations: pkg.supported_outputs.length > 0,
    };
  } catch {
    return null;
  }
}

export default async function CameraObservationsPage({
  params,
}: {
  params: Promise<{ cameraId: string }>;
}) {
  const { cameraId } = await params;
  const { activeAccountId } = await getActiveAccount();

  const [initialObservations, packageOutputs] = await Promise.all([
    listRecentObservations({
      accountId: activeAccountId,
      cameraId,
      limit: DEFAULT_OBSERVATION_LIMIT,
    }).catch((err): ObservationRecord[] => {
      if (err instanceof UpstreamApiError && err.status === 404) return [];
      throw err;
    }),
    resolvePackageOutputs(activeAccountId, cameraId),
  ]);

  return (
    <RecentObservationsPanelNext
      cameraId={cameraId}
      initialObservations={initialObservations}
      packageOutputs={packageOutputs}
    />
  );
}
