import { ReliabilityConfidenceTrendCard } from "@/components/dashboard-next/reliability-confidence-trend-card";
import { ReliabilityFindingCard } from "@/components/dashboard-next/reliability-finding-card";
import { ReliabilitySummaryCard } from "@/components/dashboard-next/reliability-summary-card";
import { getActiveAccount } from "@/lib/account/active";
import {
  getReliabilityConfidenceTrend,
  getReliabilityFindings,
  getReliabilitySummary,
} from "@/lib/api/reliability";
import type { ReliabilityFinding } from "@/lib/api/types";

// Reliability tab v1 (M4). Composes:
//
//   - Summary card  -> overall verdict + roll-up + recommended next action
//   - Processing-disabled hint -> visible when processing master switch is
//     off AND recently-resolved rows reflect that. Prevents the "why is
//     everything Healthy?" confusion right after flipping the toggle.
//   - Open findings -> one detail card per open finding, with per-type
//     formatted evidence
//   - Resolved findings -> small history list (last few; recency-first)
//
// Everything degrades gracefully -- summary 404 -> null -> "Unavailable"
// state; findings 404 -> [] -> empty section. No section is required.

const RESOLVED_LIMIT = 5;

export default async function CameraReliabilityPage({
  params,
}: {
  params: Promise<{ cameraId: string }>;
}) {
  const { cameraId } = await params;
  const { activeAccountId } = await getActiveAccount();

  const [summary, openFindings, resolvedFindings, confidenceTrend] =
    await Promise.all([
      getReliabilitySummary({ accountId: activeAccountId, cameraId }),
      getReliabilityFindings({ accountId: activeAccountId, cameraId, status: "open" }),
      getReliabilityFindings({
        accountId: activeAccountId,
        cameraId,
        status: "resolved",
        limit: RESOLVED_LIMIT,
      }),
      // M7: resilient (returns null on any error) so a trend failure can never
      // reject this Promise.all and blank the whole Reliability tab.
      getReliabilityConfidenceTrend({
        accountId: activeAccountId,
        cameraId,
        range: "24h",
      }),
    ]);

  const processingDisabled = wasJustDisabled(summary, resolvedFindings);

  return (
    <div className="space-y-4 md:space-y-6 p-[clamp(0.5rem,1vw,1rem)]">
      <header>
        <h1 className="text-[clamp(1.3rem,2vw,1.8rem)] font-bold text-black">
          Reliability
        </h1>
        <p className="mt-1 text-sm text-[var(--dn-text-50)]">
          Camera reliability status and production CV warnings.
        </p>
      </header>

      <ReliabilitySummaryCard summary={summary} />

      <ReliabilityConfidenceTrendCard trend={confidenceTrend} />

      {processingDisabled ? <ProcessingDisabledHint /> : null}

      {openFindings.length > 0 ? (
        <section className="space-y-3 md:space-y-4">
          <SectionHeader
            title="Open findings"
            subtitle={`${openFindings.length} active`}
          />
          {openFindings.map((f) => (
            <ReliabilityFindingCard key={f.id} finding={f} variant="open" />
          ))}
        </section>
      ) : null}

      {resolvedFindings.length > 0 ? (
        <section className="space-y-3 md:space-y-4">
          <SectionHeader
            title="Recently resolved"
            subtitle={`last ${resolvedFindings.length}`}
          />
          {resolvedFindings.map((f) => (
            <ReliabilityFindingCard key={f.id} finding={f} variant="resolved" />
          ))}
        </section>
      ) : null}
    </div>
  );
}

// "Processing was just disabled" inference: summary status is healthy AND
// recently-resolved rows include the processing_disabled_for_account reason.
// Without this, an operator who flips the master switch off sees a green
// Healthy verdict and might think everything is genuinely fine -- this
// banner tells them it's resolved because processing paused, not because
// the issues went away.
function wasJustDisabled(
  summary: import("@/lib/api/types").ReliabilitySummary | null,
  resolved: ReliabilityFinding[],
): boolean {
  if (summary === null) return false;
  if (summary.status !== "healthy") return false;
  return resolved.some((f) => f.resolved_reason === "processing_disabled_for_account");
}

function ProcessingDisabledHint() {
  return (
    <section className="dn-tile border-l-4 border-l-[#8a6d1f] p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        processing paused
      </p>
      <p className="mt-2 text-[clamp(0.85rem,1vw,0.95rem)] text-black">
        Processing is disabled for this account. Processor-dependent findings
        will stay resolved until processing is re-enabled.
      </p>
    </section>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-bold text-[clamp(1rem,1.2vw,1.15rem)] text-black">
        {title}
      </h2>
      {subtitle ? (
        <span className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          {subtitle}
        </span>
      ) : null}
    </div>
  );
}
