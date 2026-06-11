import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, GitBranch, Video } from "lucide-react";
import { SequenceWorkflowForm } from "@/components/dashboard-next/workflows/sequence-workflow-form";
import { getActiveAccount } from "@/lib/account/active";
import { getCameraProcessingConfig } from "@/lib/api/camera-processing-config";
import { listCameras } from "@/lib/api/cameras";
import { UpstreamApiError } from "@/lib/api/errors";
import { getCameraGeometryConfig } from "@/lib/api/geometry";
import { listModels } from "@/lib/api/models";

// Workflow Engine M5 — form-based sequence builder (NOT a visual node
// editor). The camera is chosen via ?camera=<id> so the geometry shapes and
// detection-model classes can be loaded server-side for the step pickers;
// without the param the page renders a camera chooser.

export default async function NewWorkflowPage({
  searchParams,
}: {
  searchParams: Promise<{ camera?: string }>;
}) {
  const { camera: cameraId } = await searchParams;
  const { activeAccountId, activeAccount } = await getActiveAccount();
  const canEdit =
    activeAccount.role === "owner" || activeAccount.role === "admin";

  const header = (
    <header>
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/workflows"
          className="inline-flex items-center gap-1 text-[clamp(0.78rem,1vw,0.92rem)] text-white/75 hover:text-white transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Workflows
        </Link>
      </div>
      <h1 className="mt-2 font-bold text-white text-[clamp(1.6rem,3.2vw,2.4rem)]">
        New sequence workflow
      </h1>
      <p className="mt-1 text-sm text-white/70">
        Event A, then event B within a time window — completed when B
        arrives in time, failed (with an optional alert) when it doesn&rsquo;t.
      </p>
    </header>
  );

  if (!cameraId) {
    const cameras = await listCameras({ accountId: activeAccountId });
    return (
      <section className="space-y-5 md:space-y-6 max-w-3xl">
        {header}
        <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
          <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
            choose a camera
          </p>
          <p className="mt-2 text-sm text-[var(--dn-text-50)]">
            Both steps of an M5 sequence watch the same camera. Pick which
            one; its drawn zones/lines and detection classes feed the step
            pickers.
          </p>
          <ul className="mt-3 space-y-2">
            {cameras.map((camera) => (
              <li key={camera.id}>
                <Link
                  href={`/dashboard/workflows/new?camera=${camera.id}`}
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-bold text-black/70 transition hover:border-[var(--dn-creek-mid)] hover:text-black"
                >
                  <Video className="h-4 w-4" aria-hidden />
                  {camera.name}
                </Link>
              </li>
            ))}
          </ul>
          {cameras.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--dn-text-50)]">
              No cameras yet — add one under Cameras first.
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  const cameras = await listCameras({ accountId: activeAccountId });
  const camera = cameras.find((c) => c.id === cameraId);
  if (!camera) notFound();

  const [geometry, models, processingConfig] = await Promise.all([
    getCameraGeometryConfig({ accountId: activeAccountId, cameraId }).catch(
      (err) => {
        if (err instanceof UpstreamApiError && err.status === 404) {
          notFound();
        }
        throw err;
      },
    ),
    listModels({ accountId: activeAccountId }).catch(() => null),
    getCameraProcessingConfig({ accountId: activeAccountId, cameraId }).catch(
      () => null,
    ),
  ]);
  const activeModel = models?.find(
    (m) => m.model_key === processingConfig?.config.model_key,
  );
  const selectedClasses = processingConfig?.config.selected_classes ?? [];
  const classOptions =
    selectedClasses.length > 0
      ? selectedClasses
      : (activeModel?.supported_classes ?? []);

  return (
    <section className="space-y-5 md:space-y-6 max-w-4xl">
      {header}
      <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
        <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          <GitBranch className="h-4 w-4" aria-hidden />
          sequence on {camera.name}
        </p>
        {canEdit ? (
          <SequenceWorkflowForm
            cameraId={cameraId}
            lines={geometry.config.lines.map((l) => ({
              id: l.id,
              label: l.label ?? l.id,
            }))}
            rois={geometry.config.rois.map((r) => ({
              id: r.id,
              label: r.label ?? r.id,
            }))}
            classOptions={classOptions}
          />
        ) : (
          <p className="mt-3 text-sm text-[var(--dn-text-50)]">
            You have viewer access — an owner or admin can create workflows.
          </p>
        )}
      </div>
    </section>
  );
}
