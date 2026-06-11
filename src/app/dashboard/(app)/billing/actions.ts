"use server";

// Server Actions for Stripe Checkout / Customer Portal (Module 7 M2).
// Both return the Stripe-hosted URL; the client component navigates to it
// (an external redirect from an action would lose the error path).

import { getActiveAccount } from "@/lib/account/active";
import { createCheckoutSession, createPortalSession } from "@/lib/api/billing";
import { UpstreamApiError, friendlyMessage } from "@/lib/api/errors";

export type BillingRedirectResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

export async function startCheckoutAction(
  plan: "starter" | "pro",
): Promise<BillingRedirectResult> {
  const { activeAccountId } = await getActiveAccount();
  try {
    const { url } = await createCheckoutSession({
      accountId: activeAccountId,
      plan,
    });
    return { ok: true, url };
  } catch (err) {
    if (err instanceof UpstreamApiError) {
      return { ok: false, message: friendlyMessage(err) };
    }
    return { ok: false, message: "Could not start checkout. Try again." };
  }
}

export async function openBillingPortalAction(): Promise<BillingRedirectResult> {
  const { activeAccountId } = await getActiveAccount();
  try {
    const { url } = await createPortalSession({ accountId: activeAccountId });
    return { ok: true, url };
  } catch (err) {
    if (err instanceof UpstreamApiError) {
      return { ok: false, message: friendlyMessage(err) };
    }
    return { ok: false, message: "Could not open the billing portal. Try again." };
  }
}
