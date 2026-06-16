import { AlertTriangle, CreditCard, Gauge } from "lucide-react";
import { BillingActionsClient } from "@/components/dashboard-next/billing-actions-client";
import { UsageMeter } from "@/components/dashboard-next/usage-meter";
import { getActiveAccount } from "@/lib/account/active";
import { getUsageSummary } from "@/lib/api/usage";
import {
  USAGE_STATE_LABELS,
  billingStatusLabel,
  formatBillingDate,
  formatUsagePeriod,
  usageWarnings,
} from "@/lib/usage/usage-format";

// Module 7 M1 — billing/usage page. Plan + period + limits + reliable
// usage counters with near/at/over-limit banners. Server Component all the
// way down (read-only page; no client interactivity needed).
//
// Deliberately absent until later milestones:
// - Stripe checkout/portal (M2) — the CTA is an informational placeholder.
// - Processor/compute minutes — not tracked anywhere; never invented.
//
// Stream minutes are COMPLETED minutes (session_ended events): a session
// that is still running contributes nothing until it ends, so this can
// briefly undercount. The label says "completed" for exactly that reason.

const STATE_CHIP: Record<string, string> = {
  ok: "bg-white/[0.05] text-white/60",
  near_limit: "bg-[#8a6d1f]/15 text-[#8a6d1f]",
  at_limit: "bg-red-700/10 text-red-700",
  over_limit: "bg-red-700/15 text-red-700",
};

function StateChip({ state }: { state: string }) {
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide " +
        (STATE_CHIP[state] ?? STATE_CHIP.ok)
      }
    >
      {USAGE_STATE_LABELS[state as keyof typeof USAGE_STATE_LABELS] ?? state}
    </span>
  );
}

function CountCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
      <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-white">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-xs text-[var(--dn-text-50)]">{hint}</p>
    </div>
  );
}

export default async function BillingPage() {
  const { activeAccountId, activeAccount } = await getActiveAccount();
  const summary = await getUsageSummary({ accountId: activeAccountId });
  const warnings = usageWarnings(summary);
  const canEdit =
    activeAccount.role === "owner" || activeAccount.role === "admin";
  const billing = summary.billing;

  return (
    <div className="space-y-4 md:space-y-6 p-[clamp(1rem,2vw,1.75rem)]">
      <div>
        <h1 className="text-[clamp(1.3rem,2vw,1.8rem)] font-bold text-white">
          Billing &amp; Usage
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
          plan
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <span className="text-[clamp(1.6rem,3.5vw,2.4rem)] font-bold leading-none capitalize text-white">
            {summary.plan.label}
          </span>
          <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white/60">
            {summary.plan.status}
          </span>
          {billing.configured && billing.status !== "none" ? (
            <span
              className={
                "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide " +
                (billing.status === "past_due"
                  ? "bg-red-700/10 text-red-700"
                  : billing.status === "canceled"
                    ? "bg-white/[0.05] text-white/60"
                    : "bg-[var(--dn-creek-mid)]/15 text-[var(--dn-creek-deep)]")
              }
            >
              {billingStatusLabel(billing.status)}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-[var(--dn-text-50)]">
          Usage period: {formatUsagePeriod(summary.period)} (UTC calendar month)
          {billing.current_period_end &&
          (billing.status === "active" || billing.status === "trialing") &&
          !billing.cancel_at_period_end
            ? ` · renews ${formatBillingDate(billing.current_period_end)}`
            : ""}
        </p>
        <BillingActionsClient billing={billing} canEdit={canEdit} />
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
          Stream minutes count completed sessions this period — a session
          that is still running is added when it ends. When the quota is
          reached, new streaming sessions are blocked until the period
          resets. Allowed stream types:{" "}
          {summary.limits.allowed_stream_types.join(", ")}.
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
