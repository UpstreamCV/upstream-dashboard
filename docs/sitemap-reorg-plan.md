# Site-map reorg plan — 6-section IA

**Branch:** `sitemap-redesign` · **Status:** Phases 0–3 implemented (2026-06-17); Phases 4–5 pending · **Authored:** 2026-06-17

> **Implemented (Phases 0–3, all buildable-now):** 6-section grouped sidebar + feature flags + `SectionTabs`;
> route-group moves (`(account)`/`(event-outputs)`/`(dev-settings)`, no redirects); Camera Command Center +
> per-camera Issues tab; Agent Detail + heartbeat timeline; Session Detail + diagnostics + session filters;
> Setup Checklist; Billing split (`/plan-usage` + `/billing`); Security Events audit facet; static `/event-schema`
> + `/api-docs`; account-wide read-only `/rules`; Alert Detail; read-only Workspace card. Verified: `tsc` clean,
> 644 tests pass, lint clean (one unrelated pre-existing demo error). **Pending:** Phase 4 (Issues aggregator,
> gated `FF_ISSUES`) and Phase 5 (gated stubs: Destinations, Events, Webhooks, Team, Network).

Reorganize `upstream-dashboard` from the current **flat 12-item sidebar** into the proposed
**6-section information architecture** — *Home · Issues · Cameras · Event Outputs · Dev Settings · Account* —
as a **full build-out** (every page in the site map), while keeping the **Home** and **Camera** pages as
close to their current implementation as possible.

> Grounded in the actual code (Next.js 16 App Router, `src/components/nav/sidebar-next.tsx` as the single
> nav source, `src/lib/api/*` data layer, `/dashboard-legacy` frozen fallback). A multi-agent analysis
> mapped each section + the migration mechanics; a completeness critic verified coverage and backend
> dependencies. Corrections from that review are already folded in (see **Corrections applied**).

---

## 1. Target sidebar (what the operator sees)

The **rail stays exactly 6 fixed, uniform pills** — the hover-expand icon-dock physics in `sidebar-next.tsx`
(module-scoped `railOpen` + per-route `getBoundingClientRect` pointer check + uniform `Slot` icons) is
**not touched**. Sub-areas render as a **secondary `SectionTabs` strip** (the proven `camera-tabs.tsx`
pattern), never as in-rail accordions (an accordion would introduce a second "open" state that fights the
dock and breaks the no-icon-reflow invariant).

```
Home            /                         (unchanged)
Issues          /issues                   (gated FF_ISSUES — off until aggregator ships)
Cameras         Cameras · Agents · Active Streams        ← SectionTabs strip
Event Outputs   Rules&Workflows · Alerts · Destinations · Events
Dev Settings    API Tokens · Event Schema · API Docs · (Webhooks, Network — gated)
Account         Plan & Usage · Billing · Audit Logs · Settings · (Team — gated)
```

The **Reliability layer is not a section** — it threads through every area exactly as specified: Home
(Fleet Overview / Needs Review), Issues (the work queue), Cameras (per-camera Reliability + Issues tabs),
Agents (heartbeat/version), Active Streams (session diagnostics), Event Outputs (delivery health — gated),
Dev Settings (webhook health — gated), Account (usage/billing/audit).

---

## 2. Route architecture — **route groups, zero redirects** (recommended)

Express the section grouping with **route groups** `(event-outputs)`, `(dev-settings)`, `(account)` under
`(app)`. Route groups **add no URL segment** (the repo already relies on this for `(dash)`/`(app)`), so:

- Existing URLs **stay put** → **no `next.config` redirects, no broken bookmarks, no double-hops.**
- Each group gets **one shared `layout.tsx`** that renders the section's `SectionTabs` strip (vs. 5
  duplicated layouts in the naive approach).
- Fully respects `AGENTS.md` route policy; nothing moves out of `(dash)/(app)`.

Folder moves are **into the group** (URL unchanged), e.g. `(app)/workflows/` → `(app)/(event-outputs)/workflows/`.

> **Alternative if nested URLs are explicitly wanted** (`/account/billing`, `/event-outputs/workflows`):
> use real prefix segments instead of route groups and add `next.config.ts` `redirects()` (302) for every
> moved root. More churn and more risk; only do this if the URL nesting matters to you. The default below
> assumes route groups.

### Full route map

Legend: **keep** = unchanged · **regroup** = folder moves into a route group, URL unchanged · **new** =
net-new route · **tab/filter** = not a route (a tab or query-param facet) · **gated** = stub behind an
off-by-default flag.

#### Home — `keep`
| Block | Route | Backing | Disposition |
|---|---|---|---|
| Fleet Overview | `/` | `getDashboardSummary` | keep (legend+KPI row already named this) |
| Needs Review | `/` | `getDashboardSummary` + `listAlerts` | keep (`TriagePanel` + "Needs Review" `KpiTile`) |
| Recent Events | `/` | `listAlerts` | keep (`RecentEvents`) |
| Usage Summary | `/` | `getUsageSummary` | keep ("Plan & Usage" tile + `UsageMeter`s) |
| Fleet Health | `/` | — | keep illustrative chart; **real time-series is backend-gated** |
| **Setup Checklist** | `/` | derived from cameras/agents/tokens counts already fetched | **new** (small, no backend) |

Home stays as-is. The **only** code touches: add a lightweight `setup-checklist.tsx` tile (derived from
already-fetched counts, hidden once complete), and — if you prefer no double-hop — repoint the single
`/billing` `actionHref` in `home-overview-client.tsx` to `/plan-usage`. (`/stream-sessions` and `/api-tokens`
hrefs stay valid since those URLs don't move.)

#### Cameras section — rail matches `/(cameras|agents|stream-sessions)`
| Page | Route | Backing | Disposition |
|---|---|---|---|
| Camera List | `/cameras` (+ `/cameras/new`) | `listCameras`, `listAgents` | keep |
| **Camera Command Center** | `/cameras/[id]/overview` (new `TABS[0]`; flip bare redirect `./monitor`→`./overview`) | reuse Monitor's fetches: `getCamera`/`getAgent`/`listStreamSessions`/reliability | **new** (compose existing panels) |
| Live Monitor | `/cameras/[id]/monitor` | (unchanged) | keep — **relabel tab only** |
| Configure | `/cameras/[id]/configure` (+ detection/geometry/rules) | (unchanged) | keep |
| Events | `/cameras/[id]/observations` | `listRecentObservations` | keep route — **relabel tab "Events"** |
| Reliability | `/cameras/[id]/reliability` | `reliability.ts` | keep |
| **Issues** (per-camera) | `/cameras/[id]/issues` | `getReliabilityFindings({cameraId, status:open})` | **new tab** (single camera, no fan-out) |
| Settings | `/cameras/[id]/settings` | (unchanged) | keep |
| Agent List | `/agents` | `listAgents` | keep |
| **Agent Detail** | `/agents/[agentId]` | `getAgent` + `listCameras({agentId})` | **new** |
| Heartbeats | section on Agent Detail | **`getAgentHeartbeats`** (thin wrapper over existing `GET /v1/agents/{id}/heartbeats`) | **new (buildable now)** |
| Version/Update Status | facet on Agent List/Detail | `agent.version` | tab/filter (rollout status backend-gated) |
| Stream Sessions | `/stream-sessions` | `listStreamSessions`, `listCameras`, `listAgents` | keep |
| Active Sessions / Session History | `/stream-sessions` (`state` filter) | `listStreamSessions({state})` | tab/filter |
| **Session Detail** | `/stream-sessions/[sessionId]` | list-and-find from `listStreamSessions` (+ `listValidations`) | **new** |
| **Stream Diagnostics** | Diagnostics section on Session Detail | `listValidations({sessionId})` | **new (section, not a route)** |

#### Event Outputs section — route group `(event-outputs)`, rail matches `/(workflows|rules|alerts|destinations|events)`
| Page | Route | Backing | Disposition |
|---|---|---|---|
| Workflows | `/workflows` (+ `/new`) | `listWorkflows`/`createWorkflow` | regroup (URL kept) |
| Run History | block/tabs on `/workflows` | `listWorkflowRuns` | tab/filter |
| **Rules** (account-wide) | `/rules` | `listRules({accountId})` read-only roll-up | **new** (editing stays at `/cameras/[id]/configure/rules`) |
| Alert Inbox | `/alerts` | `listAlerts` | regroup (URL kept) |
| Resolved Alerts | `/alerts` (`status=resolved`) | `listAlerts({status})` | tab/filter |
| **Alert Detail** | `/alerts/[alertId]` | hydrate from `listAlerts` (no `getAlert` exists) | **new** |
| Destinations (Webhooks/Slack/Email/Delivery Health) | `/destinations/*` | — | **gated** `FF_DESTINATIONS` |
| Events (Stream/Detail/Payload Viewer) | `/events`, `/events/[id]` | — | **gated** `FF_EVENTS` |

#### Dev Settings section — route group `(dev-settings)`, rail matches `/(api-tokens|event-schema|api-docs|webhooks)`
| Page | Route | Backing | Disposition |
|---|---|---|---|
| API Tokens — Token List | `/api-tokens` | `listTokens` | keep (relabel group "API Tokens") |
| New Token / Revoke Token | dialog / inline action on `/api-tokens` | `createTokenAction` / `revokeTokenAction` | tab/filter (existing UI, not routes) |
| **Event Schema** (Event Types, Payload Examples) | `/event-schema` | static, from `api-contracts.md` | **new (static, no backend)** |
| **API Docs** (Authentication, Endpoints, Code Examples) | `/api-docs` | static, from `api-contracts.md` | **new (static, no backend)** |
| Webhooks (Endpoint Config / Signing Secrets / Delivery Logs) | `/webhooks/*` | — | **gated** `FF_WEBHOOKS` |
| Network / Logs | hidden | — | **gated** `FF_NETWORK` |

#### Account section — route group `(account)`, rail matches `/(account|plan-usage|billing|settings|audit-logs|team)`
| Page | Route | Backing | Disposition |
|---|---|---|---|
| **Plan & Usage** (Current Plan, Usage Meters, Limits) | `/plan-usage` | `getUsageSummary`, `getAccountLimits` | **new page, relocated** from `/billing` sections |
| Billing (Subscription, Checkout, Customer Portal) | `/billing` | `getUsageSummary`, `billing.createCheckoutSession`/`createPortalSession` | regroup + slim (Stripe actions exist) |
| Audit Logs (Account History, Security Events) | `/audit-logs` | `listAuditLogs` | regroup (URL kept); Security Events = category filter |
| Settings (Workspace, Processing) | `/settings` | `getAccount` (read-only), `PATCH /v1/account/processing-config` | regroup (URL kept) |
| Team | hidden | — | **gated** `FF_TEAM` |

> `/billing` keeps working (now the Subscription page); the most-viewed plan/usage summary moves one click
> away to `/plan-usage`. Workspace **rename** needs a `PATCH /v1/account` the backend doesn't have yet →
> ship read-only display now. Processing Settings edit works today.

#### Issues section — top-level, **gated `FF_ISSUES`**
| Page | Route | Disposition |
|---|---|---|
| Issues queue root | `/issues` | **new** — synthesized aggregator (see Phase 4) |
| Open / Critical / Camera / Agent / Stream / Workflow | `/issues?status=…&source=…&severity=…` | tab/filter facets (not routes) |
| Resolved Issues | `/issues?status=resolved` | tab/filter |
| Delivery Issues | facet | gated with `FF_DESTINATIONS` |
| Suggested Fixes | `/issues?view=suggested` | advisory only (apply-a-fix is demo-only → gated) |

---

## 3. Mechanics

- **Sidebar** (`sidebar-next.tsx`): replace the flat `NAV` array with `NavSection[]`
  (`{ label, icon, href?, match, children?, flag? }`). Six sections, each a single Lucide icon in the
  existing `Slot`. **Widen each `match` regex** to cover its leaf prefixes (active-pill logic
  `item.match?.test(pathname)` is otherwise unchanged). **Do not touch** the `useEffect` / `railOpen` /
  `lastPointer` / `evaluate()` / `asideRef` / `data-open` / `.dn-rail-dock` block — keep the rail at
  exactly 6 + identity + footer so the dock width/height behavior is byte-identical.
- **Sub-nav**: new **additive** `src/components/dashboard-next/section-tabs.tsx` generalizing
  `camera-tabs.tsx` (same pill classes, `aria-current`, prefix-match active logic). **Do not modify
  `camera-tabs.tsx`'s exports/props** — `/dashboard-legacy` imports it.
- **Layouts**: one `layout.tsx` per route group renders `<SectionTabs/>` above `{children}`, mirroring
  `cameras/[cameraId]/layout.tsx`. `AppShell` and the `(dash)`/`(app)` groups are unchanged.
- **Gating**: new `src/lib/nav/feature-flags.ts` mirroring `src/lib/demo/demo-mode.ts` —
  `NEXT_PUBLIC_FF_*` booleans (`issues, destinations, events, webhooks, eventSchema, apiDocs, network, team`),
  all default **off**, build-time inlined (so valid in the client sidebar and RSC pages alike; not added to
  `env.ts`'s zod schema). Sidebar filters `NAV` + each section's `children` by flag; gated `page.tsx` files
  call `if (!FLAGS.x) notFound()` (defense in depth). A section whose every child is gated is itself hidden.
- **Breadcrumbs**: none today and none needed — section context = active rail pill + active `SectionTabs`
  tab; detail pages reuse the camera layout's back-`<Link>` (`<ChevronLeft/> Agents` etc.).
- **Tests**: add a `pathname → active-section` vitest (regex overlap guard).
- **Docs**: per commit/doc policy, every commit updates `docs/commit-log.md` + the `AGENTS.md` route policy +
  the `(dash)/README.md` route table **in the same commit**.

---

## 4. Phased delivery

| Phase | Delivers | Depends on |
|---|---|---|
| **0 — Foundations** (additive; no moves, no backend) | `feature-flags.ts`; `section-tabs.tsx` (new); `NavSection` type; doc stubs | — |
| **1 — Nav regroup + route groups** (Home & Camera intact) | Flat `NAV`→6 grouped sections (rail physics untouched, flag filtering); create `(event-outputs)`/`(dev-settings)`/`(account)` groups + shared layouts; move existing folders in (URLs unchanged → **no redirects**); camera tab **relabels** (Monitor→Live Monitor, Observations→Events); active-section test | Phase 0 |
| **2 — Composition-only new surfaces** (no new backend) | Command Center (`/cameras/[id]/overview`, new `TABS[0]`, flip bare redirect); per-camera Issues tab; Agent Detail + **heartbeat timeline** (`getAgentHeartbeats` wrapper); Session Detail + Diagnostics (list-and-find + `listValidations`); session Active/History filters; Setup Checklist tile; split `/billing`→`/plan-usage` + `/billing`; Security Events audit filter | Phase 1; correct import paths (see corrections) |
| **3 — Static-content surfaces** (no backend) | Shared `CodeBlock` (factor from token dialog); `/event-schema`; `/api-docs`; account-wide read-only `/rules` roll-up; read-only Workspace card; Alert Detail (`/alerts/[alertId]`) | Phase 1 |
| **4 — Issues aggregation** (synthesized, gated) | `src/lib/api/issues.ts` fan-out (`listAlerts` + stale-heartbeat agents + failed/expired sessions + failed/action-required workflow runs + per-camera `getReliabilityFindings` via `listCameras` fan-out) + normalizers + `IssuesQueue`/`IssueRow`/`IssueFacetTabs`; `/issues` behind `FF_ISSUES`; facets+status = client filters; Suggested Fixes = advisory only | Phases 1–2 |
| **5 — Backend-dependency stubs** (gated OFF, `notFound()`) | Destinations; Events; Dev Settings Webhooks; Team; Network/Logs — stub + reserved nav slot, **no deep UI**; each lights up when its endpoint family ships | Phase 0 flags |

---

## 5. Backend asks (upstream-api-server) — what unblocks the gated surfaces

1. **Account-scoped issues / findings aggregation** (`GET /v1/issues` or account-wide reliability findings)
   — removes the O(cameras) per-camera fan-out; unblocks Issues at scale.
2. **Fleet-health time-series** (hourly healthy/review/critical counts) — replaces the illustrative Home chart.
3. **Destinations & delivery** (webhook registration + signing secrets + delivery attempts/health) —
   unblocks Destinations, Dev Settings Webhooks, and the Delivery Issues facet.
4. **Account-wide events feed** (`GET /v1/events`, `GET /v1/events/{id}`) — unblocks Event Stream/Detail/Payload Viewer.
5. **Team/members CRUD** — unblocks Team.
6. **Network diagnostics** — unblocks Network/Logs.
7. **Remediation / apply-fix endpoint** — unblocks real Suggested Fixes (today it's demo-only).
8. **`PATCH /v1/account` (name/slug)** — unblocks Workspace Settings editing.
9. **Verify `current_user` authz on `GET /v1/stream-sessions/{id}`** (documented `current_agent`/owner-only) —
   if allowed, replace the Session Detail list-and-find with a direct `getStreamSession`.

---

## 6. Corrections applied (from the completeness review)

- **Two false "backend-missing" flags fixed → buildable now:** Agent **Heartbeats history**
  (`GET /v1/agents/{id}/heartbeats` *exists* — only a thin `getAgentHeartbeats` wrapper + `HeartbeatRecord`
  type are needed) and Session Detail (`GET /v1/stream-sessions/{id}` *exists*, but owner-only auth →
  use list-and-find as the safe path).
- **Component import paths corrected:** `SessionPanel`/`AgentPanel`/`CameraMetaPanel`/`ValidationPanel` are
  **named exports of `camera-panels.tsx`** (not separate files); `CameraControls`/`CameraPagination`/
  `CameraBucketStatTile` live under `cameras/`; `GeometryEditorPanel` under `geometry/`.
- **Route artifacts reconciled:** Active Sessions / Session History are **filters** on `/stream-sessions`
  (no `/streams/active`); Stream Diagnostics is a **section** of Session Detail (no `/streams/diagnostics`);
  Plan & Usage is a single page (`/plan-usage`). The route-group approach removes the invented `/streams/*`
  and `/account/*` moves entirely.
- **Keep-Home/Camera honestly scoped:** the only Home edit is the optional `/billing` `actionHref`; Command
  Center is the *minimal* change to the camera entry (new `overview` tab + redirect flip + the camera-tabs
  monitor-root special-case update) — acknowledged as slightly more than a pure relabel.
- **Confirmed real dependencies:** no `getAlert`; reliability findings are per-camera only; Suggested Fixes
  is demo-only; Workspace rename needs a new `PATCH`.

---

## 7. Top risks

1. **Hover-dock regression** — keep 6 fixed pills, never touch the `railOpen`/pointer block.
2. **`camera-tabs.tsx` is shared with `/dashboard-legacy`** — `SectionTabs` must be a *new* file; freeze
   camera-tabs' public API.
3. **Regex overlap** between section `match`es — keep leaf prefixes disjoint; cover by the active-section test.
4. **Backend-dependency leakage** — gated pages must `notFound()` so a direct URL never renders a broken fetch.
5. **Issues fan-out scale** — O(cameras) reliability calls; fine for small fleets, gate behind `FF_ISSUES`,
   push for the account-scoped endpoint (backend ask #1).
6. **Doc drift** — multi-file reorg must update commit-log + AGENTS.md route policy + README route table in
   the same commits.
