"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowUpRight, ExternalLink } from "lucide-react";
import {
  openBillingPortalAction,
  startCheckoutAction,
} from "@/app/(dash)/(app)/(account)/billing/actions";
import type { UsageSummary } from "@/lib/api/types";
import { formatBillingDate } from "@/lib/usage/usage-format";

// Module 7 M2 — the only interactive part of the billing page. Buttons
// fetch a Stripe-HOSTED URL via Server Action and navigate the browser to
// it; nothing payment-shaped renders here.

const PRIMARY_BTN =
  "inline-flex items-center gap-1.5 rounded-full bg-[var(--dn-creek-mid)] px-3 py-1.5 text-sm font-bold text-white transition hover:bg-[var(--dn-creek-deep)] disabled:cursor-not-allowed disabled:opacity-50";
const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-sm font-bold text-white/80 transition hover:border-[var(--dn-creek-mid)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50";

interface BillingActionsClientProps {
  billing: UsageSummary["billing"];
  canEdit: boolean;
}

export function BillingActionsClient({
  billing,
  canEdit,
}: BillingActionsClientProps) {
  const [pending, startTransition] = useTransition();

  function go(action: () => Promise<{ ok: true; url: string } | { ok: false; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        window.location.assign(result.url);
      } else {
        toast.error(result.message);
      }
    });
  }

  if (!billing.configured) {
    return (
      <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-[var(--dn-text-50)]">
        Billing management coming soon. Plan changes are handled by the
        Upstream team for now — contact support to adjust limits.
      </p>
    );
  }

  const subscribed =
    billing.status === "active" || billing.status === "trialing";

  return (
    <div className="mt-3 space-y-3">
      {billing.status === "past_due" ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-700/30 bg-red-700/10 p-3 text-sm font-bold text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            There is a problem with your last payment. Open Manage Billing to
            update your payment method — your plan may be downgraded if
            payment keeps failing.
          </span>
        </div>
      ) : null}
      {billing.cancel_at_period_end && billing.current_period_end ? (
        <div className="flex items-start gap-2 rounded-xl border border-[#8a6d1f]/30 bg-[#8a6d1f]/10 p-3 text-sm font-bold text-[#8a6d1f]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Your subscription is set to cancel on{" "}
            {formatBillingDate(billing.current_period_end)}. You keep your
            current plan and limits until then.
          </span>
        </div>
      ) : null}

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          {!subscribed ? (
            <>
              <button
                type="button"
                onClick={() => go(() => startCheckoutAction("starter"))}
                className={PRIMARY_BTN}
                disabled={pending}
              >
                <ArrowUpRight className="h-4 w-4" aria-hidden />
                Upgrade to Starter
              </button>
              <button
                type="button"
                onClick={() => go(() => startCheckoutAction("pro"))}
                className={PRIMARY_BTN}
                disabled={pending}
              >
                <ArrowUpRight className="h-4 w-4" aria-hidden />
                Upgrade to Pro
              </button>
            </>
          ) : null}
          {billing.management_available ? (
            <button
              type="button"
              onClick={() => go(openBillingPortalAction)}
              className={subscribed ? PRIMARY_BTN : GHOST_BTN}
              disabled={pending}
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Manage Billing
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--dn-text-50)]">
          An owner or admin can manage the plan and billing.
        </p>
      )}
      <p className="text-xs text-[var(--dn-text-50)]">
        Payments are handled by Stripe on Stripe-hosted pages — Upstream
        never sees your card details.
      </p>
    </div>
  );
}
