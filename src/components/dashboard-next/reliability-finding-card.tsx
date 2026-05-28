import { RelativeTime } from "@/components/data/relative-time";
import { StatusDot } from "./status-dot";
import { ReliabilityEvidence } from "./reliability-evidence";
import {
  SEVERITY_DOT,
  SEVERITY_LABEL,
  SEVERITY_TEXT,
} from "@/lib/perception/reliability-status";
import type { ReliabilityFinding } from "@/lib/api/types";

// One card per reliability finding (open or resolved). Renders title,
// message, severity badge, category, likely cause, recommended action,
// per-type formatted evidence, and lifecycle timestamps.
//
// Variant:
//   "open"     -> first/last seen, full action block (severity-colored)
//   "resolved" -> resolved_at + resolved_reason replaces the action block;
//                 the row is rendered de-saturated so the eye walks past it.
//
// Operator-facing copy only. Dedupe key, detector_version, processor_status_id,
// stream_session_id are never shown -- the brief explicitly bans them from
// prominent UI surfaces.

function ActionBlock({
  severity,
  children,
}: {
  severity: ReliabilityFinding["severity"];
  children: React.ReactNode;
}) {
  const color = severity === "critical" ? "#c0473b" : "#8a6d1f";
  return (
    <div className="mt-4">
      <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        recommended fix
      </p>
      <p
        className="mt-1 text-[clamp(0.85rem,1vw,0.95rem)]"
        style={{ color }}
      >
        {children}
      </p>
    </div>
  );
}

function CategoryBadge({
  category,
}: {
  category: ReliabilityFinding["category"];
}) {
  const label = formatCategory(category);
  return (
    <span className="rounded-full bg-[var(--dn-text-50)]/10 px-2 py-0.5 text-[10px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
      {label}
    </span>
  );
}

function formatCategory(category: string): string {
  if (category === "scene_quality") return "Scene quality";
  if (category === "geometry_config") return "Geometry";
  if (category === "stream") return "Stream";
  if (category === "processor") return "Processor";
  if (category === "detection") return "Detection";
  return category;
}

export function ReliabilityFindingCard({
  finding,
  variant,
}: {
  finding: ReliabilityFinding;
  variant: "open" | "resolved";
}) {
  return (
    <article
      className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]"
      style={{
        // De-emphasize resolved cards so the eye lands on open issues first.
        opacity: variant === "resolved" ? 0.7 : 1,
      }}
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5">
          <StatusDot status={SEVERITY_DOT[finding.severity]} />
          <span
            className="font-bold text-[clamp(0.85rem,1vw,0.95rem)]"
            style={{ color: SEVERITY_TEXT[finding.severity] }}
          >
            {SEVERITY_LABEL[finding.severity]}
          </span>
        </span>
        <CategoryBadge category={finding.category} />
      </header>

      <h3 className="mt-3 font-bold text-[clamp(1rem,1.2vw,1.15rem)] text-black">
        {finding.title}
      </h3>
      <p className="mt-2 text-[clamp(0.85rem,1vw,0.95rem)] text-[var(--dn-text-50)]">
        {finding.message}
      </p>

      {finding.likely_cause ? (
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
            likely cause
          </p>
          <p className="mt-1 text-[clamp(0.82rem,0.95vw,0.9rem)] font-mono text-[var(--dn-text-50)]">
            {finding.likely_cause}
          </p>
        </div>
      ) : null}

      <ReliabilityEvidence finding={finding} />

      {variant === "open" && finding.recommended_action ? (
        <ActionBlock severity={finding.severity}>
          {finding.recommended_action}
        </ActionBlock>
      ) : null}

      <footer className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {variant === "open" ? (
          <>
            <Stamp label="First seen" value={<RelativeTime value={finding.first_seen_at} />} />
            <Stamp label="Last seen" value={<RelativeTime value={finding.last_seen_at} />} />
          </>
        ) : (
          <>
            <Stamp
              label="Resolved"
              value={
                finding.resolved_at ? (
                  <RelativeTime value={finding.resolved_at} />
                ) : (
                  "—"
                )
              }
            />
            <Stamp label="Resolved reason" value={finding.resolved_reason ?? "—"} />
            <Stamp label="First seen" value={<RelativeTime value={finding.first_seen_at} />} />
          </>
        )}
      </footer>
    </article>
  );
}

function Stamp({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        {label}
      </p>
      <p className="mt-0.5 text-[clamp(0.78rem,0.9vw,0.85rem)] text-[var(--dn-text-50)]">
        {value}
      </p>
    </div>
  );
}
