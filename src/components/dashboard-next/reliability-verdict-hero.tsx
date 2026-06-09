import { RelativeTime } from "@/components/data/relative-time";
import { CheckCircle2, CircleSlash, HelpCircle, TriangleAlert } from "lucide-react";
import {
  SUMMARY_LABEL,
  variantOfSummary,
  type SummaryVariant,
} from "@/lib/perception/reliability-status";
import type { ReliabilitySeverity, ReliabilitySummary } from "@/lib/api/types";

// Bold, status-colored verdict hero for the Reliability tab — replaces the plain
// summary card. Server Component (display-only); reads the same ReliabilitySummary
// and the shared status palette so it never drifts from the Monitor card.

const PRES: Record<
  SummaryVariant,
  { accent: string; tint: string; icon: typeof CheckCircle2; sub: string }
> = {
  healthy: {
    accent: "#3f7d4e",
    tint: "#eef6f0",
    icon: CheckCircle2,
    sub: "No active findings — detections are reliable.",
  },
  info: {
    accent: "#8a6d1f",
    tint: "#faf4e6",
    icon: TriangleAlert,
    sub: "Informational findings to review.",
  },
  needs_review: {
    accent: "#8a6d1f",
    tint: "#faf4e6",
    icon: TriangleAlert,
    sub: "Some findings need a look — review and apply a fix below.",
  },
  critical: {
    accent: "#c0473b",
    tint: "#faedeb",
    icon: TriangleAlert,
    sub: "Critical findings — detections may be unreliable.",
  },
  unknown: {
    accent: "var(--dn-text-50)",
    tint: "#f6f6f5",
    icon: HelpCircle,
    sub: "Not enough recent stream, processor, or perception data to evaluate this camera yet.",
  },
  unavailable: {
    accent: "var(--dn-text-50)",
    tint: "#f6f6f5",
    icon: CircleSlash,
    sub: "Reliability data is currently unavailable. Try refreshing; existing camera monitoring is unaffected.",
  },
};

function severityLabel(severity: ReliabilitySeverity | null): string {
  if (severity === "critical") return "Critical";
  if (severity === "warning") return "Warning";
  if (severity === "info") return "Info";
  return "—";
}

export function ReliabilityVerdictHero({
  summary,
}: {
  summary: ReliabilitySummary | null;
}) {
  const variant = variantOfSummary(summary);
  const p = PRES[variant];
  const Icon = p.icon;
  const showStats =
    summary != null &&
    variant !== "healthy" &&
    variant !== "unknown" &&
    variant !== "unavailable";

  return (
    <section
      className="dn-tile overflow-hidden p-[clamp(1.2rem,2vw,1.7rem)]"
      style={{ background: p.tint, borderLeft: `5px solid ${p.accent}` }}
    >
      <div className="flex flex-wrap items-center gap-[clamp(0.9rem,1.6vw,1.3rem)]">
        <span
          className="grid shrink-0 place-items-center rounded-full"
          style={{
            width: "clamp(48px,5vw,64px)",
            height: "clamp(48px,5vw,64px)",
            background: variant === "unknown" || variant === "unavailable" ? "rgba(0,0,0,0.06)" : `${p.accent}22`,
          }}
        >
          <Icon style={{ width: "clamp(24px,2.6vw,32px)", height: "clamp(24px,2.6vw,32px)", color: p.accent }} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
            reliability status
          </p>
          <h1
            className="mt-0.5 font-bold leading-none text-[clamp(1.6rem,3vw,2.4rem)]"
            style={{ color: p.accent }}
          >
            {SUMMARY_LABEL[variant]}
          </h1>
          <p className="mt-2 text-[clamp(0.85rem,1vw,0.98rem)] text-[var(--dn-text-50)]">
            {p.sub}
            {summary ? (
              <>
                {" · evaluated "}
                <RelativeTime value={summary.last_evaluated_at} />
              </>
            ) : null}
          </p>
        </div>

        {showStats ? (
          <div className="flex gap-2.5">
            <Stat label="Open findings" value={String(summary.open_findings_count)} accent={p.accent} />
            <Stat label="Highest severity" value={severityLabel(summary.highest_severity)} accent={p.accent} />
          </div>
        ) : null}
      </div>

      {summary?.recommended_next_action ? (
        <div
          className="mt-[clamp(0.9rem,1.5vw,1.2rem)] flex items-start gap-2 rounded-xl bg-white/70 p-3"
          style={{ boxShadow: `inset 3px 0 0 ${p.accent}` }}
        >
          <span className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)] shrink-0 pt-0.5">
            recommended next action
          </span>
          <span className="text-[clamp(0.85rem,1vw,0.95rem)] font-medium" style={{ color: p.accent }}>
            {summary.recommended_next_action}
          </span>
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl bg-white/70 px-3.5 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        {label}
      </p>
      <p className="mt-0.5 font-bold text-[clamp(1.1rem,1.6vw,1.5rem)]" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}
