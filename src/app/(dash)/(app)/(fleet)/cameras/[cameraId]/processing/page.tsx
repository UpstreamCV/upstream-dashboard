import { notFound } from "next/navigation";
import { ProcessingPackagePanel } from "@/components/dashboard-next/processing/processing-package-panel";
import { getActiveAccount } from "@/lib/account/active";
import { getCameraPackageConfig } from "@/lib/api/camera-package-config";
import { UpstreamApiError } from "@/lib/api/errors";
import { listProcessingPackages } from "@/lib/api/processing-packages";
import type {
  CameraPackageConfigResponse,
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
  const [catalog, config]: [
    ProcessingPackageCatalogResponse,
    CameraPackageConfigResponse,
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
  ]);

  return (
    <div className="space-y-4 md:space-y-6">
      <ProcessingPackagePanel
        cameraId={cameraId}
        catalog={catalog}
        config={config}
      />
    </div>
  );
}
