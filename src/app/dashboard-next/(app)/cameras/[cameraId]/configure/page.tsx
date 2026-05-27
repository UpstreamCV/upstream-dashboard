import { Shapes } from "lucide-react";

// Configure tab — the P6-B seam. No drawing tools yet, no API calls. The
// placeholder names what will land here so anyone navigating in can see the
// next milestone without reading docs.

export default function CameraConfigurePage() {
  return (
    <div className="dn-tile p-[clamp(1.5rem,3vw,2.5rem)] text-center">
      <Shapes
        className="mx-auto h-8 w-8 text-[var(--dn-creek-mid)]"
        aria-hidden
      />
      <h2 className="mt-4 font-bold text-[clamp(1.1rem,1.6vw,1.5rem)] text-black">
        Geometry editor coming next
      </h2>
      <p className="mx-auto mt-3 max-w-prose text-sm text-[var(--dn-text-50)]">
        This tab will host the per-camera configuration workflow.
      </p>
      <ul className="mx-auto mt-5 inline-block space-y-2 text-left text-sm text-black/80">
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
          <span className="font-bold">Later —</span> package / use-case picker
          and per-rule threshold + debounce controls.
        </li>
      </ul>
      <p className="mx-auto mt-5 max-w-prose text-xs font-mono text-[var(--dn-text-50)]">
        No drawing tools yet. No mock APIs. The Monitor tab still surfaces the
        currently-applied geometry through the perception overlay.
      </p>
    </div>
  );
}
