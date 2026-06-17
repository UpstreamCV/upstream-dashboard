"use client";

import type { ProcessingPackage } from "@/lib/api/types";

// Expanded, read-only metadata for one package: lineage (model / tracker /
// analytics profile ids), what it detects/emits/triggers, limitations, and
// the server-authored readiness notes. No raw DeepStream config.

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-xs text-white/80 break-words">
        {value}
      </dd>
    </div>
  );
}

function List({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
        {label}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[11px] text-white/80"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function Bullets({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
        {label}
      </p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-[var(--dn-text-50)]">
        {items.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function PackageDetail({ pkg }: { pkg: ProcessingPackage }) {
  const humanize = (s: string) => s.replace(/_/g, " ");
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        <Cell label="model" value={pkg.model_id ?? "—"} />
        <Cell label="tracker" value={pkg.tracker_profile_id ?? "—"} />
        <Cell label="analytics" value={pkg.analytics_profile_id ?? "—"} />
        <Cell label="runtime" value={pkg.runtime} />
        <Cell label="compute" value={pkg.compute_tier ?? "—"} />
        <Cell label="observation volume" value={pkg.observation_volume_risk ?? "—"} />
      </dl>

      {pkg.supported_classes.length > 0 ? (
        <List label="detects" items={pkg.supported_classes} />
      ) : (
        <p className="text-xs text-[var(--dn-text-50)]">
          Detects every class the underlying model supports.
        </p>
      )}
      {pkg.supported_outputs.length > 0 ? (
        <List
          label="emits"
          items={pkg.supported_outputs.map((o) => o.replace(/^processor\./, ""))}
        />
      ) : null}
      {pkg.supported_triggers.length > 0 ? (
        <List label="triggers" items={pkg.supported_triggers.map(humanize)} />
      ) : null}
      {pkg.supported_shapes.length > 0 ? (
        <List label="geometry shapes" items={pkg.supported_shapes.map(humanize)} />
      ) : null}
      {pkg.limitations.length > 0 ? (
        <Bullets label="limitations" items={pkg.limitations} />
      ) : null}
      {pkg.not_recommended_for.length > 0 ? (
        <Bullets
          label="not recommended for"
          items={pkg.not_recommended_for.map(humanize)}
        />
      ) : null}
      {pkg.readiness_notes ? (
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
            readiness
          </p>
          <p className="mt-1 text-xs text-[var(--dn-text-50)]">
            {pkg.readiness_notes}
          </p>
        </div>
      ) : null}
    </div>
  );
}
