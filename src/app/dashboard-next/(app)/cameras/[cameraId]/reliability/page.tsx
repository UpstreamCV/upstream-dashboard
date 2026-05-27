import { ShieldCheck } from "lucide-react";

// Reliability tab stub — locks the workflow route shape now so future work
// doesn't reshuffle the tab strip. No fake metrics. The reliability layer
// needs backend signals (scene-quality scoring, suspicious-event flags,
// missed-event detection, tuning recommendations) that don't exist yet.

export default function CameraReliabilityPage() {
  return (
    <div className="dn-tile p-[clamp(1.5rem,3vw,2.5rem)] text-center">
      <ShieldCheck
        className="mx-auto h-8 w-8 text-[var(--dn-creek-mid)]"
        aria-hidden
      />
      <h2 className="mt-4 font-bold text-[clamp(1.1rem,1.6vw,1.5rem)] text-black">
        Reliability metrics coming soon
      </h2>
      <p className="mx-auto mt-3 max-w-prose text-sm text-[var(--dn-text-50)]">
        This tab will surface scene-quality warnings, suspicious-event flags,
        missed-event candidates, reliability findings, and tuning
        recommendations — once the underlying signals exist server-side.
      </p>
      <p className="mx-auto mt-4 max-w-prose text-xs font-mono text-[var(--dn-text-50)]">
        Until then, use Monitor for live state and Observations for the raw
        processor event stream.
      </p>
    </div>
  );
}
