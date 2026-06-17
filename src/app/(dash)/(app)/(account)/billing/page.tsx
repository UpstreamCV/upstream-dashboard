import { CreditCard } from "lucide-react";
import Link from "next/link";
import { BillingActionsClient } from "@/components/dashboard-next/billing-actions-client";
import { getActiveAccount } from "@/lib/account/active";
import { getUsageSummary } from "@/lib/api/usage";
import {
  billingStatusLabel,
  formatBillingDate,
  formatUsagePeriod,
} from "@/lib/usage/usage-format";

// Billing — subscription + payment management (the subscription half of the
// former "Billing & Usage" page; metered limits + activity counters moved to
// the sibling /plan-usage page). Stripe checkout / customer portal run through
// BillingActionsClient. Server Component (the only interactivity is the client
// action buttons).
export default async function BillingPage() {
  const { activeAccountId, activeAccount } = await getActiveAccount();
  const summary = await getUsageSummary({ accountId: activeAccountId });
  const canEdit =
    activeAccount.role === "owner" || activeAccount.role === "admin";
  const billing = summary.billing;

  return (
    <div className="space-y-4 md:space-y-6 p-[clamp(1rem,2vw,1.75rem)]">
      <div>
        <h1 className="text-[clamp(1.3rem,2vw,1.8rem)] font-bold text-white">
          Billing
        </h1>
        <p className="mt-1 text-sm text-[var(--dn-text-50)]">
          Manage your subscription and payment method. See{" "}
          <Link
            href="/plan-usage"
            className="font-bold text-white hover:underline underline-offset-2"
          >
            Plan &amp; Usage
          </Link>{" "}
          for limits and current-period usage.
        </p>
      </div>

      <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
        <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          <CreditCard className="h-4 w-4" aria-hidden />
          subscription
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
    </div>
  );
}
