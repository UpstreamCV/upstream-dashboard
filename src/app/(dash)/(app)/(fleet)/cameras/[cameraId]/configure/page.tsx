import Link from "next/link";
import { ArrowRight, Shapes, Sparkles, Zap } from "lucide-react";

// Configure tab — landing page for camera configuration options. The geometry
// card routes into the line / ROI drawing tools; additional configuration
// surfaces (triggers, upcoming features) are listed below it.
//
// Model/package selection deliberately does NOT live here — it moved to the
// Processing tab (P5-H), where a package embodies the model/detection choice.
// Configure is for spatial/alerting config (geometry + triggers).

export default async function CameraConfigurePage({
  params,
}: {
  params: Promise<{ cameraId: string }>;
}) {
  const { cameraId } = await params;
  const geometryHref = `/cameras/${cameraId}/configure/geometry`;
  const rulesHref = `/cameras/${cameraId}/configure/rules`;

  return (
    <div className="space-y-4 md:space-y-6">
      <Link
        href={geometryHref}
        className="group dn-tile flex items-center gap-4 p-[clamp(1.1rem,1.8vw,1.5rem)] transition hover:bg-[var(--dn-creek-mid)]/5"
      >
        <Shapes
          className="h-7 w-7 shrink-0 text-[var(--dn-creek-mid)]"
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[clamp(1rem,1.4vw,1.2rem)] text-black">
            Geometry editor
          </h3>
          <p className="mt-1 text-sm text-[var(--dn-text-50)]">
            Draw and save counting lines and polygon ROIs on the latest frame.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--dn-creek-mid)]/15 px-3 py-1.5 text-sm font-bold text-[var(--dn-creek-deep)] transition group-hover:bg-[var(--dn-creek-mid)]/25">
          Open editor
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </Link>

      {/* Triggers & Effects — Rules/Triggers M1 rule editor */}
      <Link
        href={rulesHref}
        className="group dn-tile flex items-center gap-4 p-[clamp(1.1rem,1.8vw,1.5rem)] transition hover:bg-[var(--dn-creek-mid)]/5"
      >
        <Zap className="h-7 w-7 shrink-0 text-[var(--dn-creek-mid)]" aria-hidden />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[clamp(1rem,1.4vw,1.2rem)] text-black">Triggers &amp; Effects</h3>
          <p className="mt-1 text-sm text-[var(--dn-text-50)]">Define rules that raise alerts when detections match — line crossings, ROI occupancy, zone entries, dwell time.</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--dn-creek-mid)]/15 px-3 py-1.5 text-sm font-bold text-[var(--dn-creek-deep)] transition group-hover:bg-[var(--dn-creek-mid)]/25">
          Configure
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </Link>

      {/* More coming soon — greyed-out disabled card */}
      <div className="dn-tile flex items-center gap-4 p-[clamp(1.1rem,1.8vw,1.5rem)] opacity-60 cursor-default">
        <Sparkles className="h-7 w-7 shrink-0 text-[var(--dn-text-50)]" aria-hidden />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[clamp(1rem,1.4vw,1.2rem)] text-[var(--dn-text-50)]">More coming soon</h3>
          <p className="mt-1 text-sm text-[var(--dn-text-50)]">Additional configuration surfaces are on the way.</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--dn-text-15)] px-3 py-1.5 text-sm font-bold text-[var(--dn-text-50)]">
          Coming soon
        </span>
      </div>

      <p className="text-sm text-[var(--dn-text-50)]">
        Looking for model or package selection? It moved to the{" "}
        <Link
          href={`/cameras/${cameraId}/processing`}
          className="text-[var(--dn-creek-mid)] underline"
        >
          Processing
        </Link>{" "}
        tab.
      </p>
    </div>
  );
}
