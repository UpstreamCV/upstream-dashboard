import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Shapes } from "lucide-react";
import { RelativeTime } from "@/components/data/relative-time";
import { getActiveAccount } from "@/lib/account/active";
import { UpstreamApiError } from "@/lib/api/errors";
import { getCameraGeometryConfig } from "@/lib/api/geometry";
import type { GeometryConfigRecord } from "@/lib/api/types";

// P6-B Preflight — Geometry API + Schema Contract.
//
// Read-only preview of the camera's current saved geometry config. Renders
// real data from /v1/cameras/{id}/geometry-config (P6-A endpoint). When no
// operator save exists, the server returns the system probe-default with
// `is_default: true, revision: 0, id: null` — surfaced explicitly in the
// banner so the operator knows the difference between "system default" and
// "you saved this".
//
// No drawing tools yet. The P6-B editor will land in this same route,
// keeping these read-only panels as a "current saved" sidebar while a
// canvas takes the main column.

export default async function CameraGeometryPreflightPage({
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

  const roiCount = record.config.rois.length;
  const lineCount = record.config.lines.length;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard-next/cameras/${cameraId}/configure`}
          className="inline-flex items-center gap-1 text-[clamp(0.78rem,1vw,0.92rem)] text-white/75 hover:text-white transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Configure
        </Link>
      </div>

      <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
        <div className="flex items-start gap-3">
          <Shapes
            className="h-6 w-6 shrink-0 text-[var(--dn-creek-mid)]"
            aria-hidden
          />
          <div>
            <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
              geometry preflight
            </p>
            <h2 className="mt-1 font-bold text-[clamp(1.1rem,1.6vw,1.5rem)] text-black">
              Saved geometry for this camera
            </h2>
            <p className="mt-2 text-sm text-[var(--dn-text-50)]">
              Read-only view of the geometry config the processor will use on
              its next session. The drawing editor (P6-B) lands here next.
            </p>
          </div>
        </div>
      </div>

      <GeometryStatusPanel record={record} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <RoadmapCard />
        <RawJsonCard record={record} />
      </div>

      <ShapeCountsCard roiCount={roiCount} lineCount={lineCount} />
    </div>
  );
}

// --- panels ----------------------------------------------------------------

function GeometryStatusPanel({ record }: { record: GeometryConfigRecord }) {
  const banner = record.is_default
    ? {
        title: "Probe default — no operator save yet",
        body:
          "The server returned the system default (near-full-frame entry ROI + horizontal entry line). The processor uses this until an operator saves a config.",
        tone: "default" as const,
      }
    : {
        title: "Operator-saved",
        body:
          "This config was authored from the dashboard. The processor uses it from its next session onward.",
        tone: "saved" as const,
      };

  const tintBg =
    banner.tone === "saved"
      ? "bg-[var(--dn-creek-mid)]/10"
      : "bg-black/[0.04]";
  const tintBorder =
    banner.tone === "saved"
      ? "border-[var(--dn-creek-mid)]/30"
      : "border-black/10";

  return (
    <div className={`dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)] border ${tintBorder} ${tintBg}`}>
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
      <h3 className="mt-3 font-bold text-black">{banner.title}</h3>
      <p className="mt-1 text-sm text-[var(--dn-text-50)]">{banner.body}</p>
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
    </div>
  );
}

function ShapeCountsCard({
  roiCount,
  lineCount,
}: {
  roiCount: number;
  lineCount: number;
}) {
  return (
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        shapes
      </p>
      <div className="mt-2 grid grid-cols-2 gap-4">
        <div>
          <p className="font-mono text-3xl font-bold text-black">{roiCount}</p>
          <p className="text-xs uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
            ROI polygon{roiCount === 1 ? "" : "s"}
          </p>
        </div>
        <div>
          <p className="font-mono text-3xl font-bold text-black">{lineCount}</p>
          <p className="text-xs uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
            crossing line{lineCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-[var(--dn-text-50)]">
        ≤ 20 of each. Coordinates are normalized floats in [0, 1] — resolution
        independent.
      </p>
    </div>
  );
}

function RoadmapCard() {
  return (
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        what lands here
      </p>
      <ul className="mt-3 space-y-2 text-sm text-black/80">
        <li>
          <span className="font-bold">P6-B —</span> latest-frame drawing of
          lines, ROI polygons, and (later) exclusion zones. Save uses the
          schema below.
        </li>
        <li>
          <span className="font-bold">P6-C —</span> the processor consumes
          saved geometry on its next session.
        </li>
        <li>
          <span className="font-bold">P6-D —</span> end-to-end verification:
          observations re-emit against the new revision within seconds.
        </li>
      </ul>
      <p className="mt-4 rounded-lg border border-[#8a6d1f]/30 bg-[#8a6d1f]/[0.08] p-3 text-xs text-[#8a6d1f]">
        Drawing-library state (selections, drag handles, undo) is editor-local
        only. The persisted shape is the UpStream-owned schema below — the
        server rejects unknown fields with 422.
      </p>
    </div>
  );
}

function RawJsonCard({ record }: { record: GeometryConfigRecord }) {
  return (
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        raw record
      </p>
      <p className="mt-1 text-xs text-[var(--dn-text-50)]">
        The exact shape the api-server returns and the editor will PUT back.
      </p>
      <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-black/[0.04] p-3 font-mono text-[11px] text-black/80">
        {JSON.stringify(record, null, 2)}
      </pre>
    </div>
  );
}
