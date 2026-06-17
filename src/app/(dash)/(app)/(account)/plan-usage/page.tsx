import { AlertTriangle, CreditCard, Gauge } from "lucide-react";
import Link from "next/link";
import { StateChip, CountCard } from "@/components/dashboard-next/usage-cards";
import { UsageMeter } from "@/components/dashboard-next/usage-meter";
import { getActiveAccount } from "@/lib/account/active";
import { getUsageSummary } from "@/lib/api/usage";
import {
  formatUsagePeriod,
  usageWarnings,
} from "@/lib/usage/usage-format";

// Plan & Usage — the usage-facing half of the former Billing page: current
// plan, near/at/over-limit banners, metered limits, and activity counters for
// the period. Subscription management (Stripe checkout / customer portal) lives
// on the sibling Billing page. Server Component all the way down.
//
// Stream minutes are COMPLETED minutes (session_ended events): a still-running
// session contributes nothing until it ends, so this can briefly undercount.
export default async function PlanUsagePage() {
  const { activeAccountId } = await getActiveAccount();
  const summary = await getUsageSummary({ accountId: activeAccountId });
  const warnings = usageWarnings(summary);

  return (
    <div className="space-y-4 md:space-y-6 p-[clamp(1rem,2vw,1.75rem)]">
      <div>
        <h1 className="text-[clamp(1.3rem,2vw,1.8rem)] font-bold text-white">
          Plan &amp; Usage
        </h1>
        <p className="mt-1 text-sm text-[var(--dn-text-50)]">
          Your plan, limits, and usage for the current period.
        </p>
      </div>

      {warnings.map((warning) => (
        <div
          key={warning.metric}
          className={
            "flex items-start gap-2 rounded-xl border p-3 text-sm font-bold " +
            (warning.state === "near_limit"
              ? "border-[#8a6d1f]/30 bg-[#8a6d1f]/10 text-[#8a6d1f]"
              : "border-red-700/30 bg-red-700/10 text-red-700")
          }
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{warning.message}</span>
        </div>
      ))}

      <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
        <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          <CreditCard className="h-4 w-4" aria-hidden />
          current plan
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <span className="text-[clamp(1.6rem,3.5vw,2.4rem)] font-bold leading-none capitalize text-white">
            {summary.plan.label}
          </span>
          <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white/60">
            {summary.plan.status}
          </span>
        </div>
        <p className="mt-2 text-sm text-[var(--dn-text-50)]">
          Usage period: {formatUsagePeriod(summary.period)} (UTC calendar month).{" "}
          <Link
            href="/billing"
            className="font-bold text-white hover:underline underline-offset-2"
          >
            Manage subscription
          </Link>
        </p>
      </section>

      <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
        <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          <Gauge className="h-4 w-4" aria-hidden />
          metered limits
        </p>
        <div className="mt-3 grid gap-5 sm:grid-cols-3">
          <div className="space-y-1.5">
            <UsageMeter
              label="Cameras"
              value={summary.usage.cameras}
              max={summary.limits.max_cameras}
            />
            <StateChip state={summary.states.cameras} />
          </div>
          <div className="space-y-1.5">
            <UsageMeter
              label="Active streams"
              value={summary.usage.active_streams}
              max={summary.limits.max_concurrent_sessions}
            />
            <StateChip state={summary.states.active_streams} />
          </div>
          <div className="space-y-1.5">
            <UsageMeter
              label="Stream minutes (completed)"
              value={summary.usage.stream_minutes}
              max={summary.limits.monthly_minutes_quota}
              unit="min"
            />
            <StateChip state={summary.states.stream_minutes} />
          </div>
        </div>
        <p className="mt-3 text-xs text-[var(--dn-text-50)]">
          Stream minutes count completed sessions this period — a session that is
          still running is added when it ends. When the quota is reached, new
          streaming sessions are blocked until the period resets. Allowed stream
          types: {summary.limits.allowed_stream_types.join(", ")}.
        </p>
      </section>

      <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
        <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          activity this period
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CountCard
            label="workflow runs"
            value={summary.usage.workflow_runs}
            hint="Started this period"
          />
          <CountCard
            label="alerts"
            value={summary.usage.alerts}
            hint="Created this period"
          />
          <CountCard
            label="rules"
            value={summary.usage.rules}
            hint="Configured (all time)"
          />
          <CountCard
            label="workflows"
            value={summary.usage.workflows}
            hint="Configured (all time)"
          />
        </div>
      </section>
    </div>
  );
}
