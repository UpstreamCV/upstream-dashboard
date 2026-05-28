import { RelativeTime } from "@/components/data/relative-time";
import { StatusDot } from "./status-dot";
import {
  SUMMARY_DOT,
  SUMMARY_LABEL,
  SUMMARY_TEXT,
  variantOfSummary,
} from "@/lib/perception/reliability-status";
import type { ReliabilitySummary } from "@/lib/api/types";

// Reliability tab header: status + open-count + highest-severity +
// last-evaluated + recommended next action. Server Component, mirrors the
// Monitor card's palette via the shared reliability-status helper so the
// two surfaces never drift.
//
// Healthy / unknown / unavailable collapse to muted single-sentence copy
// per the brief. Non-healthy renders the rolled-up counts + recommended
// next action; the per-finding detail lives in <ReliabilityFindingCard /> on
// the same page.

function severityLabel(severity: string | null): string {
  if (severity === "critical") return "Critical";
  if (severity === "warning") return "Warning";
  if (severity === "info") return "Info";
  return "—";
}

export function ReliabilitySummaryCard({
  summary,
}: {
  summary: ReliabilitySummary | null;
}) {
  const variant = variantOfSummary(summary);

  // Healthy / unknown / unavailable: short single-sentence body, nothing
  // else to surface yet.
  if (variant === "healthy") {
    return (
      <Card variant={variant}>
        <p className="mt-3 text-[clamp(0.85rem,1vw,0.95rem)] text-[var(--dn-text-50)]">
          No active reliability findings for this camera.
        </p>
      </Card>
    );
  }
  if (variant === "unknown") {
    return (
      <Card variant={variant}>
        <p className="mt-3 text-[clamp(0.85rem,1vw,0.95rem)] text-[var(--dn-text-50)]">
          Not enough recent stream, processor, or perception data to evaluate
          this camera yet.
        </p>
      </Card>
    );
  }
  if (variant === "unavailable") {
    return (
      <Card variant={variant}>
        <p className="mt-3 text-[clamp(0.85rem,1vw,0.95rem)] text-[var(--dn-text-50)]">
          Reliability data is currently unavailable for this camera. Try
          refreshing the page; existing camera monitoring is unaffected.
        </p>
      </Card>
    );
  }

  // info / needs_review / critical: render the roll-up.
  const s = summary!;
  return (
    <Card variant={variant}>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
        <Stat label="Open findings" value={String(s.open_findings_count)} />
        <Stat
          label="Highest severity"
          value={severityLabel(s.highest_severity)}
        />
        <Stat
          label="Last evaluated"
          value={
            s.last_evaluated_at ? (
              <RelativeTime value={s.last_evaluated_at} />
            ) : (
              "—"
            )
          }
        />
      </div>
      {s.recommended_next_action ? (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
            recommended next action
          </p>
          <p className="mt-1 text-[clamp(0.85rem,1vw,0.95rem)] text-black">
            {s.recommended_next_action}
          </p>
        </div>
      ) : null}
    </Card>
  );
}

function Card({
  variant,
  children,
}: {
  variant: ReturnType<typeof variantOfSummary>;
  children: React.ReactNode;
}) {
  return (
    <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          reliability
        </p>
        <span className="inline-flex items-center gap-1.5">
          <StatusDot status={SUMMARY_DOT[variant]} />
          <span
            className="font-bold text-[clamp(0.95rem,1.1vw,1.05rem)]"
            style={{ color: SUMMARY_TEXT[variant] }}
          >
            {SUMMARY_LABEL[variant]}
          </span>
        </span>
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        {label}
      </p>
      <p className="mt-1 text-[clamp(0.9rem,1.05vw,1rem)] text-black">
        {value}
      </p>
    </div>
  );
}
