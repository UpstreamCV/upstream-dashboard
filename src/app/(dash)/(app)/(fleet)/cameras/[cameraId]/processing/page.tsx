import { notFound } from "next/navigation";
import { ProcessingPackagePanel } from "@/components/dashboard-next/processing/processing-package-panel";
import { RuntimeEvidencePanel } from "@/components/dashboard-next/processing/runtime-evidence-panel";
import { getActiveAccount } from "@/lib/account/active";
import { getCameraPackageConfig } from "@/lib/api/camera-package-config";
import { UpstreamApiError } from "@/lib/api/errors";
import { getCameraGeometryConfig } from "@/lib/api/geometry";
import { getProcessingEvidence } from "@/lib/api/processing-evidence";
import { listProcessingPackages } from "@/lib/api/processing-packages";
import type {
  CameraPackageConfigResponse,
  GeometryConfigRecord,
  ProcessingEvidenceResponse,
  ProcessingPackageCatalogResponse,
} from "@/lib/api/types";

// P5-H — Processing tab. The single home for "what this camera detects and
// how": pick a processing package (a curated model + tracker + analytics
// bundle), edit the safe overrides it allows, save the request, and apply it
// (takes effect on the camera's NEXT session — no live restart). Server-renders
// the catalog + the camera's package state, then hands both to the interactive
// <ProcessingPackagePanel>. The panel calls router.refresh() after a successful
// save/apply so this page re-renders the derived requested/applied/state.
//
// This supersedes the legacy Model & Detection editor (configure/detection),
// which now redirects here — a package embodies the model/detection choice, so
// the two surfaces aren't redundant.

export default async function CameraProcessingPage({
  params,
}: {
  params: Promise<{ cameraId: string }>;
}) {
  const { cameraId } = await params;
  const { activeAccountId } = await getActiveAccount();

  // The catalog (platform-global) and the camera's package state are
  // independent reads — fetch concurrently. The package GET 404s only on
  // camera_not_found (it returns state "unset" otherwise); map that one case to
  // notFound(), same as the geometry/detection pages.
  // Geometry feeds the P5-I readiness checks (line vs ROI). It's non-critical —
  // if it fails for any reason, the checklist degrades to a soft "configure
  // geometry" hint rather than blocking the page (camera_not_found is already
  // surfaced by the package GET below).
  // Evidence (P5-J) is a non-critical visibility read at the default 24h window;
  // getProcessingEvidence already degrades all errors to null, so it's safe in
  // the batch and never rejects it.
  const [catalog, config, geometry, evidence]: [
    ProcessingPackageCatalogResponse,
    CameraPackageConfigResponse,
    GeometryConfigRecord | null,
    ProcessingEvidenceResponse | null,
  ] = await Promise.all([
    listProcessingPackages({ accountId: activeAccountId }),
    getCameraPackageConfig({ accountId: activeAccountId, cameraId }).catch(
      (err): CameraPackageConfigResponse => {
        if (err instanceof UpstreamApiError && err.status === 404) {
          notFound();
        }
        throw err;
      },
    ),
    getCameraGeometryConfig({ accountId: activeAccountId, cameraId }).catch(
      () => null,
    ),
    getProcessingEvidence({ accountId: activeAccountId, cameraId }),
  ]);

  return (
    <div className="space-y-4 md:space-y-6">
      <ProcessingPackagePanel
        cameraId={cameraId}
        catalog={catalog}
        config={config}
        geometry={geometry}
      />
      <RuntimeEvidencePanel cameraId={cameraId} initialEvidence={evidence} />
    </div>
  );
}
