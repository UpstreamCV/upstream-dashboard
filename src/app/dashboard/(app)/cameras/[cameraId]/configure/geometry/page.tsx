import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ImageOff, Shapes, ShieldAlert } from "lucide-react";
import { RelativeTime } from "@/components/data/relative-time";
import { GeometryEditorPanel } from "@/components/dashboard-next/geometry/geometry-editor-panel";
import { getActiveAccount } from "@/lib/account/active";
import { UpstreamApiError } from "@/lib/api/errors";
import { getCameraGeometryConfig } from "@/lib/api/geometry";
import { getLatestFrame } from "@/lib/api/snapshots";
import type { GeometryConfigRecord, LatestFrame } from "@/lib/api/types";

// P6-B1 — Latest-Frame Geometry Editor Foundation.
//
// Server-renders the camera's current geometry record + latest frame, then
// hands both to the interactive <GeometryEditorPanel> (Client Component).
// Line authoring only in this milestone; ROIs render read-only and pass
// through unchanged on save (the model's editorStateToGeometryConfig is the
// boundary — see geometry-editor-model.ts + its tests).
//
// Sidebar carries the server-rendered status panel (revision + timestamps),
// the persistence-boundary reminder, and a collapsed raw-JSON inspector
// for engineers verifying the wire shape. The sidebar re-renders after
// every successful save because the editor calls router.refresh().

export default async function CameraGeometryEditorPage({
  params,
}: {
  params: Promise<{ cameraId: string }>;
}) {
  const { cameraId } = await params;
  const { activeAccountId } = await getActiveAccount();

  let record: GeometryConfigRecord;
  try {
    record = await getCameraGeometryConfig({
      accountId: activeAccountId,
      cameraId,
    });
  } catch (err) {
    if (err instanceof UpstreamApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  // getLatestFrame returns null on 404 / snapshot_not_found — the camera
  // hasn't streamed yet, so there's nothing to draw on. We still render
  // the sidebar (operator can read the status + raw record) but show an
  // empty state where the canvas would be.
  const latestFrame: LatestFrame | null = await getLatestFrame({
    accountId: activeAccountId,
    cameraId,
  });

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/cameras/${cameraId}/configure`}
          className="inline-flex items-center gap-1 text-[clamp(0.78rem,1vw,0.92rem)] text-white/75 hover:text-white transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Configure
        </Link>
      </div>

      <HeaderTile
        isDefault={record.is_default}
        hasFrame={latestFrame != null}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 md:gap-6 items-start">
        <div>
          {latestFrame ? (
            <GeometryEditorPanel
              cameraId={cameraId}
              latestFrame={latestFrame}
              initialConfig={record.config}
              startEmpty={record.is_default}
            />
          ) : (
            <NoFrameEmptyState />
          )}
        </div>
        <aside className="space-y-4">
          <StatusPanel record={record} />
          <PersistenceWarningCard />
          <RawJsonDetails record={record} />
        </aside>
      </div>
    </div>
  );
}

// --- header -----------------------------------------------------------------

function HeaderTile({
  isDefault,
  hasFrame,
}: {
  isDefault: boolean;
  hasFrame: boolean;
}) {
  let body: string;
  if (!hasFrame) {
    body =
      "This camera hasn't captured a frame yet. Start a stream session to capture one — then draw lines and ROIs here.";
  } else if (isDefault) {
    body =
      "No operator-saved geometry yet. Draw counting lines and polygon ROIs on the latest frame, then save to commit revision 1.";
  } else {
    body =
      "Draw counting lines and polygon ROIs on the latest frame. ROIs are saved as normalized polygons; lines as two normalized endpoints.";
  }
  return (
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <div className="flex items-start gap-3">
        <Shapes
          className="h-6 w-6 shrink-0 text-[var(--dn-creek-mid)]"
          aria-hidden
        />
        <div>
          <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
            geometry editor
          </p>
          <h2 className="mt-1 font-bold text-[clamp(1.1rem,1.6vw,1.5rem)] text-black">
            Counting lines and polygon ROIs on the latest frame
          </h2>
          <p className="mt-2 text-sm text-[var(--dn-text-50)]">{body}</p>
        </div>
      </div>
    </div>
  );
}

// --- main-column empty state (no latest frame) ------------------------------

function NoFrameEmptyState() {
  return (
    <div className="dn-tile p-[clamp(1.5rem,3vw,2.5rem)] text-center">
      <ImageOff
        className="mx-auto h-8 w-8 text-[var(--dn-text-50)]"
        aria-hidden
      />
      <h3 className="mt-4 font-bold text-[clamp(1rem,1.4vw,1.2rem)] text-black">
        Latest frame required to draw geometry
      </h3>
      <p className="mx-auto mt-3 max-w-prose text-sm text-[var(--dn-text-50)]">
        Start a stream session for this camera to capture a latest frame.
        Once one is available, the editor opens here and you can draw
        counting lines directly on the captured frame.
      </p>
      <p className="mx-auto mt-2 max-w-prose text-xs text-[var(--dn-text-50)]">
        The sidebar still shows the current geometry record so engineers can
        verify the wire shape without waiting for a stream.
      </p>
    </div>
  );
}

// --- sidebar ----------------------------------------------------------------

function StatusPanel({ record }: { record: GeometryConfigRecord }) {
  // is_default: probe default, no operator save yet — small muted banner.
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
          schema v{record.config.version} · {record.config.frame.coordinate_space}
        </span>
      </div>
      {isDefault ? (
        <>
          <h3 className="mt-3 inline-flex items-center gap-2 font-bold text-black">
            <ShieldAlert
              className="h-4 w-4 text-[#8a6d1f]"
              aria-hidden
            />
            Not configured yet
          </h3>
          <p className="mt-1 text-sm text-[var(--dn-text-50)]">
            Draw and save geometry to bump revision to <span className="font-mono">r1</span>.
            The processor falls back to its own default until you do.
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

function PersistenceWarningCard() {
  return (
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        persistence boundary
      </p>
      <ul className="mt-3 space-y-2 text-sm text-black/80">
        <li>
          Geometry saves in normalized coordinates (0..1) so it&rsquo;s
          resolution-independent.
        </li>
        <li>
          Editor working state (selection, drag, draft, hover) is never
          persisted — only the UpStream schema rides the wire.
        </li>
        <li>
          <span className="font-bold">P6-C —</span> processor consumes saved
          geometry on its next session.
        </li>
        <li>
          <span className="font-bold">P6-D —</span> observations re-emit
          against the new revision; reliability tab gets its first signal.
        </li>
      </ul>
    </div>
  );
}

// Collapsed-by-default raw-record disclosure. Engineers verifying the
// contract still want to see the exact shape; operators don't need it.
function RawJsonDetails({ record }: { record: GeometryConfigRecord }) {
  return (
    <details className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <summary className="cursor-pointer text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)] hover:text-black">
        Show raw record (debug)
      </summary>
      <p className="mt-2 text-xs text-[var(--dn-text-50)]">
        The exact GeometryConfigRecord the api-server returns. For a
        never-configured camera this is the system probe-default — the
        processor reads a separate endpoint and applies its own fallback.
      </p>
      <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-black/[0.04] p-3 font-mono text-[11px] text-black/80">
        {JSON.stringify(record, null, 2)}
      </pre>
    </details>
  );
}
