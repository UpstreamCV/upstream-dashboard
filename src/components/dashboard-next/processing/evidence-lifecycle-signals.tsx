"use client";

import type {
  ProcessingEvidenceRange,
  ProcessingEvidenceResponse,
} from "@/lib/api/types";
import {
  inferredExitsCopy,
  warningLabel,
} from "@/lib/perception/processing-evidence-format";

// Lifecycle-policy signals (P5-Gap inferred exits) + session-level tracking.
// Observational copy only — "this is evidence, not a recommendation". The
// session-to-date label + warning footnotes are load-bearing: they stop a
// reader from misreading the tracker count as a windowed metric.

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="self-center font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
        {label}
      </dt>
      <dd className="text-sm text-white/85">{value}</dd>
    </>
  );
}

export function EvidenceLifecycleSignals({
  evidence,
  range,
}: {
  evidence: ProcessingEvidenceResponse;
  range: ProcessingEvidenceRange;
}) {
  const { lifecycle, tracking, warnings } = evidence;
  const copy = inferredExitsCopy(lifecycle, range);
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
        lifecycle signals
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
        <Row
          label="Inferred zone exits"
          value={String(lifecycle.inferred_zone_exits)}
        />
        <Row
          label="Track-missing-timeout exits"
          value={String(lifecycle.track_missing_timeout_exits)}
        />
      </dl>
      {copy ? <p className="mt-2 text-sm text-white/80">{copy}</p> : null}

      <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
        tracking · session-to-date
      </p>
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
        <Row
          label="Unique tracker IDs"
          value={
            tracking.unique_tracker_ids_count != null
              ? String(tracking.unique_tracker_ids_count)
              : "—"
          }
        />
        {tracking.tracker_ids_sample.length > 0 ? (
          <Row label="Recent IDs" value={tracking.tracker_ids_sample.join(", ")} />
        ) : null}
      </dl>

      {warnings.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {warnings.map((w) => (
            <li key={w} className="text-xs text-[var(--dn-text-50)]">
              · {warningLabel(w)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
