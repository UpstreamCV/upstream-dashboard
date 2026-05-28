import { StatusDot, type DotStatus } from "./status-dot";
import type {
  ReliabilityFinding,
  ReliabilitySummary,
  ReliabilitySummaryStatus,
} from "@/lib/api/types";

// Monitor-tab Reliability card (Reliability M0/M1-A).
//
// Backed by GET /v1/cameras/{id}/reliability/summary. The api-server runs the
// rule set on read and returns one categorical verdict; this card surfaces it
// to operators so a live but broken workflow stops being invisible.
//
// Server Component — same posture as AppliedGeometryPanel. Reliability state
// changes on lifecycle / freshness, not per frame; the card is intentionally
// non-polling. Operators reload or navigate to refresh.
//
// Copy is operator-facing. No runtime-internal terms (DeepStream, GStreamer)
// and no model-accuracy claims; the language is "may reduce" / "should not be
// trusted until …", which matches the heuristic-warning posture of the slice.

// summary === null = api-server returned 404 (camera_not_found or the
// reliability endpoint itself unavailable). We render a muted Unavailable
// state instead of crashing the surrounding tab.
type Variant = ReliabilitySummaryStatus | "unavailable";

function variantOf(summary: ReliabilitySummary | null): Variant {
  return summary === null ? "unavailable" : summary.status;
}

const HEADER_DOT: Record<Variant, DotStatus> = {
  healthy: "green",
  info: "yellow",
  needs_review: "yellow",
  critical: "red",
  unknown: "neutral",
  unavailable: "neutral",
};

const HEADER_TEXT: Record<Variant, string> = {
  healthy: "#3f7d4e",
  info: "#8a6d1f",
  needs_review: "#8a6d1f",
  critical: "#c0473b",
  unknown: "var(--dn-text-50)",
  unavailable: "var(--dn-text-50)",
};

const HEADER_LABEL: Record<Variant, string> = {
  healthy: "Healthy",
  info: "Info",
  needs_review: "Needs review",
  critical: "Critical",
  unknown: "Unknown",
  unavailable: "Unavailable",
};

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-[clamp(0.78rem,0.9vw,0.85rem)] text-[#8a6d1f]">
      {children}
    </p>
  );
}

function Danger({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-[clamp(0.78rem,0.9vw,0.85rem)] text-[#c0473b]">
      {children}
    </p>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-[clamp(0.78rem,0.9vw,0.85rem)] text-[var(--dn-text-50)]">
      {children}
    </p>
  );
}

function FindingBody({
  finding,
  variant,
}: {
  finding: ReliabilityFinding;
  variant: Variant;
}) {
  // Recommended-action block is colored by severity so a critical jumps
  // visually without needing extra chrome on the card.
  const Action = variant === "critical" ? Danger : Warning;
  return (
    <>
      <p className="font-bold text-[clamp(0.95rem,1.1vw,1.05rem)] text-black">
        {finding.title}
      </p>
      <p className="mt-2 text-[clamp(0.82rem,0.95vw,0.9rem)] text-[var(--dn-text-50)]">
        {finding.message}
      </p>
      {finding.likely_cause ? (
        <p className="mt-2 text-[clamp(0.75rem,0.85vw,0.82rem)] font-mono text-[var(--dn-text-50)]">
          {finding.likely_cause}
        </p>
      ) : null}
      {finding.recommended_action ? (
        <Action>{finding.recommended_action}</Action>
      ) : null}
    </>
  );
}

function PanelBody({
  summary,
  variant,
}: {
  summary: ReliabilitySummary | null;
  variant: Variant;
}) {
  if (variant === "unavailable") {
    return (
      <Muted>
        Reliability data is currently unavailable for this camera.
      </Muted>
    );
  }
  if (variant === "unknown") {
    return (
      <Muted>
        Not enough recent processor or stream data to evaluate this camera yet.
      </Muted>
    );
  }
  if (variant === "healthy") {
    return <Muted>No active reliability findings for this camera.</Muted>;
  }

  // info / needs_review / critical — render the top finding. The summary
  // always carries one when status !== healthy/unknown; defensive null
  // check keeps the renderer safe if the api-server contract drifts.
  const top = summary?.top_findings[0];
  if (!top) {
    return <Muted>No active reliability findings for this camera.</Muted>;
  }
  return <FindingBody finding={top} variant={variant} />;
}

export function ReliabilityPanel({
  summary,
}: {
  summary: ReliabilitySummary | null;
}) {
  const variant = variantOf(summary);
  return (
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          reliability
        </p>
        <span className="inline-flex items-center gap-1.5">
          <StatusDot status={HEADER_DOT[variant]} />
          <span
            className="font-bold"
            style={{ color: HEADER_TEXT[variant] }}
          >
            {HEADER_LABEL[variant]}
          </span>
        </span>
      </div>
      <PanelBody summary={summary} variant={variant} />
    </div>
  );
}
