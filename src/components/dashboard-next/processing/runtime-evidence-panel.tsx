"use client";

import { useState } from "react";
import clsx from "clsx";
import { buildProcessingEvidencePath } from "@/lib/api/processing-evidence-path";
import { useUpstreamList } from "@/lib/api/use-list";
import type {
  ProcessingEvidenceRange,
  ProcessingEvidenceResponse,
} from "@/lib/api/types";
import { EvidenceLifecycleSignals } from "./evidence-lifecycle-signals";
import { EvidenceObservationCounts } from "./evidence-observation-counts";
import { EvidencePackageHistory } from "./evidence-package-history";
import { EvidenceRuntimeStatus } from "./evidence-runtime-status";

// P5-J Runtime Evidence — a read-only VISIBILITY panel below the package
// selector. Shows what the camera's processing has been doing recently
// (lineage, status, windowed observation counts, lifecycle signals, package
// history). It is NOT a recommendation surface — copy is observational. Fetched
// server-side at 24h (fallbackData) and re-fetched client-side on the range
// toggle via SWR. Degrades to empty/error states; never breaks the tab above.

const RANGES: ProcessingEvidenceRange[] = ["1h", "24h"];

function RangeToggle({
  range,
  onRangeChange,
}: {
  range: ProcessingEvidenceRange;
  onRangeChange: (r: ProcessingEvidenceRange) => void;
}) {
  return (
    <div role="group" aria-label="Evidence range" className="inline-flex gap-1">
      {RANGES.map((r) => {
        const active = r === range;
        return (
          <button
            key={r}
            type="button"
            aria-pressed={active}
            onClick={() => onRangeChange(r)}
            className={clsx(
              "rounded-full border px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider transition",
              active
                ? "border-[var(--dn-creek-mid)]/40 bg-[var(--dn-creek-mid)]/15 text-[var(--dn-creek-deep)]"
                : "border-white/10 bg-white/[0.06] text-[var(--dn-text-50)] hover:bg-white/[0.08] hover:text-white",
            )}
          >
            {r}
          </button>
        );
      })}
    </div>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm text-[var(--dn-text-50)]">{children}</p>;
}

export function RuntimeEvidencePanel({
  cameraId,
  initialEvidence,
}: {
  cameraId: string;
  initialEvidence: ProcessingEvidenceResponse | null;
}) {
  const [range, setRange] = useState<ProcessingEvidenceRange>("24h");
  const { data, error, isLoading } = useUpstreamList<ProcessingEvidenceResponse>(
    buildProcessingEvidencePath(cameraId, range),
    {
      // fallbackData only seeds the default (24h) key, which is what the server
      // pre-fetched; 1h fetches fresh on first toggle.
      fallbackData: range === "24h" ? (initialEvidence ?? undefined) : undefined,
      refreshInterval: 0,
    },
  );
  const evidence = data ?? null;

  return (
    <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
            runtime evidence
          </p>
          <p className="mt-1 text-[11px] text-[var(--dn-text-50)]">
            What this camera&rsquo;s processing has been doing recently.
            Read-only — this is evidence, not recommendations.
          </p>
        </div>
        <RangeToggle range={range} onRangeChange={setRange} />
      </div>

      {error ? (
        <Body>
          Could not load processing evidence. Existing camera monitoring is
          unaffected.
        </Body>
      ) : evidence === null ? (
        isLoading ? (
          <Body>Loading processing evidence…</Body>
        ) : (
          <Body>Runtime evidence will appear after a processing session starts.</Body>
        )
      ) : (
        <div className="mt-4 space-y-5">
          <EvidenceRuntimeStatus evidence={evidence} />
          <EvidenceObservationCounts evidence={evidence} range={range} />
          <EvidenceLifecycleSignals evidence={evidence} range={range} />
          <EvidencePackageHistory items={evidence.package_history} />
        </div>
      )}
    </section>
  );
}
