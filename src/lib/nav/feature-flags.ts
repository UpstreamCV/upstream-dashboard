// Nav feature flags — gate sidebar sections / pages whose backend doesn't exist
// yet, so the 6-section IA can ship incrementally without dead links or broken
// serverFetch calls.
//
// Same shape as src/lib/demo/demo-mode.ts: each flag is a NEXT_PUBLIC_* boolean
// inlined at build time, so it's valid in the client sidebar (which filters NAV)
// AND in RSC pages alike, and the gated code is dead-stripped from prod bundles
// by the `=== "1"` guard. All flags default OFF — a section whose backend hasn't
// landed is simply hidden from the rail (and its page can `notFound()` for safety).
//
// These are intentionally NOT added to src/lib/env.ts's zod schema (that schema is
// for REQUIRED vars); optional flags default to off/undefined — exactly like
// NEXT_PUBLIC_DEMO_MODE, which also lives outside the schema. Keep this module
// dependency-free.
//
// Status (2026-06): every flag is OFF. They light up as upstream-api-server ships
// the matching endpoint family — see docs/sitemap-reorg-plan.md "Backend asks".
//   issues       — unified account-wide issues/findings aggregation
//   destinations — webhook/Slack/email delivery + delivery-health
//   events       — account-wide events feed (stream/detail/payload)
//   webhooks     — outbound webhook config (endpoint/signing/delivery logs)
//   team         — account members CRUD
//   network      — network/diagnostics telemetry
export const FLAGS = {
  issues: process.env.NEXT_PUBLIC_FF_ISSUES === "1",
  destinations: process.env.NEXT_PUBLIC_FF_DESTINATIONS === "1",
  events: process.env.NEXT_PUBLIC_FF_EVENTS === "1",
  webhooks: process.env.NEXT_PUBLIC_FF_WEBHOOKS === "1",
  team: process.env.NEXT_PUBLIC_FF_TEAM === "1",
  network: process.env.NEXT_PUBLIC_FF_NETWORK === "1",
} as const;

export type FeatureFlag = keyof typeof FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FLAGS[flag];
}
