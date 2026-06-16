import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ShieldAlert } from "lucide-react";
import { RelativeTime } from "@/components/data/relative-time";
import { ModelDetectionPanel } from "@/components/dashboard-next/detection/model-detection-panel";
import { getActiveAccount } from "@/lib/account/active";
import { getCameraProcessingConfig } from "@/lib/api/camera-processing-config";
import { UpstreamApiError } from "@/lib/api/errors";
import { listModels } from "@/lib/api/models";
import type {
  CameraProcessingConfig,
  CameraProcessingConfigRecord,
  ModelRegistryEntry,
} from "@/lib/api/types";

// M5/M6 — Model & Detection editor.
//
// Server-renders the model registry + the camera's current processing config,
// then hands both to the interactive <ModelDetectionPanel> (Client Component).
// Scope: model selection, which object classes to detect, and (M6) tracker /
// confidence threshold / processing FPS, plus save. Each M6 control defaults to
// null ("use the runtime/model default"). The settings persist but the live
// processor does not consume them yet (the panel's notice block says so).
//
// Sidebar carries the server-rendered status panel (revision + saved-state
// summary + timestamps) and a collapsed raw-JSON inspector for engineers
// verifying the wire shape. The sidebar re-renders after every successful save
// because the panel calls router.refresh().

export default async function CameraDetectionPage({
  params,
}: {
  params: Promise<{ cameraId: string }>;
}) {
  const { cameraId } = await params;
  const { activeAccountId } = await getActiveAccount();

  // The model registry and the camera's processing config are independent
  // reads, so fetch them concurrently. The config 404s only on
  // camera_not_found (the GET synthesizes a default otherwise) — map that one
  // case to notFound(), same as geometry.
  const [models, record]: [ModelRegistryEntry[], CameraProcessingConfigRecord] =
    await Promise.all([
      listModels({ accountId: activeAccountId }),
      getCameraProcessingConfig({ accountId: activeAccountId, cameraId }).catch(
        (err): CameraProcessingConfigRecord => {
          if (err instanceof UpstreamApiError && err.status === 404) {
            notFound();
          }
          throw err;
        },
      ),
    ]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/cameras/${cameraId}/configure`}
          className="inline-flex items-center gap-1 text-[clamp(0.78rem,1vw,0.92rem)] text-white/75 hover:text-white transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Configure
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 md:gap-6 items-start">
        <div>
          <ModelDetectionPanel
            cameraId={cameraId}
            models={models}
            initialConfig={record.config}
            isDefault={record.is_default}
          />
        </div>
        <aside className="space-y-4">
          <StatusPanel record={record} />
          <RawJsonDetails record={record} />
        </aside>
      </div>
    </div>
  );
}

// --- sidebar ----------------------------------------------------------------

function StatusPanel({ record }: { record: CameraProcessingConfigRecord }) {
  // is_default: default config, no operator save yet — small muted banner.
  // Saved: full panel with creek-mid accent + timestamps.
  const isDefault = record.is_default;
  return (
    <div
      className={
        "dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)] border " +
        (isDefault
          ? "border-black/10 bg-black/[0.02]"
          : "border-[var(--dn-creek-mid)]/30 bg-[var(--dn-creek-mid)]/10")
      }
    >
      <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        revision
      </p>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="font-mono font-bold text-[clamp(1.4rem,2.4vw,2rem)] text-black">
          r{record.revision}
        </span>
        <span className="font-mono text-xs uppercase tracking-wider text-[var(--dn-text-50)]">
          schema v{record.config.version} · {record.config.model_key}
        </span>
      </div>

      <ConfigSummary config={record.config} />

      {isDefault ? (
        <>
          <h3 className="mt-3 inline-flex items-center gap-2 font-bold text-black">
            <ShieldAlert className="h-4 w-4 text-[#8a6d1f]" aria-hidden />
            Not configured yet
          </h3>
          <p className="mt-1 text-sm text-[var(--dn-text-50)]">
            Save a model and classes to bump revision to{" "}
            <span className="font-mono">r1</span>. The processor falls back to
            its own default until you do.
          </p>
        </>
      ) : (
        <>
          <h3 className="mt-3 font-bold text-black">Operator-saved</h3>
          <p className="mt-1 text-sm text-[var(--dn-text-50)]">
            The processor picks this up on the camera&rsquo;s next session.
          </p>
          {record.updated_at ? (
            <p className="mt-2 text-xs font-mono text-[var(--dn-text-50)]">
              updated{" "}
              <RelativeTime
                value={record.updated_at}
                className="text-black/70"
              />
              {record.created_at ? (
                <>
                  {" · created "}
                  <RelativeTime
                    value={record.created_at}
                    className="text-black/70"
                  />
                </>
              ) : null}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

// Labeled summary of the saved (server) config, so the operator confirms what
// the api-server actually holds without reading raw JSON. `null` on an M6 field
// is the "use the runtime/model default" sentinel; an empty selected_classes is
// "all supported classes".
function ConfigSummary({ config }: { config: CameraProcessingConfig }) {
  const classes =
    config.selected_classes.length === 0
      ? "All supported classes"
      : config.selected_classes.length <= 3
        ? config.selected_classes.join(", ")
        : `${config.selected_classes.length} classes`;
  const tracker = config.tracker ?? "Runtime default";
  const confidence =
    config.confidence_threshold === null
      ? "Runtime default"
      : String(config.confidence_threshold);
  const fps =
    config.processing_fps === null
      ? "Runtime default"
      : `${config.processing_fps} FPS`;
  return (
    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
      <SummaryRow label="Model" value={config.model_key} mono />
      <SummaryRow label="Classes" value={classes} />
      <SummaryRow label="Tracker" value={tracker} />
      <SummaryRow label="Confidence" value={confidence} />
      <SummaryRow label="FPS" value={fps} />
    </dl>
  );
}

function SummaryRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <>
      <dt className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)] self-center">
        {label}
      </dt>
      <dd
        className={
          "text-black/80" + (mono ? " font-mono text-xs" : " text-sm")
        }
      >
        {value}
      </dd>
    </>
  );
}

// Collapsed-by-default raw-record disclosure. Engineers verifying the
// contract still want to see the exact shape; operators don't need it.
function RawJsonDetails({
  record,
}: {
  record: CameraProcessingConfigRecord;
}) {
  return (
    <details className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <summary className="cursor-pointer text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)] hover:text-black">
        Show raw record (debug)
      </summary>
      <p className="mt-2 text-xs text-[var(--dn-text-50)]">
        The exact CameraProcessingConfigRecord the api-server returns. For a
        never-configured camera this is the system default — the processor
        reads a separate endpoint and applies its own fallback. An empty
        <span className="font-mono"> selected_classes</span> means &ldquo;all
        supported classes&rdquo;.
      </p>
      <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-black/[0.04] p-3 font-mono text-[11px] text-black/80">
        {JSON.stringify(record, null, 2)}
      </pre>
    </details>
  );
}
