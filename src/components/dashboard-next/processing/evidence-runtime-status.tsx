"use client";

import { formatRelative } from "@/lib/time";
import type { ProcessingEvidenceResponse } from "@/lib/api/types";

// Current runtime: requested/applied package + state, processor status, and the
// model/tracker/analytics lineage that actually ran. Observational only.

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

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
        {label}
      </dt>
      <dd className="mt-0.5 break-words font-mono text-xs text-white/80">
        {value}
      </dd>
    </div>
  );
}

export function EvidenceRuntimeStatus({
  evidence,
}: {
  evidence: ProcessingEvidenceResponse;
}) {
  const { package: pkg, lineage, status } = evidence;
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
        current runtime
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
        <Row label="Requested" value={pkg.requested_package_id ?? "—"} />
        <Row
          label="Applied"
          value={pkg.applied_package_id ?? "Not yet running"}
        />
        <Row label="State" value={pkg.state} />
        <Row
          label="Processor"
          value={status.status ?? "No status reported yet"}
        />
        {status.last_seen_at ? (
          <Row label="Last seen" value={formatRelative(status.last_seen_at)} />
        ) : null}
        {status.last_error_code ? (
          <Row label="Last error" value={status.last_error_code} />
        ) : null}
        {pkg.requested_revision != null ? (
          <Row label="Config revision" value={`r${pkg.requested_revision}`} />
        ) : null}
      </dl>

      <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
        lineage
      </p>
      <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Cell label="model" value={lineage.model_id ?? "—"} />
        <Cell label="tracker" value={lineage.tracker_profile_id ?? "—"} />
        <Cell label="algorithm" value={lineage.tracker_algorithm ?? "—"} />
        <Cell label="analytics" value={lineage.analytics_profile_id ?? "—"} />
      </dl>
    </div>
  );
}
