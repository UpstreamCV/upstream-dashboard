import Link from "next/link";
import { ArrowRight, ScanEye, Shapes, Sparkles, Zap } from "lucide-react";
import { ModelDetectionCard } from "@/components/dashboard-next/model-detection-card";

// Configure tab — landing page for camera configuration options. The geometry
// card routes into the line / ROI drawing tools; additional configuration
// surfaces (triggers, upcoming features) are listed below it.

export default async function CameraConfigurePage({
  params,
}: {
  params: Promise<{ cameraId: string }>;
}) {
  const { cameraId } = await params;
  const geometryHref = `/dashboard/cameras/${cameraId}/configure/geometry`;
  const detectionHref = `/dashboard/cameras/${cameraId}/configure/detection`;

  return (
    <div className="space-y-4 md:space-y-6">
      <Link
        href={detectionHref}
        className="group dn-tile flex items-center gap-4 p-[clamp(1.1rem,1.8vw,1.5rem)] transition hover:bg-[var(--dn-creek-mid)]/5"
      >
        <ScanEye
          className="h-7 w-7 shrink-0 text-[var(--dn-creek-mid)]"
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[clamp(1rem,1.4vw,1.2rem)] text-black">
            Model &amp; Detection
          </h3>
          <p className="mt-1 text-sm text-[var(--dn-text-50)]">
            Choose the detection model and which object classes to detect.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--dn-creek-mid)]/15 px-3 py-1.5 text-sm font-bold text-[var(--dn-creek-deep)] transition group-hover:bg-[var(--dn-creek-mid)]/25">
          Open editor
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </Link>

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

      {/* Model & Detection — inline interactive card (model select + thresholds) */}
      <ModelDetectionCard cameraId={cameraId} />

      {/* Triggers & Effects — inert (non-navigating) card; feature not yet wired up */}
      <div className="group dn-tile flex items-center gap-4 p-[clamp(1.1rem,1.8vw,1.5rem)] transition hover:bg-[var(--dn-creek-mid)]/5 cursor-default">
        <Zap className="h-7 w-7 shrink-0 text-[var(--dn-creek-mid)]" aria-hidden />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[clamp(1rem,1.4vw,1.2rem)] text-black">Triggers &amp; Effects</h3>
          <p className="mt-1 text-sm text-[var(--dn-text-50)]">Define rules that fire actions when observations match — alerts, webhooks, and more.</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--dn-creek-mid)]/15 px-3 py-1.5 text-sm font-bold text-[var(--dn-creek-deep)]">
          Configure
        </span>
      </div>

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
    </div>
  );
}
