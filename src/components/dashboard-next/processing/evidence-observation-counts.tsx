"use client";

import type {
  ProcessingEvidenceRange,
  ProcessingEvidenceResponse,
} from "@/lib/api/types";
import {
  rangeLabel,
  shortObservationType,
} from "@/lib/perception/processing-evidence-format";

// Windowed observation counts by type. These ARE windowed (from the
// observations table), unlike the session-level tracking metrics below.

export function EvidenceObservationCounts({
  evidence,
  range,
}: {
  evidence: ProcessingEvidenceResponse;
  range: ProcessingEvidenceRange;
}) {
  const counts = evidence.observation_counts;
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
        recent observations · {rangeLabel(range)}
      </p>
      {counts.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--dn-text-50)]">
          No observations in the {rangeLabel(range)}.
        </p>
      ) : (
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {counts.map((c) => (
            <li
              key={c.type}
              className="dn-tile flex items-baseline justify-between gap-2 p-2.5"
            >
              <span className="font-mono text-xs text-[var(--dn-text-50)]">
                {shortObservationType(c.type)}
              </span>
              <span className="font-mono text-sm font-bold text-white">
                {c.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
