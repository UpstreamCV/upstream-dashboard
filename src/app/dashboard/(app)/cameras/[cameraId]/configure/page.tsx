import Link from "next/link";
import { ArrowRight, ScanEye, Shapes } from "lucide-react";

// Configure tab — the P6-B seam. The preflight sub-route at ./geometry
// already renders the camera's real saved geometry (read-only); the
// drawing tools land in P6-B and slot into that same route.

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

      <div className="dn-tile p-[clamp(1.5rem,3vw,2.5rem)]">
        <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          configure roadmap
        </p>
        <ul className="mx-auto mt-4 inline-block space-y-2 text-left text-sm text-black/80">
          <li>
            <span className="font-bold">P6-B —</span> latest-frame line / ROI /
            zone drawing, with UpStream-owned normalized geometry schema.
          </li>
          <li>
            <span className="font-bold">P6-C —</span> the processor consumes
            saved geometry on the next stream session.
          </li>
          <li>
            <span className="font-bold">P6-D —</span> end-to-end verification:
            observations re-emit against the new geometry within seconds.
          </li>
          <li>
            <span className="font-bold">Later —</span> package / use-case
            picker and per-rule threshold + debounce controls.
          </li>
        </ul>
        <p className="mt-5 text-xs font-mono text-[var(--dn-text-50)]">
          No drawing tools yet. No mock APIs. The Monitor tab still surfaces
          the currently-applied geometry through the perception overlay.
        </p>
      </div>
    </div>
  );
}
