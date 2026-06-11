# commit-log

Reverse-chronological summary of every meaningful commit. Newest first. See the template at the bottom for the entry format.

---

## 2026-06-10 — Per-object line crossing: line-rule conditions + new observation labels

**Subject:** Expose object-class / require-tracked / min-confidence condition inputs on line-crossing rules, and label the new `processor.line_crossing_object` observation type across the dashboard.

**Why:** The processor's "Per-Object Line Crossing Producer" side task emits per-object crossing evidence alongside the unchanged aggregate counts, and the api-server now accepts the three per-object conditions on line_crossing rules (matching only per-object events — plain line rules keep aggregate behavior, no double-fire). The rule form mirrors that availability; direction inputs remain absent (still deferred — only direction-rule names exist, not a_to_b).

**What changed:** `src/lib/rules/rule-config-schema.ts` (line_crossing joins CLASS_FILTER/CONFIDENCE sets + allowed keys — the existing conditions UI lights up for line rules with no panel changes needed), `src/lib/api/types.ts` + `src/lib/perception/summarize-observation.ts` (new observation type in the filter list + "entry-line — person crossed (track 7)" summary), `src/lib/workflows/workflow-run-format.ts` ("Line crossing (object)" trigger label).

**Testing/checks:** `npm run test` (530, +schema/label/summary cases), `npx tsc --noEmit`, production build all pass. Only lint error remains the pre-existing demo-mode one.

## 2026-06-10 — Payload-enrichment unlock: confidence + count-class rule inputs

**Subject:** Add the two rule conditions unlocked by the processor's payload-enrichment side task — a "Min confidence" input on zone/dwell rules and a "Count class" selector on ROI occupancy rules.

**Why:** The processor now stamps per-object `confidence` onto zone/dwell observations and populates object-attributed `class_counts` on ROI occupancy; the api-server accepts `min_confidence` (zone_entered/dwell_exceeded) and `object_class` (roi_occupancy) in rule config. The form mirrors availability exactly — line-crossing rules still show neither (cumulative counters have no per-object attribution; deferred honestly).

**What changed:** `src/lib/rules/rule-config-schema.ts` (validator keys + value checks in lock-step with the server; `CONFIDENCE_FILTER_RULE_TYPES`; `ruleConditionsLabel` renders "conf ≥ 70%"; `ruleTargetLabel` scopes count bounds to the class — "2–5 person"), `src/components/dashboard-next/rules/rules-panel.tsx` (Min confidence number input beside the tracked-object checkbox; Count class select fed by the camera's model classes with free-text fallback; state resets on type switch and after create).

**Testing/checks:** `npm run test` (528, +14 schema/label cases), `npx tsc --noEmit`, production build all pass. Only lint error remains the pre-existing demo-mode one.

## 2026-06-10 — Workflow Engine M3: richer rule conditions in the rule editor

**Subject:** Extend the camera rule form with M3 conditions — object-class filter chips, a require-tracked-object checkbox, min/max occupancy bounds, and a time-window schedule section — without raw JSON and without a visual builder.

**Why:** Workflow Engine M3 makes one-step rules more expressive. The api-server only accepts a condition on rule types whose production observation payloads can prove it (class/track → zone & dwell; count bounds → ROI occupancy; schedule → all types, evaluated inline from the observation time). The form mirrors that exactly so users can't author never-matching rules; min_confidence and line-crossing direction are deferred pending processor payload changes and deliberately absent from the UI.

**What changed:**
- `src/lib/rules/rule-config-schema.ts` — validator extended in lock-step with the server (object_classes 1–20 unique, require_track_id boolean, max ≥ min, schedule HH:MM/distinct-times/IANA-timezone/day-key checks, per-type key restriction incl. rejecting deferred keys); new `ruleConditionsLabel` and `ruleScheduleLabel` (consecutive days collapse to "Mon–Fri"; malformed schedules degrade to "scheduled", never throw); `CLASS_FILTER_RULE_TYPES`, `SCHEDULE_DAYS` exports.
- `src/components/dashboard-next/rules/rules-panel.tsx` — "Conditions" section for zone/dwell rules: class chips fed by the camera's detection model (free-text comma fallback when no model is configured), require-tracked checkbox; "Max objects" input beside min for ROI occupancy; "Only during a time window" section (day chips defaulting Mon–Fri, time inputs, IANA timezone prefilled from the browser, overnight-wrap hint). Rule rows now render conditions + schedule summaries. Class/track state clears when switching to a type that can't prove them.
- `src/app/dashboard/(app)/cameras/[cameraId]/configure/rules/page.tsx` — fetches `listModels` + `getCameraProcessingConfig` (best-effort) to derive class options: selected_classes when set, else the active model's supported classes.

**Docs updated:** docs/commit-log.md. Contract source: `../upstream-api-server/docs/api-contracts.md` "Workflow Engine M3".

**Testing/checks:** `npm run test` (514, +35 schema/label cases), `npx tsc --noEmit`, production `next build` all pass. The only lint error is the pre-existing demo-mode one.

## 2026-06-10 — Workflow Engine M2: workflow history page + run-aware rules/alerts

**Subject:** Add the `/dashboard/workflows` history page and surface workflow runs across the rules page and alert inbox — the dashboard half of Workflow Engine M2 (Workflow Runs + Internal Event History). This is a Workflow Engine milestone, not a reliability milestone and not an alerts feature.

**Why:** Upstream's long-term shape is a camera workflow engine, not an alerts product. M1 (the rules + alerts slice, retroactively "Workflow Engine M1") made rule matches send alerts; M2's api-server records every match as a `workflow_run` — including cooldown-suppressed matches that send no alert — with evidence and action outcome. The dashboard needs to show that system of record: what fired, on which camera, what observation caused it, what evidence was captured, and whether an alert was created or suppressed.

**What changed:**
- `src/app/dashboard/(app)/workflows/page.tsx` + `src/components/dashboard-next/workflows/workflow-runs-client.tsx` — account-wide history: All/Completed/Suppressed tabs (server-side status filter), 10s polling via `useUpstreamList`, status/trigger chips, camera + related-alert links, and a per-row `<details>` expand with the evidence payload, rule snapshot, and run ids (observations-panel pattern; no separate detail route needed).
- `src/app/dashboard/(app)/cameras/[cameraId]/configure/rules/page.tsx` — server-rendered "Recent workflow runs" panel under the rule editor (last 8 runs for the camera, fetched in the existing `Promise.all`), making visible that rules are workflow executions, not just alert senders.
- `src/components/dashboard-next/alerts/alerts-inbox-client.tsx` — alert rows with a `workflow_run_id` link back to the workflows page.
- `src/lib/api/workflow-runs.ts` — `listWorkflowRuns`/`getWorkflowRun` serverFetch wrappers; `src/lib/api/types.ts` — `WorkflowRun`/`WorkflowRunAlertRef` types (open-vocabulary-tolerant reads) + `Alert.workflow_run_id`.
- `src/lib/workflows/workflow-run-format.ts` — pure status/action-result/trigger label + chip helpers; unknown values echo through so a newer api-server can never blank the page.
- `src/components/nav/sidebar-next.tsx` — "Workflows" nav entry (above Alerts).

**Docs updated:** docs/commit-log.md. Contract source: `../upstream-api-server/docs/api-contracts.md` "Endpoints — Workflow Engine M2".

**Testing/checks:** `npm run test` (479, includes new `workflow-run-format.test.ts`), `npx tsc --noEmit`, and a production `next build` (`/dashboard/workflows` compiles) all pass. The only lint error is the pre-existing demo-mode one. Demo-mode fixtures for `/v1/workflow-runs` not included — live-data only, same as the M1 rules/alerts pages. Deferred by design: multi-step sequencing UI, visual workflow builder, delivery channels, run review actions.

## 2026-06-10 — Rules/Triggers M1: per-camera rule editor + account alert inbox

**Subject:** Wire the configure tab's "Triggers & Effects" placeholder to a real rule editor and add the `/dashboard/alerts` inbox, completing the dashboard half of Rules/Triggers M1 (the first milestone of the Rules/Triggers + Alerts product track — separate numbering from the reliability milestones).

**Why:** The api-server now has `/v1/rules` (per-camera rules over processor observations: line crossing, ROI occupancy, zone entered, dwell exceeded) and `/v1/alerts` (the alerts matched rules raise, evaluated inline on observation ingest). This is the demo-closing UI: a user draws geometry, creates a rule on it, and sees the alert land in the inbox.

**What changed:**
- `src/app/dashboard/(app)/cameras/[cameraId]/configure/rules/` — rules page + Server Actions (`createRuleAction`, `setRuleEnabledAction`, `deleteRuleAction`; owner/admin gated, viewers read-only, defense-in-depth `validateRuleConfig` re-run server-side, mirroring the geometry action precedent). The page fetches rules + saved geometry concurrently so the editor's line/zone pickers offer drawn shapes by label instead of free-typed ids.
- `src/components/dashboard-next/rules/rules-panel.tsx` — create form (type → target picker swaps line/ROI, per-type threshold inputs, severity, cooldown presets) + rule rows (severity chip, target summary via `ruleTargetLabel`, enable/disable toggle, delete).
- `src/app/dashboard/(app)/alerts/` — inbox page + actions; `src/components/dashboard-next/alerts/alerts-inbox-client.tsx` polls `/v1/alerts?status=…` at the standard 10s via `useUpstreamList`, open/resolved tabs, unread accent + "new" chip, mark-read (any member) and resolve (owner/admin) with `mutate()` after each action.
- `src/lib/api/rules.ts`, `src/lib/api/alerts.ts` — serverFetch wrappers; `src/lib/api/types.ts` — `Rule`/`Alert` types (`rule_type`/read fields tolerate open vocabulary).
- `src/lib/rules/rule-config-schema.ts` — pure shared module mirroring the server's `validate_rule_config`, plus type labels/descriptions and the target-key/target-kind maps the editor drives off.
- `src/app/dashboard/(app)/cameras/[cameraId]/configure/page.tsx` — Triggers & Effects card now navigates; `src/components/nav/sidebar-next.tsx` — Alerts nav entry wired to `/dashboard/alerts`.

**Docs updated:** docs/commit-log.md. Contract source: `../upstream-api-server/docs/api-contracts.md` "Endpoints — Rules/Triggers M1".

**Testing/checks:** `npm run test` (463, includes new `rule-config-schema.test.ts`), `npx tsc --noEmit`, and a production `next build` (both new routes compile) all pass. The only lint error is the pre-existing demo-mode one (`src/lib/demo/add-camera-panel.tsx`). Demo-mode fixtures for `/v1/rules` and `/v1/alerts` are not included — the new pages are live-data only for now.

## 2026-06-10 — Camera management: create/edit forms (web-configured cameras)

**Subject:** Add dashboard camera create/edit so cameras are configured on the web and claimed by agents.

**Why:** The agent smart flow makes the server the source of truth for stream config. That needs a way to author cameras from the dashboard: api-server now exposes `POST /v1/cameras` (creates unassigned, `agent_id = null`), `PATCH /v1/cameras/{id}`, and an agent claim flow; this commit is the UI half.

**What changed:**
- `src/app/dashboard/(app)/cameras/new/` — New-camera page + `createCameraAction` Server Action (owner/admin gated server-side, mirroring api-tokens). Normalizes the source field to the agent's `device_path` convention (`webcam:0` / `rtsp:<url>`).
- `src/app/dashboard/(app)/cameras/[cameraId]/settings/` — settings tab gains the edit form (`updateCameraAction`, partial PATCH; api-server re-validates the merged config against limits).
- `src/components/dashboard-next/camera-form-next.tsx` — shared create/edit form; account caps from `getAccountLimits()` render inline as input maxima and `limit_exceeded.*` server rejections surface verbatim. UX only — the api-server is the security boundary.
- `src/app/dashboard/(app)/cameras/page.tsx` — "New camera" header button.
- `src/lib/api/types.ts` — `Camera.source_type`, `Camera.agent_id` nullable (web-created cameras are unassigned until claimed), `AccountLimits.allowed_stream_types`.
- Null-`agent_id` handling at every consumer: monitor page + legacy camera detail skip the `getAgent` fetch, grids/tables render "unassigned", settings identifiers row shows "unassigned". Demo fixtures gain the new fields.

**Docs updated:** docs/commit-log.md.

## 2026-06-09 — Reliability (M11): "Config Comparison" report card

**Subject:** Add a descriptive before/after config comparison section to the camera Reliability tab, fed by the new api-server `GET .../reliability/config-comparison-summary` endpoint: baseline vs candidate group panels (label + avg conf / low-conf ratio / samples), a neutral status chip (comparable / mixed metrics / inconclusive / no data), the backend's factual summary and bullets, comparability notes, and standing caveats, with the usual 24h | 7d toggle.

**Why:** M9/M9.1 made reliability config-aware and M10/M10.1 showed per-config series; M11 closes the loop with a report card that states what changed between the latest and previous applied configs. Deliberately NOT a recommender: no "better/worse/best/recommended/caused" anywhere (a test pins this, distinguishing denials like "not … a recommendation" from claims), no GPU/inference claims (the FPS caveat explicitly denies them), and population-change honesty front-and-center (threshold/class changes → "mixed metrics" + notes).

**What changed (dashboard only):** `src/lib/api/types.ts` (ConfigComparison* types), `src/lib/api/reliability.ts` (`getReliabilityConfigComparisonSummary`, resilient null-on-error, optional baseline/candidate/min_samples params sent only when set), `src/components/dashboard-next/reliability-config-comparison-card.tsx` (the card), reliability page (fetch both ranges in the existing `Promise.all`; rendered below Reliability by Config, hidden in demo mode). Tests: client suite + 8-case card suite. `npx tsc --noEmit` + `npm run test` (440) pass; the only lint error is the pre-existing demo-mode one.

---

## 2026-06-09 — Reliability (M10.1): show applied processing FPS in Reliability by Config

**Subject:** Group labels gain an FPS segment ("All classes · confidence 0.10 · 5 FPS"; null → "default FPS"), an "output cadence only" badge appears when a group carries `processing_fps_output_cadence_only`, and the by-config types/client pick up the M9.1 `requested_processing_fps` / `applied_processing_fps` fields plus the optional `applied_processing_fps` filter param.

**Why:** M7E applies `processing_fps` as perception-snapshot output cadence and M9.1 (api-server) made it a first-class reliability dimension; the cards should label it. Honesty preserved: the cadence badge tooltip states it does NOT reduce GPU/inference work; the honesty test now pins "no GPU/inference-throttling claims" explicitly (the old fps regex would false-positive against the legitimate "5 FPS" label adjacent to status text).

**What changed:** `src/lib/api/types.ts` (+2 nullable fields), `src/lib/api/reliability.ts` (`appliedProcessingFps` filter param, sent only when set), `src/lib/perception/config-group-label.ts` (FPS label segment, `FPS_OUTPUT_CADENCE_WARNING`, `hasOutputCadenceCaveat`, key includes fps), `src/components/dashboard-next/reliability-by-config-card.tsx` (cadence badge). Tests updated/added; `npx tsc --noEmit` + `npm run test` (429) pass. The only lint error is the pre-existing demo-mode one.

---

## 2026-06-09 — Reliability (M10): "Reliability by Config" section from the M9 by-config API

**Subject:** Add a config-aware reliability section to the camera Reliability tab: one card per applied processing-config group (readable label, status, caveat badge, mini sparkline, headline stats) from the new M9 `GET /v1/cameras/{id}/reliability/confidence-trend/by-config` endpoint, with client-side Classes/Status filters derived from the returned groups.

**Why:** M9 (api-server) made reliability metrics config-aware — rollups now preserve applied-processing-config dimensions and a by-config trend read exists — but the dashboard had no surface for it. M10 makes "did config r4 do better than r3?" answerable from the Reliability tab without replacing the existing camera-level trend chart. Honesty held throughout: confidence threshold and selected classes are applied only where supported; model switching, tracker changes, processing FPS, and class-filtered line/ROI counts remain not live-applied, and the section says so.

**What changed (dashboard only — no api-server/processor changes):**
- `src/lib/api/types.ts` — `ProcessingConfigStatus`, `ConfidenceTrendConfigGroup`, `ConfidenceTrendByConfigResponse` (mirror the api-server contract; dimension fields nullable for pre-M8 history).
- `src/lib/api/reliability.ts` — `getReliabilityConfidenceTrendByConfig()`: wraps the by-config endpoint with the supported filter params (`processing_config_revision/status`, `applied_selected_classes_key`, `applied_confidence_threshold`, `warning`) serialized only when set; same resilient null-on-any-error posture as the trend client so a missing M9 endpoint can never blank the tab.
- `src/lib/perception/config-group-label.ts` — pure label helpers: `formatConfigGroupLabel` ("All classes · default confidence", "person · confidence 0.20", "unknown config", "No config metadata"), `formatConfigGroupStatus` ("partially applied · r4", "default config", "fallback default"), `hasAnalyticsCountsCaveat`, `isNoMetadataGroup`, `configGroupKey`.
- `src/components/dashboard-next/reliability-by-config-card.tsx` — the new client card: 24h | 7d toggle (both ranges server-fetched, instant switch), unavailable/empty states, per-group cards with gap-aware mini sparkline + Latest avg / Low-conf ratio / Samples, a "line/ROI counts still all-class" badge when the group carries `selected_classes_analytics_counts_not_filtered`, "No samples for this config in the selected range." for zero-sample groups, and Classes/Status `<select>` filters whose options derive from the returned data (nothing hardcoded, all filtering client-side — no extra query params sent).
- `src/app/dashboard/(app)/cameras/[cameraId]/reliability/page.tsx` — fetches by-config 24h+7d in the existing `Promise.all` and renders the section below the existing confidence-trend card (which is untouched).

**Verification:** `npx tsc --noEmit`, `npm run lint`, `npm run test` — 30 files / 430 tests pass, including new suites: `reliability-by-config.test.ts` (endpoint/params/resilience), `config-group-label.test.ts` (label/status/caveat rules), `reliability-by-config-card.test.tsx` (12 render/behavior cases incl. filters, range toggle, caveat badge, no live-apply claims). Existing reliability/Model & Detection tests unchanged and passing.

**Docs updated:** `docs/commit-log.md` (this entry), `docs/dashboard-next.md` (Reliability by Config subsection).

---

## 2026-06-01 — Model & Detection (M6): tracker / confidence / processing-FPS controls

**Subject:** Finish the Model & Detection editor — add dashboard controls for tracker, confidence threshold, and processing FPS (each defaulting to the runtime/model default), flip the validator from rejecting these fields to validating their bounds, and surface the saved values in the status panel.

**Why:** M5 shipped model + class selection but parked tracker / confidence / FPS as M6, hard-coding them to `null` and having the validator *reject* any non-null value. The api-server already validates `tracker` / `confidence_threshold` / `processing_fps` (M4) and `GET /v1/models` already returns `supported_trackers` + `default_confidence_threshold`, so M6 is **dashboard-only**: wire the controls and let the existing endpoints validate. Honest truth held in the copy: these settings now persist, but the live processor does **not** consume them yet — runtime/detection behavior is unchanged until the processor-config milestone.

**What changed (dashboard only — no backend/processor/eligible-sessions/DeepStream/reliability files touched):**
- `src/lib/perception/processing-config-schema.ts` — replaced the three "reject non-null (M6)" blocks with real bounds. `tracker`: null OK; a string must be in `model.supported_trackers` when the model is known (else `Tracker "X" isn't supported by {display_name}.`); any non-string non-null → issue. `confidence_threshold`: null OK; a number must be finite in `[0.0, 1.0]`; any non-number non-null → issue. `processing_fps`: null OK; a number must be an integer in `[1, 30]`; any non-number non-null → issue. version / model_key / selected_classes logic unchanged; docstring de-M5'd.
- `src/components/dashboard-next/detection/model-detection-panel.tsx` — new `tracker` / `confidence` / `fps` state (init from `initialConfig`); `TrackerControl` (`<select>`: "Runtime default" + `supported_trackers`), `ConfidenceControl` (synced range + number, `min=0 max=1 step=0.05`, "Use default" button → null), `FpsControl` (`<select>`: Default / 1 / 2 / 5 / 10 / 15 / 30). `handleModelChange` resets the tracker when it leaves the new model's `supported_trackers`. `handleSave` now sends the real values (not hard-coded null) behind the same client `validateProcessingConfig` gate. Added a calm muted "not live yet" notice tile, expanded the toolbar summary with tracker/confidence/fps, and refreshed the model-info note (was "later milestone (M6)").
- `src/app/dashboard/(app)/cameras/[cameraId]/configure/detection/page.tsx` — `StatusPanel` now renders a labeled summary `dl` (Model / Classes / Tracker / Confidence / FPS; "Runtime default" for null, "All supported classes" for empty classes) after the revision banner. Revision / status / timestamps / raw-JSON details unchanged.
- `configure/detection/actions.ts` unchanged — it already passes the model into `validateProcessingConfig`, so it inherits the new rules.

**Verification:** verify phase runs `npm test` / `npm run lint` / `npm run build` (the existing `processing-config-schema.test.ts` "M6 fields must ride as null" cases are now stale and updated by the tests step). No styling/CSS fields cross the wire; `selected_classes: []` still means "all supported classes".

**Docs updated:** `docs/commit-log.md` (this entry), `docs/dashboard-next.md` (Model & Detection section → M6: the three controls, null = default, the not-live caveat).

---

## 2026-06-01 — Navigation: lazy-load the Supabase SDK off camera-route critical JS

**Subject:** Defer the ~511 KB Supabase browser SDK to an on-demand async chunk so it no longer ships in every camera route's initial bundle; load it only when a Realtime subscription actually starts.

**Why:** Follow-up navigation work (N2). The build manifest confirmed the Supabase SDK (the two ~511 KB `RealtimeClient`/`GoTrueClient` chunks) was referenced **only** by camera routes — but by **all** camera tabs, because the session-state Realtime listener lives in the shared `[cameraId]/layout.tsx`. So entering a camera or switching camera tabs shipped ~511 KB of SDK in the critical initial JS purely for a background push, even on tabs that need no Realtime (Settings/Configure/Reliability). Non-camera routes never loaded it (which is why N1 alone made general nav feel fast). The original sweep's suggestion to `dynamic()`-import the overlay component was rejected: `LivePerceptionOverlayNext` wraps the video player, so lazy-loading the component would delay the video. Lazy-loading the SDK at the point of use keeps all UI immediate.

**What changed (active /dashboard only):**
- `src/lib/supabase/client-lazy.ts` (new) — `getSupabaseBrowserClient()`: an async, memoized (one promise/socket per tab) getter that obtains the client via a dynamic `import("@supabase/ssr")`, so Turbopack splits the SDK into its own async chunk. Same setAuth-on-create + on-auth-change token mirroring as the eager `./client` (which the /dashboard-legacy fallback still uses, left as-is).
- `src/components/dashboard-next/camera-detail-realtime-next.tsx` — its effect now `await`s the lazy client inside a cancel-guarded async IIFE before subscribing; debounce + teardown preserved (renders `null`, so zero UI impact).
- `src/components/dashboard-next/live-perception-overlay-next.tsx` — its Realtime effect (already an async IIFE) now awaits the lazy client first; auth-before-subscribe, the errored-event drop, the direct SWR cache write, and teardown are unchanged. The 250 ms poll already carries the overlay, so a slightly-later Realtime connect is invisible.
- `src/components/dashboard-next/live-perception-overlay-next.test.tsx` — mock retargeted from `@/lib/supabase/client` (sync) to `@/lib/supabase/client-lazy` (async `getSupabaseBrowserClient`).

**Result (placeholder-env build):** the two 511 KB initial chunks are gone; the SDK is now a single **233 KB on-demand async chunk**, confirmed **absent** from the initial bundles of the monitor / settings / reliability tabs. `.next/static` 2.3 MB → 2.1 MB; camera-route critical JS down ~511 KB.

**Verification:** `npm test` 347/347 pass (overlay test updated); `npm run lint` clean; `npm run build` clean (19 pages). Smoke after deploy: open a streaming camera and confirm the status badge + perception overlay still update on a real stream start/stop (Realtime still connects), and tab between camera tabs.

**Docs updated:** `docs/commit-log.md` (this entry), `docs/perf-sweep-report.md` (N2 status).

---

## 2026-06-01 — Navigation: add loading.tsx Suspense boundaries for instant transitions

**Subject:** Add `loading.tsx` boundaries at the (app) shell and camera-detail levels so client-side navigations show an immediate skeleton instead of blocking on server fetches, and so `<Link>` can partially prefetch these dynamic routes.

**Why:** Follow-up to the perf sweep — the user reported that *navigating between pages* (not the live session) felt slow. Root cause (confirmed against `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`): every `/dashboard` route is **dynamic** (`ƒ`), and Next 16 **skips prefetch for dynamic routes unless a `loading.tsx` boundary exists**. The repo had `loading.tsx` only at the `dashboard` root — none at the `(app)` shell or the camera-detail/tab level — so each `<Link>` click waited for the full RSC render + `no-store` fetches with the old page frozen on screen, and prefetch was silently disabled. The camera-tabs component already assumed per-tab boundaries ("loading boundaries scope per tab") that were never created. This replaces the original Batch 3 (live-overlay re-render loop), which was **dropped** — the live overlay isn't where the felt lag is.

**What changed (dashboard only):**
- `src/app/dashboard/(app)/loading.tsx` (new) — content-area skeleton for top-level navigations (Home / Cameras / Agents / Stream sessions / Settings / API tokens). Renders inside the persistent shell (sidebar/topbar stay; only `<main>` swaps), so transitions show instant feedback. Its existence also enables `<Link>` partial-prefetch of the shell on hover/viewport.
- `src/app/dashboard/(app)/cameras/[cameraId]/loading.tsx` (new) — content skeleton for camera-detail **tab** switches (Monitor / Observations / Configure / Settings / Reliability). Renders inside the `[cameraId]` layout, so the camera header + tab strip persist and only the tab content shows the skeleton while the tab streams in. Layout mirrors the (heaviest) Monitor tab.

Both are content-only (no `ShellBackdrop`/dvh wrapper — that's the shell's job); skeleton styling reuses the existing pattern (`bg-white/1x` header bars on the frosted `dn-panel`, pulsing solid-white `dn-tile` cards).

**Considered and rejected for now:** `unstable_instant` / Cache Components (Next 16's instant-navigation API). It requires `cacheComponents: true` + `use cache`, i.e. caching account-scoped multi-tenant data — too risky for the payoff against this app's deliberate `cache: "no-store"` model. The standard streaming/`loading.tsx` model achieves the perceived-speed win with no architectural change. Bundle-splitting the Supabase Realtime consumers (which would speed hydration → earlier prefetch) is a candidate next step (the old Batch 4), deferred pending review of this change.

**Verification:** `npm test` 347/347 pass; `npm run lint` clean; `npm run build` clean (all 19 pages generate; both loading boundaries compile). Additive Suspense fallbacks — worst case is a brief skeleton flash on a very fast response. Browser smoke recommended: click between sidebar pages and between camera tabs and confirm an immediate skeleton + streamed content (vs. the prior freeze).

**Docs updated:** `docs/commit-log.md` (this entry), `docs/perf-sweep-report.md` (navigation finding + status).

---

## 2026-05-31 — Perf sweep Batch 2: data-fetching / polling cleanup

**Subject:** Apply the data/polling latency cleanups from the performance sweep (`docs/perf-sweep-report.md`, Batch 2): request dedupe, fetch parallelization, shared-key cadence ownership, a targeted poll interval, and a debounced live-refresh.

**Why:** Batch 1 cleared the render-side quick wins; Batch 2 targets server-side latency and request-count amplification on the camera pages (the heaviest routes). These reduce camera-page TTFB and background API chatter without changing what's rendered. One item from the report's list was **deliberately dropped** after reading the code (see below).

**What changed (dashboard only):**
- `src/lib/account/active.ts` — `getActiveAccount` is now wrapped in React `cache()`. It runs 2–3× per camera render (the `(app)` layout, the `[cameraId]` layout, and the page), each doing a network `getUser()`; request-scoped caching collapses that to one `getUser()` + one membership read per render, and compounds under the Realtime `router.refresh()` path.
- `src/app/dashboard/(app)/cameras/[cameraId]/layout.tsx` — `getCamera` + `listStreamSessions` now run in `Promise.all` (were serial). Sessions uses the `cameraId` param (== `camera.id`) so neither awaits the other; `getCamera`'s 404 → `notFound()` gate is preserved.
- `src/app/dashboard/(app)/cameras/[cameraId]/configure/geometry/page.tsx` — `getCameraGeometryConfig` + `getLatestFrame` parallelized the same way (were serial), 404 gate preserved.
- `src/components/dashboard-next/latest-frame-perception-overlay-next.tsx` — the secondary overlay's perception fetch is now passive (`refreshInterval: 0`). It shares the `perception/latest` SWR key with `LivePerceptionOverlayNext`, which owns a 250ms cadence + 250ms dedupe while streaming; driving the same key on a second 5s cadence created the competing-timer/mismatched-dedupe fragility `use-list.ts` warns about. The captured-frame poll and the panel's Live toggle/manual Refresh are unchanged; perception never changes without an active session, so nothing is lost.
- `src/components/dashboard-next/cameras-grid-client.tsx` — `/v1/agents` (effectively-static display names) now polls at 60s while `/v1/cameras` (live status) stays at the 10s default. Targeted, not a blanket increase; a rename appears within 60s.
- `src/components/dashboard-next/camera-detail-realtime-next.tsx` — `router.refresh()` on `stream_sessions` transitions is now trailing-debounced (300ms). A lifecycle is 2–3 transitions in quick succession and each refresh re-runs ~13 `no-store` fetches; the debounce coalesces a burst into one refetch while keeping the live view ≤300ms behind the final transition. Timer cleared on unmount.

**Deliberately NOT done — "drop redundant proxy `getSession()`":** The sweep flagged the proxy's `getSession()` after `getUser()` as redundant. Reading `src/app/api/upstream/[...path]/route.ts`, it isn't: `getUser()` does the network JWT verification but does not return the access token; `getSession()` is a local cookie read that's the only clean way to obtain the `access_token` for the upstream `Authorization` header. It's not a network call and isn't safely removable. Skipped (≈0 benefit, non-zero risk). The only real per-request cost there is `getUser()`, which is the security boundary and stays.

**Verification:** `npm test` 347/347 pass; `npm run lint` clean; `npm run build` clean (TypeScript validates the `cache()` wrapper + `Promise.all` typings; all 19 pages generate). No api-server change. Behavior-preserving except the two intentional, documented timing trade-offs (agents 60s; refresh debounce 300ms). Browser smoke recommended: camera detail/monitor navigation, start/stop a stream (session badge + panels update within ≤300ms), cameras list.

**Docs updated:** `docs/commit-log.md` (this entry), `docs/perf-sweep-report.md` (Batch 2 status).

---

## 2026-05-31 — Perf sweep Batch 1: safe quick wins (no behavior change)

**Subject:** Apply the five low-risk, behavior-preserving performance fixes from the dashboard performance sweep (`docs/perf-sweep-report.md`, Batch 1).

**Why:** The dashboard felt laggy. A multi-agent sweep found the active `/dashboard` app is architecturally healthy (no tree-wide providers, SWR deep-compares, subscriptions/timers all clean) and concentrated the real cost in a few hot paths. Batch 1 is the subset that is provably safe — pure memoization, render-pass batching, and a build-config hardening — landed first so the remaining batches (data/polling, rendering/memoization, bundle-splitting) can be verified against a clean baseline. No polling cadence, Realtime, auth, or backend behavior was touched.

**What changed (dashboard only):**
- `src/lib/time.ts` — hoisted one shared module-level `Intl.DateTimeFormat` for `formatAbsolute` (mirrors the existing shared `rtf`), so large Sessions/Tokens tables stop constructing ~200 formatters per render/tick.
- `src/components/dashboard-next/cursor-glow.tsx` — the shell-wide `mousemove` glow tracker now coalesces 60–120 Hz events into one `requestAnimationFrame`, and **batches all `getBoundingClientRect` reads before any CSS-var writes** (was read-after-write per element → forced synchronous layout each event). Pending rAF is cancelled on unmount. Visual behavior unchanged (≤1 frame of glow latency).
- `src/components/dashboard-next/recent-observations-panel-next.tsx` — per-row `summary`/`type`/short-id derivations are now `useMemo`'d on the `observations` reference (stabilized to a constant empty-array identity when undefined), so row expand/collapse and idle 5 s polls no longer recompute every row. `JSON.stringify` of payloads stays lazy (open rows only) to avoid eager work.
- `src/components/dashboard-next/geometry/geometry-editor-panel.tsx` — extracted the inline `onLineSelect` arrow into a stable `useCallback` (removes a per-render prop identity change; prerequisite for memoizing `GeometryEditorSvg` in Batch 3).
- `next.config.ts` — added `experimental.optimizePackageImports: ['lucide-react']` (defensive tree-shaking + faster dev compiles; `lucide-react` already side-effect-free, so no bundle-size delta today).

**Verification:** `npm test` 347/347 pass; `npm run lint` clean (the linter caught a `useMemo` dep-stability issue in the first pass at the observations change, fixed by memoizing the `observations` array itself); `npm run build` succeeds — TypeScript clean, all 19 pages generate. `.next/static` unchanged at 2.3 MB (the two ~511 KB Supabase chunks are the Batch 4 dynamic-import target, untouched here). Browser smoke recommended: cursor glow over Home tiles, observations JSON expand/collapse, geometry line selection.

**Docs updated:** `docs/commit-log.md` (this entry), `docs/perf-sweep-report.md` (Batch 1 marked implemented). No api-server change.

---

## 2026-05-30 — Reliability M8-A: 24h/7d confidence-trend toggle + degradation badge

**Subject:** Add a 24h | 7d range toggle and a plain-language trend badge (Stable / Improving / Degrading / Warming up) to the Detection confidence trend card on `/dashboard/cameras/[cameraId]/reliability`.

**Why:** M7 showed a static 24h confidence sparkline. M8-A lets an operator switch the window and, more importantly, answer "has this camera's detection confidence been stable, improving, or getting worse?" at a glance. Dashboard-only; **no backend, no persisted finding** — the badge is a UI interpretation of the existing M7 trend points. M5 drift evaluator and M6 rollups are unchanged and remain the data source.

**What changed (dashboard only):**
- `src/lib/perception/confidence-trend-interpretation.ts` (new, pure) — `interpretConfidenceTrend(points)` → `{ status, label, blurb }`. Confidence-bearing hours are split into first/second halves (weighted by `confidence_sample_count`); `changeRatio = (lateAvg − earlyAvg)/earlyAvg`; `≤ −0.15` Degrading, `≥ +0.15` Improving, else Stable; under 4 valid points / 20 samples (or a null/zero early half) → Warming up. **Confidence-only language — never claims accuracy changed.**
- `src/components/dashboard-next/reliability-confidence-trend-card.tsx` — now a **client component**. A 24h|7d `RangeToggle` (two `aria-pressed` buttons in a `role="group"`, default 24h) and a `TrendBadge` were added; the M7 Sparkline/StatRow/gap-splitting are unchanged. The verdict is computed once and gates BOTH the badge and the chart, so they can never disagree (the sparkline is only drawn for a real, non-warming verdict; otherwise the "collecting history…" copy + "Warming up" badge show).
- `src/app/dashboard/(app)/cameras/[cameraId]/reliability/page.tsx` — fetches **both** ranges server-side (two resilient reads) and passes `trend24h`/`trend7d`; the client card toggles between them instantly (no client fetch, no loading state). Summary/findings fetches and resilient error handling are unchanged.
- Tests — `confidence-trend-interpretation.test.ts` (15 cases: thresholds incl. ±0.15 boundaries, weighting flips verdict, odd-n middle exclusion, interleaved-null split, zero-weight guards) + the card test rewritten for jsdom + `@testing-library/react` (14 cases: default 24h, toggle switches dataset both ways, chart×badge consistency, each verdict, empty/warming/unavailable, gap dot/line, no internal field names).

**Verification:** `npm run lint` clean; `npx tsc --noEmit` clean; `npm test` 347/347 pass (29 new). Reviewed via a multi-agent adversarial workflow, which caught a real chart-vs-badge contradiction (a sparkline rendered under a "not enough history" badge for 2–3-hour-old cameras); fixed by deriving the chart gate from the same verdict as the badge. Browser smoke against a real camera with rollups still recommended.

**Docs updated:** `docs/commit-log.md` (this entry). No api-server change (the M7 `?range=7d` endpoint already supports 7d).

---

## 2026-05-30 — Reliability M7: "Detection confidence trend" chart on the camera Reliability tab

**Subject:** Add a 24h detection-confidence trend chart to `/dashboard/cameras/[cameraId]/reliability`, backed by the new api-server `confidence-trend` read endpoint over the M6 hourly rollups.

**Why:** M6 made hourly confidence rollups but they were invisible to users. M7 turns the Reliability tab from a current-findings list into a historical surface: an operator can see whether a camera's detection confidence is stable, improving, degrading, or recovering.

**What changed:**
- `src/lib/api/types.ts` — `ConfidenceTrendRange`/`ConfidenceTrendPoint`/`ConfidenceTrendSummary`/`ConfidenceTrendResponse` interfaces (mirror the API JSON).
- `src/lib/api/reliability.ts` — `getReliabilityConfidenceTrend({ accountId, cameraId, range })`. **Resilient by design: catches ALL errors → `null` (via `reportError`), not just 404**, so the page's `Promise.all` can never reject and blank the tab. The existing summary/findings fetchers keep their re-throw semantics.
- `src/components/dashboard-next/reliability-confidence-trend-card.tsx` (new) — Server Component, `.dn-tile`. States: null→unavailable, 0 points→empty, <2 confidence points→warming, else a **hand-rolled inline SVG sparkline** (no chart dependency added — none was installed). Null-confidence hours are gaps (the line splits, never bridges); lone points render as dots; per-hour hover `<title>` tooltips (hour · avg% · low-conf% · samples). Percentages via round(*100)%, null→"—". Reuses `formatAbsolute` (`@/lib/time`) + `toLocaleString()`.
- `src/app/dashboard/(app)/cameras/[cameraId]/reliability/page.tsx` — 4th parallel fetch + the card rendered right after the summary card.
- Tests — `reliability-confidence-trend-card.test.tsx` (9 cases: states, gap-splitting, lone-dot, percentage/`—`, no internal field names) + `reliability-confidence-trend.test.ts` (URL/range building + the catch-all-resilience contract).

**Verification:** `npm run lint` clean; `npx tsc --noEmit` clean; `npm test` 327/327 pass (13 new). Browser smoke against a real camera with rollups still recommended (chart renders; empty/warming/unavailable states; existing findings unaffected).

**Docs updated:** `docs/commit-log.md` (this entry). API contract documented in `../upstream-api-server/docs/api-contracts.md`.

---

## 2026-05-29 — Promote dashboard-next to the default `/dashboard`; keep old dashboard as `/dashboard-legacy` fallback

**Subject:** Make the light-theme `dashboard-next` redesign the default dashboard at `/dashboard`, and preserve the previous dark dashboard as a fully navigable fallback at `/dashboard-legacy`.

**Why:** `dashboard-next` was fully wired and the documented target replacement (see `docs/dashboard-next.md`). This executes the route-level half of the promotion checklist while keeping the old dashboard live for rollback safety, so the cutover is reversible and low-risk. No backend, CORS, env, or deploy-config change is required (routing is filesystem + `proxy.ts`; CORS is origin-based).

**What changed:**
- Route/asset folders — `git mv src/app/dashboard → src/app/dashboard-legacy`, then `src/app/dashboard-next → src/app/dashboard`, then `public/dashboard-next → public/dashboard`.
- New dashboard — route URL literals `/dashboard-next/*` → `/dashboard/*` and app-folder imports `@/app/dashboard-next` → `@/app/dashboard` (`sidebar-next`, `home-overview-client`, `camera-tabs`/`-card`/`-panels`, `reliability-panel`, `login-form-next`, `topbar-next` asset, route files, `revalidatePath` in api-tokens/settings/geometry actions). `@/components/dashboard-next/*` imports, the `.dashboard-next` theme scope, and `-next` suffixes left intact.
- Legacy dashboard — internal URLs `/dashboard/*` → `/dashboard-legacy/*` and old token-action imports → `@/app/dashboard-legacy/*` (`sidebar.tsx`, `overview-cards`, camera detail, `not-found`, token components). API paths (`/v1/dashboard/...`) and `@/lib/api/dashboard` left intact.
- `proxy.ts` — `PUBLIC_PATHS` + the light-login post-login redirect now use `/dashboard/login`; the generic post-login redirect to `/dashboard` is unchanged (now lands on the new dashboard). `/dashboard-legacy/*` stays auth-gated.
- Realtime — new dashboard drops the `dn-` prefix (`camera:${id}:sessions` / `:perception`); legacy renamed to `legacy-camera:${id}:sessions` so the two coexisting dashboards stay on isolated channels.
- Error tags — `area: "dashboard-next…"` → `area: "dashboard…"`. Shared-module header comments (`whep-client.ts`, `player-state-event.ts`) re-pointed to `/dashboard` (light) + `/dashboard-legacy` (dark).
- Tests — `reliability-panel.test.tsx` route assertion + `processing-toggle-next.test.tsx` Server-Action mock path updated for the rename.
- Deferred (would break the live fallback): dropping `-next` component suffixes / moving components, renaming chrome files, folding `theme.css`, moving shared modules. Tracked in `docs/dashboard-next.md` promotion checklist.

**Verification:** `npm run lint` clean. `npx tsc --noEmit` clean (source). `npm test` 313/313 pass. `npm run build` succeeds — route tree shows `/dashboard` (new, with `(app)` tabs + public `/dashboard/login`) and `/dashboard-legacy` (old). Browser smoke (WHEP, latest frame, Realtime, geometry save, tokens, login/logout, legacy fallback) still required against a real Supabase project.

**Docs updated:** `docs/commit-log.md` (this entry), `docs/dashboard-next.md`, `AGENTS.md`, `src/app/dashboard/README.md`.

---

## 2026-05-29 — Reliability M5: render windowed "Recent avg confidence" in drift evidence

**Subject:** Follow-up to the api-server M5 window-aggregate fix (drift now
compares rolling time windows instead of a single frame). The
`UnstableConfidenceEvidence` formatter
(`src/components/dashboard-next/reliability-evidence.tsx`) now also renders
**Recent avg confidence** (`current_avg_confidence`) next to the existing
**Previous avg confidence**, so the drift comparison reads current-vs-previous
even when the latest frame has too few detections for the per-frame
"Average confidence" row to populate. Still text only, no charts; all rows
self-hide when their value is absent. Updated the vitest drift case to the
windowed evidence shape (per-frame stats null, windowed current/previous set).
`tsc` / `eslint` / vitest clean.

## 2026-05-29 — Reliability M5: render detection-confidence drift evidence

**Subject:** The Reliability tab's `UnstableConfidenceEvidence` formatter
(`src/components/dashboard-next/reliability-evidence.tsx`) now renders the M5
drift fields the api-server added to the `unstable_detection_confidence`
finding's free-form `evidence`: **Previous avg confidence**, **Confidence drop**
(`drop_ratio` as a %), **Baseline samples**, **Baseline window** (`humanAge`),
and **Why flagged** (`trigger_reasons` mapped to human labels via
`TRIGGER_REASON_LABELS`, unknown reasons fall back to the raw key). Each row
hides itself when its value is absent, so a young camera with no baseline shows
exactly the M2 layout — no crash, no empty rows. No API-type change needed:
`ReliabilityFinding.evidence` is already `Record<string, unknown>`. Text only —
no charts (deferred). Added two vitest cases (baseline-present renders all
fields; baseline-absent omits them). `tsc`/`eslint`/vitest clean.

## 2026-05-29 — docs: Realtime client requirements (setAuth-before-subscribe, client-side filtering) in dashboard-next.md

**Subject:** Documented the two non-obvious client-side Realtime requirements learned this session in `docs/dashboard-next.md` (Pattern 3): (1) the browser client is a memoized singleton that puts the user JWT on the Realtime socket via `realtime.setAuth(token)`, and RLS-protected subscriptions must `getSession()` → `setAuth` **before** `.subscribe()` (else per-record `401`); (2) filter `camera_id` **client-side**, not via a server-side `filter:`, which silently drops UPDATE events unless the table is `REPLICA IDENTITY FULL`. Added a cross-reference to the api-server's DB-side requirements (publication / REPLICA IDENTITY / `GRANT SELECT … TO authenticated`) for "SUBSCRIBED but silent" debugging, and corrected the now-stale "filtered by `camera_id`" description of `CameraDetailRealtimeNext` (it filters client-side now). Docs only.

## 2026-05-29 — Fix: drop errored (401) Realtime events that were thrashing the overlay; rely on the 250ms poll

**Subject:** Detection boxes regressed to "barely updating" even though the chip said "Realtime connected". Cause: the unauthorized (401) change events arrive in **bursts** during the reconnect churn an auth failure causes, and the handler ran `setState` + `mutate()` on **every one** — hundreds/sec — thrashing React and starving the 250ms poll that actually updates the overlay. Fix: **ignore any change event carrying `errors`** (e.g. `Error 401: Unauthorized`) — they have no usable row and must not drive the overlay. The 250ms poll (which has always worked) now updates detections at ~4fps cleanly, and `realtimeDelivering` stays false so the chip honestly reads **"Fallback polling"** (stable, no SUBSCRIBED↔CLOSED flicker since delivering requires a *usable* event).

**On the 401 itself:** Supabase Realtime can't authorize the per-record read for this RLS table — almost certainly the access token is expired after a very long session (a fresh login would let real, error-free events flow and auto-upgrade to direct-write "Realtime connected"). The overlay no longer depends on that working: polling carries it.

**Cleanup:** removed the temporary `[perception-realtime]` console diagnostics and the `reportError` on channel errors (no more console/Sentry spam from the reconnect loop). 311 tests pass (added an errored-event-ignored test); lint + tsc clean.

## 2026-05-29 — Fix: authorize the Realtime socket BEFORE subscribing (Error 401 on every event)

**Subject:** With `REPLICA IDENTITY FULL` applied, UPDATE events now flow — but the diagnostics showed every event arriving as `keys=[] errors=['Error 401: Unauthorized']`, with the channel churning `SUBSCRIBED → CLOSED → SUBSCRIBED`. The per-record RLS authorization was failing because the **Realtime socket wasn't presenting the user JWT** — relying on the memoized client's eager/background `setAuth` raced the overlay's `subscribe()`, so the channel authorized record reads as `anon` → 401 → stripped payload → reconnect loop.

**Fix:** in the overlay's Realtime effect, **await `supabase.auth.getSession()` + `supabase.realtime.setAuth(token)` BEFORE `.subscribe()`**, so the postgres_changes record reads authorize as the signed-in user. The effect is now an async IIFE with a `cancelled` guard and a channel-null-checked cleanup. Handler unchanged (direct cache-write when the row is usable, refetch otherwise).

**Tests:** mock gained `realtime.setAuth`; the subscribe-dependent tests are now `async` and `await flushRealtime()` (a small helper that drains the effect's getSession→setAuth→subscribe microtasks) before asserting subscribe/status/handler behavior. 310 tests pass; lint + tsc clean. Temporary `[perception-realtime]` diagnostics retained until the chip is confirmed "Realtime connected" with no 401s.

## 2026-05-29 — Fix: consume Realtime events even when the broadcast row arrives stripped

**Subject:** The api-server `REPLICA IDENTITY FULL` migration worked — the console diagnostics confirmed `socket auth: user-jwt`, `status: SUBSCRIBED`, and `event: UPDATE` firing 100+×, so UPDATE events now flow at full rate. **But** the broadcast row came through with `camera_id` (and other fields) `undefined`, so `perceptionRecordFromRealtimeRow` mapped it to `null` and the handler dropped every event → still "Fallback polling". Fixed the handler to not depend on the row contents: when the row is usable, direct-write it to the SWR cache (true real-time, scoped to this camera); when it arrives **stripped** (`rec` is null), use the event purely as a **refetch signal** (`mutate()` — RLS scopes delivery to the account, and `/perception/latest` returns the full snapshot the broadcast didn't carry). Either way `lastRealtimeEventAt` is set so the chip honestly reads "Realtime connected". Kept the temporary `[perception-realtime]` diagnostics (now logging `keys=`/`errors=`) to pin down *why* the row is stripped before removing them. 310 tests pass (added a stripped-row refetch test); lint + tsc clean.

## 2026-05-29 — Temp diagnostics for Realtime delivery (paired with the api-server REPLICA IDENTITY FULL migration)

**Subject:** After removing the server-side `camera_id` filter the overlay was *still* "Fallback polling". The remaining, independent cause is a DB-level one (Supabase won't deliver `UPDATE` events on an RLS table without `REPLICA IDENTITY FULL`), fixed by an api-server migration. Since three prior fixes missed, this dashboard commit adds **temporary** `console.info("[perception-realtime] …")` diagnostics to the overlay's Realtime effect so we confirm the cause end-to-end this round instead of guessing again: (1) socket auth (`user-jwt` vs `anon`), (2) subscribe status + err, (3) every raw row event received *before* the client-side camera filter. Also updated the test's Supabase mock to provide `auth.getSession`.

**Decision tree (read in the browser console after deploy):** chip → "Realtime connected" + `event` logs ⇒ the migration fixed it (remove diagnostics next). Still fallback + `socket auth: anon` ⇒ socket-auth fix didn't take effect (explicit `setAuth` before subscribe). Still fallback + `user-jwt` + zero `event` logs ⇒ migration didn't apply / deeper publication issue.

**Status:** log-only, no behavior change; lint + tsc clean, 309 tests pass. Diagnostics get removed once Realtime is confirmed working.

## 2026-05-29 — Fix (ACTUAL root cause): Realtime dropped every event — postgres_changes filter on a non-replica-identity column

**Subject:** The overlay chip stayed **"Fallback polling"** (channel `SUBSCRIBED`, zero events) even after the publication was applied and the browser socket was authenticated. The real cause: `latest_perception_snapshots` has primary key `id`, with `camera_id` only a UNIQUE index, and no table is `REPLICA IDENTITY FULL` — so the replica identity is `id`. The overlay subscribed with a **server-side `filter: camera_id=eq.<id>`**. Supabase only evaluates a `postgres_changes` filter on **UPDATE** events against columns in the table's replica identity, so a `camera_id` filter drops every UPDATE. Because the snapshot is **UPSERTed (one row per camera)**, all writes after the first are UPDATEs → **everything dropped**. This was never working; the 250 ms poll always masked it. (The two prior fixes — poll cadence and socket auth — were real but did not touch this; I should not have called them "the fix.")

**Fix (dashboard-only, no migration dependency):** remove the server-side filter and filter **client-side**. RLS (`member_select`) still scopes delivered rows to the account; the handler ignores any row whose `camera_id` ≠ the viewed camera. Applied the same fix to `camera-detail-realtime-next.tsx` — its `stream_sessions` subscription filtered on `camera_id` too, so session-state UPDATEs (approved→streaming→ended) were being dropped identically (only new-session INSERTs delivered). Also captured the previously-discarded `.subscribe((status, err))` error via `reportError`.

**Tradeoff:** the client now receives account-scoped perception rows for all the account's cameras (filtered to the viewed one in JS) — bounded, and only while a live session is active. Optional later efficiency: `ALTER TABLE latest_perception_snapshots REPLICA IDENTITY FULL` (+ `stream_sessions`) would let a server-side `camera_id` filter work on UPDATEs.

**Status:** lint + tsc clean; 309 tests pass (added a cross-camera-ignore test). Confirmed fixed only once the live chip reads **"Realtime connected"** after deploy.

## 2026-05-29 — Fix: Realtime delivered no events (browser socket was anon → RLS filtered everything)

**Subject:** With the poll-cadence fix deployed, the overlay chip honestly showed **"Fallback polling"**: the channel reported `SUBSCRIBED` but **zero** `postgres_changes` events arrived — even though the `supabase_realtime` publication migration was applied (verified) and the processor was actively upserting rows (polling saw them change). Cause: `createSupabaseBrowserClient` minted a **fresh client per call** and never set the user's JWT on the Realtime socket, so it connected as **anon**. The `latest_perception_snapshots_member_select` RLS policy keys off `auth.uid()`, so with an anon socket every member-scoped row broadcast was filtered out. Polling reads were unaffected because they go through `/api/upstream` with a server-minted user JWT.

**Fix:** memoize a single browser client per tab and mirror the cookie session's access token onto the Realtime socket — eagerly via `getSession()` and again on every `onAuthStateChange` (token refreshes). The socket now authenticates as the signed-in user, RLS matches the member's rows, and `postgres_changes` deliver. This also fixes the `stream_sessions` realtime (`camera-detail-realtime-next`) which shared the same anon-socket gap. Kept an inner `makeBrowserClient` factory so the memoized client keeps the precise `createBrowserClient` instantiation type (annotating the singleton as `ReturnType<typeof createBrowserClient>` degraded `.on`/`.subscribe` callback inference to `any`).

**Scope:** dashboard-only (`src/lib/supabase/client.ts`); no API/migration change — the publication migration was already applied. lint + tsc clean; 308 tests pass. After deploy the chip should flip to **"Realtime connected"** and detections update via push.

## 2026-05-29 — Fix: live overlay updated only every 10s when realtime was silent

**Subject:** M5 slowed the SWR poll to a 10s "safety re-sync" once the Supabase channel reported `SUBSCRIBED`, assuming realtime push was then carrying updates. But `SUBSCRIBED` only means the *channel* connected — if `latest_perception_snapshots` isn't in the `supabase_realtime` publication for that environment, the channel subscribes yet delivers **zero** row events. Result: the chip said "Realtime connected" while the overlay refreshed only every 10s — worse than the pre-M5 250ms poll.

**Fix:**
- Poll at `LIVE_OVERLAY_POLL_MS = 250` whenever a session is active; **never** slow it based on realtime status. Removed `LIVE_OVERLAY_RESYNC_MS`. Rationale: polling hits our own API (not Supabase), so it's free against the Supabase plan; M5's free-plan safety comes from gating the *subscription* + gating polling to active sessions, not from slowing the poll. Realtime is purely additive on top.
- Honest chip: track `lastRealtimeEventAt` and only show "Realtime connected" when a row event arrived within `REALTIME_DELIVERING_WINDOW_MS = 8_000`; a subscribed-but-silent channel now reads **"Fallback polling"** — which is also the visible tell that the publication migration isn't applied in prod.

**Tests:** updated `deriveOverlayConnectionState` (new `realtimeDelivering` input) + its truth-table tests; component tests now assert connecting → fallback-polling (subscribed-but-silent) → connected (events flowing), and that `refreshInterval` stays 250 while active even after `SUBSCRIBED`. lint + tsc clean; full suite green.

**Note:** the proper end-to-end fix for true realtime push is applying the api-server migration `20260528180000_realtime_perception_snapshots.sql` (adds the table to the `supabase_realtime` publication) in the production Supabase project. Until then the overlay runs correctly on the 250ms poll and the chip honestly shows "Fallback polling".

## 2026-05-29 — Live Detection Overlay M5: free-plan-safe realtime sessions

**Subject:** Live detections are now **OFF by default** in `LivePerceptionOverlayNext`. Previously the overlay opened a Supabase Realtime subscription on mount (`useState(true)`), so every open Monitor tab held a connection — wasteful on the Supabase Free plan. M5 makes it intentional: the user clicks "Turn on live detections" to start a **15-minute client-side viewing session**, and a subscription is held open ONLY while all of: session on + not expired + stream connected + processing enabled + output fresh + tab visible. It auto-unsubscribes on 15-min expiry, processing-off, stream drop, staleness, tab hide, or unmount, and reconnects on re-focus if the session is still valid. The video preview always plays regardless.

**Why:** free-plan safety — no Realtime connection unless someone is actively watching detections. Also surfaces honest connection state and corrects the mental model that the processor (not just the browser preview) is real-time.

**How:**
- New pure helpers in `src/lib/perception/overlay-helpers.ts`: `LIVE_SESSION_DURATION_MS`, `isSessionExpired`, `formatCountdown`, `computeRealtimeGate` (the six-condition AND), `deriveOverlayConnectionState` + `OverlayConnectionMode`/`RealtimeStatus`. Pure ⇒ exhaustively unit-tested.
- New client hooks `use-page-visible.ts` (SSR-safe `visibilitychange`) and `use-live-detection-session.ts` (15-min session: off/on/expired, countdown, enable/disable/extend; expiry derived from the absolute timestamp so a throttled/hidden tab is correct on wake).
- `live-perception-overlay-next.tsx`: composes the gates; `streamActive` from the WebRTC player's `PLAYER_STATE_EVENT` (`kind === "connected"`); captures the previously-discarded `.subscribe()` status for the chip; adaptive polling (`LIVE_OVERLAY_POLL_MS=250` fallback, `LIVE_OVERLAY_RESYNC_MS=10_000` safety re-sync when connected, `0` when no session); `StatusDot` connection chip on the metadata line; always-visible disclaimer (exact M5 copy); off/expired/stream-inactive states added to the message body. Boxes only draw while a session is active.

**Disclaimer (exact copy):** "Live detections show what UpStream is seeing from the camera. The boxes are drawn in your browser as a preview, so they may be slightly delayed compared with the video. This does not mean the processor is delayed or out of sync — detections and events are still created from the actual camera stream."

**Tests / infra:** added `@testing-library/react` + `jsdom` devDeps; opt-in per file via `// @vitest-environment jsdom` (global env stays `node`, existing tests untouched). New: pure-helper truth-table tests, `use-live-detection-session` timer tests (fake timers), and a component integration suite (subscribe-gating across every gate, expiry/visibility/unmount unsubscribe + reconnect, connection-chip copy, realtime event → cache write, disclaimer wording, and box/label/min-confidence/refresh/empty/no-secret regressions). `npm run lint` + `tsc --noEmit` clean; **306 tests pass** (20 files). No backend / API / processor changes; no SSE/WebSocket; session not persisted.

## 2026-05-28 — Live overlay poll fallback 500ms → 250ms

**Subject:** Lowered `LIVE_OVERLAY_POLL_MS` in `live-perception-overlay-next.tsx` from 500ms to 250ms.

**Why:** The overlay already renders every emitted snapshot at the processor's full rate via the Realtime direct-cache-write path (`mutate({ snapshot }, { revalidate: false })` on each `postgres_changes` row). The SWR poll is only the *fallback* for when Realtime isn't connected (e.g. the `supabase_realtime` publication migration isn't applied in an environment). At 500ms that fallback capped at ~2 fetches/sec; alongside a processor change that lifts the detection emit rate, the fallback ceiling shouldn't sit below it. 250ms ≈ 4 fetches/sec, matched to the hook's `dedupingInterval: 250` so the fallback comfortably exceeds the ~3 FPS publish rate instead of throttling it. No behavior change when Realtime is live.

**Scope:** one constant + its explanatory comment. tsc clean; the 9 overlay tests still pass.

**Subject:** P6-C taught the processor to consume operator-saved geometry; P6-D verified the lineage end-to-end via a CLI. Operators still couldn't *see* whether their saved geometry took effect — they had to trust that hitting Save in the editor and restarting a session got picked up by the runtime. This adds a small read-only panel on the camera Monitor tab that reads the `processor_statuses.payload.applied_geometry` block (the P6-C lineage stamp) via the new `GET /v1/cameras/{id}/processor-status/latest` endpoint and renders it in one of seven variants: operator-saved (positive), default (warning), fallback-on-error (warning), geometry-invalid (danger), no-status (muted), missing-applied-geometry (muted), unknown-source (warning, forward-compat).

**Why:** the chip is the first visible reliability surface backed by the P6-D lineage work. Future reliability findings (e.g., "alert when source=default on an actively-running production session") will read the same block; surfacing it visually first gives operators an immediate way to self-check "did my save reach the runtime?" without grepping processor logs.

**Scope kept tight:** server-rendered only — matches `CameraMetaPanel` / `AgentPanel` / `ValidationPanel`. No polling. Processor status changes on session restarts and lifecycle transitions, not per frame; operators inspect the chip once after a save+restart, and a tab reload gives them the fresh state. No mutations, no findings persisted, no new backend work (the endpoint already exists from P6-D).

**Display variants — single hue per tone, no DeepStream-internal copy.** Green for operator-saved (the happy path), moss yellow for default / fallback / unknown-source (warning tones), red for geometry-invalid (danger), neutral for no-status / missing-applied-geometry. Copy never mentions DeepStream / nvdsanalytics / GStreamer / pyds — the chip is operator-facing, not a runtime debug surface. A test pins this across every variant.

**Verdict resolution priority** (first match wins, in `formatAppliedGeometryStatus`):

1. `null` status → no_status
2. `error_code === "geometry_invalid"` → geometry_invalid (P6-C stamps this at the row level alongside `source=fallback_default_on_error`; surfacing it first gives the chip the strongest signal)
3. `payload.applied_geometry` not an object → missing_applied_geometry
4. `source === "operator_saved"` → operator_saved (with revision, line/ROI counts)
5. `source === "default"` → default
6. `source === "fallback_default_on_error"` → fallback (with optional saved revision + error_reason)
7. anything else → unknown_source (with the source label rendered verbatim)

**Session scoping.** The Monitor page already fetches `currentSession`; the chip narrows by passing `stream_session_id` to the endpoint when one is active. That avoids confusing "latest historical row from a previous session" results when multiple processor restarts have stamped overlapping rows. When no session is active, the chip falls back to the latest-ever row.

**Layout.** The existing three-panel meta grid (`grid-cols-1 md:grid-cols-3`) becomes a four-column grid (`grid-cols-1 md:grid-cols-2 xl:grid-cols-4`) — two-by-two on tablet, four-across on wide screens, single-column on mobile. Avoids cramming four tiles into a 3-column row on intermediate widths.

**Files touched:**

- **New — types**
  - `src/lib/api/types.ts` — added `AppliedGeometry`, `ProcessorStatusValue`, `ProcessorStatusRecord`, `LatestProcessorStatusResponse` matching the api-server's P6-D schemas. `source` is unioned with `(string & {})` so a future server-side source value doesn't crash the type.
- **New — wrapper** (`src/lib/api/`)
  - `processor-status.ts` — `getLatestProcessorStatus({ accountId, cameraId, streamSessionId? })`. Mirrors `perception.ts`: imports `"server-only"`, wraps `serverFetch`, catches `processor_status_not_found` 404 and returns `null` so the page never has to try/catch the no-status case.
- **New — helper + tests** (`src/lib/perception/`)
  - `applied-geometry-format.ts` — pure tagged-variant `formatAppliedGeometryStatus(status)` (the verdict-resolution logic above). No React.
  - `applied-geometry-format.test.ts` — **+10 tests** covering every variant + the resolution priority (geometry_invalid overrides applied_geometry; non-geometry error_code is ignored).
- **New — component + tests** (`src/components/dashboard-next/`)
  - `applied-geometry-panel.tsx` — Server Component, `.dn-tile` shape, header-with-status row (matches `SessionPanel`), per-variant body rendered via a `PanelBody` switch on `display.kind`. Uses the existing `StatusDot` + the now-exported `Row` from `camera-panels.tsx`.
  - `applied-geometry-panel.test.tsx` — **+8 tests**, `renderToStaticMarkup` per variant. One test pins the no-internal-terms invariant across all seven variants.
- **Modified — Monitor page**
  - `src/app/dashboard-next/(app)/cameras/[cameraId]/monitor/page.tsx` — added `getLatestProcessorStatus` to a new second-phase parallel block alongside `listValidations` (both depend on `currentSession`), passing `streamSessionId` when active. Added `<AppliedGeometryPanel status={processorStatus} />` as the fourth tile in the meta-panel grid.
- **Modified — shared helpers**
  - `src/components/dashboard-next/camera-panels.tsx` — exported `Row` and `PanelHeader` so the new panel can reuse the existing row + label styling instead of duplicating.

**Files NOT touched:**

- api-server / processor / observation schema — endpoint and lineage block already exist from P6-D.
- Geometry editor — no editor behavior changes.
- Legacy `/dashboard` — chip only lives in `/dashboard-next` per the standing route policy.

**Verification:**

- `npm run lint` clean.
- `npx tsc --noEmit` clean.
- `npm test` — **+18 new tests (10 helper + 8 component)**, full suite passing.
- `npm run build` — known limitation: page-data step fails locally without `NEXT_PUBLIC_*` env vars; compile + typecheck pass.
- Manual (post-deploy): visit Monitor tab for the P6-D test camera (`7b8313e5-…`) — chip should show `Applied geometry · Operator-saved · Revision r9 · Lines 2 · ROIs 1` (green dot). Stop the session — chip shows the latest historical row. Force `source=default` (or clear saved geometry + restart) — chip switches to warning copy.

**Docs updated:** this commit-log entry; `docs/dashboard-next.md` adds an Applied Geometry chip section.

**Follow-ups:**

1. **First reliability finding** — emit an alert when `source = default` shows up on an actively-running production session. The chip surfaces this visually; the alert turns it into an actionable notification.
2. **Polling variant** — if operators report needing live updates without a tab reload, switch the chip to a Client Component using `useUpstreamList` (10–15 s cadence). Server-only is the deliberate default for now.
3. **Rename `payload.debug.geometry_source = "probe_default"`** on observations — cosmetic. The authoritative `payload.source.geometry_source` is correct; the debug field is misleading because the in-container pyds app doesn't know the supervisor stamped operator geometry over its head.
4. **Re-run P6-D** with a more line-crossing-friendly walk to escalate the verdict from PARTIAL to PASS.

---

## 2026-05-27 — P6-B3 hotfix: polygons never actually rendered (percentages aren't valid in `<polygon points>`)

**Subject:** P6-B2 introduced ROI polygon rendering using percentage strings in the SVG `<polygon>` `points` attribute (`"10%,10% 90%,10% 50%,90%"`). The SVG spec defines `points` as a list of `<number>` coordinates — percentages are **not** valid syntax there, unlike `<line>` `x1`/`y1` or `<circle>` `cx`/`cy`. Browsers silently parsed only the numeric prefix, so every ROI polygon rendered at near-origin device pixels (~10×10 px), invisible at typical canvas sizes. That's why none of the P6-B3 polish landed visually: no rendered polygon means no border to see, no fill to read, no hover events to fire, no interior to grab for whole-shape drag. Lines and handles always worked because their attributes accept percentages.

**Operator report:** "im not seeing the hover do anything, i dont see the roi edge lines which we want, i cant drag interior, i dont see any fills" — all four symptoms trace to one root cause: the polygon never rendered as a usable shape.

**Fix:** measure the SVG's actual rendered size with a `ResizeObserver` (initial measurement via `useLayoutEffect` + `getBoundingClientRect` so polygons are correct on first paint, then ResizeObserver tracks container reshapes). Polygon `points` are computed in **device pixels** = `normalized × measuredSize`. Lines and circles continue to use percentages — their attributes accept them. The SVG keeps no viewBox, so the polygon's device-pixel coords just slot into the SVG's implicit viewport coordinate system.

**Why no test caught this:** the rendering bug is pure SVG markup behavior; `vitest.config.ts` is `environment: "node"`, so the test surface is pure helpers + node-renderable SSR. Component visual behavior isn't reachable. The bug also wasn't caught by `npm run build`'s typecheck because TypeScript doesn't know SVG's `points` attribute grammar — to TS it's just a string.

**Lesson for the next contributor (codified in the file header comment):** `<line>` + `<circle>` accept percentages on position attrs (`x1`/`y1`/`cx`/`cy`/`r`); `<polygon>` + `<polyline>` + `<path>` do NOT accept percentages in `points` or `d` — those are number lists per spec.

**Files touched:**

- `src/components/dashboard-next/geometry/geometry-editor-svg.tsx` — added `useRef` + `useLayoutEffect` + `ResizeObserver` to track SVG size; `roiPointsAttr` now takes `(points, w, h)` and returns device-pixel coords; three polygon call sites updated; `polygonsReady` gate so polygons don't render at (0, 0) for the one paint before measurement. Header comment expanded with a "POLYGON CAVEAT" block documenting the percentage-vs-number distinction.

**Verification:**

- `npm run lint` clean.
- `npx tsc --noEmit` clean.
- `npm test` — 182/182 (no test changes; bug isn't reachable from node-env vitest).
- Manual: open the editor, draw a polygon — the fill, border, vertex dots all render. Hover an existing ROI: fill brightens, cursor reads `move`. Click + drag the interior: whole polygon follows the cursor. Saved-ROI vertex handles + selection still work.

**Docs updated:** this commit-log entry.

---

## 2026-05-27 — P6-B3: Visual polish + usability (ROI fill tiers, whole-ROI drag, label editing, cross-tool click fix)

**Subject:** Make the geometry editor feel visually correct and trustworthy before P6-C wires the processor to consume saved geometry. Three concrete improvements + one bug fix:

1. **Three-tier sage ROI fill** (normal 0.10 / hovered 0.22 / selected 0.34) plus a 0.18 fill on draft polygons at ≥ 3 vertices. Single hue across all ROIs; varying alpha. Hover state is editor-local, persists nothing.
2. **Whole-ROI drag** by clicking the polygon interior in Select mode. New pure helpers `clampRoiTranslation` and `translateRoi` keep the polygon inside `[0, 1]` at all times. Vertex drag still works as before.
3. **Selected-shape label editing** via a new inline `<SelectedShapeCard>` between the canvas and the hint line. Pure helpers `updateLineLabel` / `updateRoiLabel` preserve every other field (id, points, direction/type, enabled). Validation runs through the existing save path.
4. **Cross-tool click fix** — in P6-B2, clicking an existing ROI while in Draw line or Draw ROI mode silently selected the ROI and ate the click, making it impossible to place a vertex on top of an existing shape. New `interactive: boolean` prop on the SVG gates `pointer-events` on existing shape hit targets; when `false` (any non-Select tool), clicks pass through to the canvas. Draft hit targets stay interactive.

**Why:** the user reported that the ROI editing experience felt visually buggy — polygons didn't communicate "this shape has an interior," there was no hover affordance, and the draft polygon stayed as a thin polyline even after 3+ vertices. Labels were part of the schema with no UI. And the cross-tool click bug was a real (previously undiagnosed) blocker for any operator trying to refine geometry around existing shapes. This pass closes those gaps so the editor reads as trustworthy infrastructure rather than a sketchy prototype — which matters because geometry is reliability infrastructure: observation lineage, future findings, replay/shadow tests all depend on operators believing what they author is what gets persisted.

**ROI fill tiers — single hue, varying alpha.** Each tier ramps the fill alpha while keeping the same sage hue (`OVERLAY_COLORS.box`). Selected ROIs additionally get a brighter stroke (`#a7e3a8`) and a thicker border (3px vs 2px). Draft polygons fill at 3+ vertices with a 0.18 alpha (a touch dimmer than hover so it reads as "preview, not committed") — gives the operator a clear preview of the shape they'd commit if they hit Finish ROI right now.

**Whole-ROI drag mechanics.** `startWholeRoiDrag` snapshots the **original ROI at drag-start** (the `originalRoi` closure variable) and applies `translateRoi(originalRoi, dx, dy)` against the snapshot on every `pointermove`. Applying against the in-flight state would compound clamp-induced rounding errors across many moves and silently shrink the polygon — anti-pattern noted in the helper's JSDoc. Vertex pointerdown stops propagation so it never escalates to whole-shape drag.

**Label editing.** `<SelectedShapeCard>` renders nothing when nothing is selected; otherwise shows a kind badge (LINE/ROI), monospace id, vertex-count summary, and a `<input maxLength={GEOMETRY_LIMITS.maxLabelLen}>`. Typing fires `updateLineLabel(shapes, id, label)` or `updateRoiLabel(shapes, id, label)` from the model, marks dirty. The input is keyed by `selected.id` so React remounts it when the operator switches selection (otherwise focus + cursor would linger from the previous shape).

**Cross-tool gating.** Polygon, line stroke hit targets, line endpoint handles, ROI vertex handles all read `pointerEvents: interactive ? "auto" : "none"`. Cursor adapts (`move`/`grab` interactive, `default` otherwise). Hover events stay wired regardless of `interactive` — visible-only feedback during draw modes is harmless and the operator may want to know which polygon they're hovering. Draft elements (close-target on the first vertex) stay interactive because they belong to the active draft, not an existing shape.

**Files touched:**

- **Modified — model + tests** (`src/components/dashboard-next/geometry/`)
  - `geometry-editor-model.ts` — added `clampRoiTranslation`, `translateRoi` (both pure, both clamp to `[0, 1]`), `updateLineLabel`, `updateRoiLabel`. JSDoc on `translateRoi` flags the snapshot-not-in-flight invariant.
  - `geometry-editor-model.test.ts` — **+17 tests** (165 → 182). Bounding-box clamp tests on both axes, overshoot snapping, line-preservation under ROI translation, label updates preserve id+geometry, unknown id no-ops.
- **Modified — SVG**
  - `geometry-editor-svg.tsx` — added `hoveredRoiId` + `interactive` props; renamed `onRoiSelect` → `onRoiPointerDown` (now passes the event); added `onRoiHoverChange`; three-tier ROI fill; draft polygon fill at ≥ 3 vertices; pointer-events gating on every existing-shape hit target.
- **Modified — panel**
  - `geometry-editor-panel.tsx` — added `hoveredRoiId` state; new `startWholeRoiDrag` (snapshot-based) + `handleRoiPointerDown` router (gates by tool); new `handleLabelChange` routing to the right model helper; updated SVG wiring with all new props/callbacks; new `<SelectedShapeCard>` slotted between canvas and Hint.
- **Modified — docs**
  - `docs/dashboard-next.md` — new "P6-B3 — Visual Polish + Usability" subsection after P6-B2. Cover three new affordances + the bug fix + updated out-of-scope list.
  - `src/app/dashboard-next/README.md` — geometry row note updated.
  - `docs/commit-log.md` — this entry.

**Files NOT touched:**

- `src/lib/api/types.ts`, `src/lib/api/geometry.ts`, `src/lib/perception/geometry-schema.ts`, `actions.ts`, `frame-canvas.tsx`, server-side contract — schema, wire shape, validator, save action all unchanged.
- Existing line drawing/selection/endpoint-drag/delete flow — preserved verbatim.

**Verification:**

- `npm run lint` clean.
- `npx tsc --noEmit` clean.
- `npm test` — **182 passing across 11 files** (+17 new in `geometry-editor-model.test.ts`).
- `npm run build` — known limitation: page-data step fails locally without `NEXT_PUBLIC_*` env vars; compile + typecheck pass.
- Guard greps return nothing: no legacy dark classes in any geometry file, no drawing-library imports, no raw `rtsp:` / `srt:` / `mediamtx` / `service_role` strings.

**Manual verification (post-deploy):**

- `/dashboard-next/cameras/<id>/configure/geometry` renders; existing ROIs show with subtle fill + visible border + vertex dots.
- Hover an unselected ROI: fill brightens to 0.22; cursor reads `move`.
- Click an ROI: fill darkens to 0.34, border thickens + brightens, vertex handles appear, `<SelectedShapeCard>` slots in below the canvas.
- Click-drag the interior of a selected (or unselected) ROI: whole polygon follows the cursor; releasing commits; ROI never escapes `[0, 1]` even when dragged hard against the edge.
- Drag a vertex (selected ROI): only that vertex moves.
- Edit the selected shape's label: typing reflects in the input and marks dirty; saving persists; refresh shows the new label.
- Switch to Draw line / Draw ROI: clicking on an existing ROI now places a line endpoint / draft vertex instead of selecting the ROI.
- Save → revision bump in sidebar → refresh → all shapes + labels reload.
- Line authoring (drawing, selecting, endpoint drag, delete) still works.

**Follow-up:**

1. **P6-B live verification** — operator authors a real config (line + ROI + label edits + whole-shape drag), saves, confirms round-trip and revision bump on the deployed api-server.
2. **P6-C** — processor consumes saved geometry on its next session; Monitor surfaces "applied revision."
3. **P6-D** — end-to-end verification; reliability tab gets its first real signal (revision-of-observation lineage).
4. **P6-B4** (only if live verification surfaces blockers) — perception overlay context toggle, line direction toggle, undo/redo, refresh-frame button.

**Docs updated:** this commit-log entry, `docs/dashboard-next.md` (new P6-B3 section), `src/app/dashboard-next/README.md`.

---

## 2026-05-27 — P6-B2 hotfix: guard duplicate-vertex check on the empty draft

**Subject:** P6-B2 (commit `7f38d8b`) crashed on the very first click in Draw ROI mode with `TypeError: Cannot read properties of undefined (reading 'x')`. The duplicate-adjacent-vertex guard in `handleCanvasPointerDown` dereferenced `draft.points[draft.points.length - 1]` unconditionally, but `handleToolDrawRoi` initializes the draft with `points: []`, so the first click hit `points[-1]` → `undefined.x` → boom.

**Fix:** wrap the duplicate-adjacent check in `if (draft.points.length > 0) { … }`. Adding the first vertex now short-circuits past the check entirely (there's nothing to compare against on click #1) and falls through to the append branch.

**Why this wasn't caught by tests:** the editor model is pure and unit-tested; the panel's click handler is component code that node-env vitest can't exercise (no jsdom). The bug lived in the panel, not the model. The fix adds an inline comment so the next contributor doesn't reintroduce it.

**Files touched:**
- `src/components/dashboard-next/geometry/geometry-editor-panel.tsx` — single-block guard around the duplicate-check inside `handleCanvasPointerDown`. No behavior change for any click after the first.

**Verification:**
- `npm run lint` clean.
- `npx tsc --noEmit` clean.
- `npm test` — 165/165 (no test changes).
- Manual: open Draw ROI → click the frame → vertex appears, no console error.

**Docs updated:** this commit-log entry.

---

## 2026-05-27 — P6-B2: Polygon ROI authoring (draw / select / drag vertices / delete)

**Subject:** Extend the P6-B1 geometry editor with first-class polygon ROI authoring. Operators can now Draw ROI, click vertices on the latest frame, finish via button or by clicking the first vertex, drag individual ROI vertices, and delete ROIs — alongside the existing line authoring. ROI ids stay stable across edits (observation-lineage guarantee). The persistence boundary is unchanged: `editorStateToGeometryConfig` is still the only path to the wire shape, and the round-trip tests prove that editing lines preserves ROIs AND editing ROIs preserves lines.

**Why:** P6-B1 shipped line authoring with ROIs as read-only passthrough. ROI geometry is the substrate for half the processor's observation vocabulary (`processor.roi_occupancy`, `processor.zone_entered`, `processor.zone_exited`, `processor.dwell_*`), so authoring it from the dashboard is a prerequisite for P6-C's processor consumption and everything downstream — reliability findings, review queues, replay/shadow tests, version comparisons. The schema already supported it (the api-server's Pydantic `GeometryRoi` has been live since P6-A); P6-B2 wires the dashboard side.

**Selection model upgrade.** Replaced `selectedLineId: string | null` with `SelectedGeometry = { kind: "line"; id } | { kind: "roi"; id } | null` so the same selection drives both shape kinds. The toolbar's Delete button label adapts (`Delete line` / `Delete ROI` / `Delete`). Drag state stays separate from selection (tracked via window-level pointer listeners) — clicking a handle selects + starts dragging in one gesture.

**Drawing flow.** Click Draw ROI → tool switches → each click on the canvas adds a vertex → the SVG renders a solid polyline through placed vertices, a dashed segment from the last placed vertex to the cursor, and (at 3+ vertices) a faint close-back segment from cursor to the first vertex. The first vertex itself becomes a clickable close-target. Finish ROI button enables at 3+ vertices. **Escape** cancels the entire draft. **Backspace** removes the last vertex (low-cost, asked for as optional). On finish, the new ROI is appended, the tool switches back to Select, and the new ROI is auto-selected so Delete / drag are immediately available.

**Vertex drag.** Same mechanic as line endpoint drag: `onPointerDown` on a handle attaches window-level `pointermove` / `pointerup` / `pointercancel` listeners (mirroring `scroll-area.tsx` — no `setPointerCapture`), translates pointer coords to normalized via the canvas's `getBoundingClientRect` + `clampNormalized`, applies via `updateRoiPoint(state, roiId, vertexIndex, p)` from the model. The helper preserves ROI id / label / type / enabled across vertex edits — the api-server's `_reject_duplicate_ids` validator and the future observation-lineage guarantee both depend on this stability.

**ROI styling.** Editable ROIs use sage-green stroke + translucent fill from `OVERLAY_COLORS.box`, with a brighter sage when selected and a translucent fill bump. Unselected ROIs render quiet vertex dots so the polygon's geometry is visible without competing visually with selected shapes. Selected ROIs expose per-vertex drag handles (white-filled circles, sage ring, soft drop shadow). All sizing is in device pixels via percentages-not-viewBox — same pattern as the P6-B1 SVG fix, so circles stay circular at any frame aspect.

**No new validation.** `validateGeometryConfig` from `@/lib/perception/geometry-schema` already enforced every ROI rule the api-server's Pydantic models enforce: 3–64 vertices, normalized point bounds, slug-pattern IDs, ≤ 20 ROIs, ≤ 80-char labels, no duplicate ROI ids, no `type` other than `polygon`. P6-B2 simply exercises rules that P6-B1 already tested. Same validation flow: client-side before save, server-side inside the action as defense-in-depth.

**Files touched:**

- **Modified — model + tests** (`src/components/dashboard-next/geometry/`)
  - `geometry-editor-model.ts` — added `EditorTool` value `"draw-roi"`; added `SelectedGeometry` union; new helpers `createRoiId` (gap-filling slug, separate namespace from lines per Pydantic `_reject_duplicate_ids`), `createDefaultRoiLabel`, `createRoi`, `updateRoiPoint` (preserves id/label/type/enabled; out-of-range index is a silent no-op).
  - `geometry-editor-model.test.ts` — **+19 tests** (146 → 165). ROI id gap-filling, ROI/line id-namespace independence, `createRoi` defaults, `updateRoiPoint` preserves identity, vertex editing doesn't drop lines, unknown ROI id is a no-op, ROI-authoring round-trip via `editorStateToGeometryConfig`, ROI ids stable across multi-vertex edits.
- **Modified — SVG + panel**
  - `geometry-editor-svg.tsx` — full rewrite. `selectedLineId` prop replaced with `selected: SelectedGeometry`; `draft` split into `lineDraft` + `roiDraft`. ROIs render editable (sage palette, per-vertex handles on selection, quiet vertex dots otherwise). ROI draft renders polyline + cursor preview + close-back preview + clickable close-target on first vertex. Same percentages-not-viewBox approach as the existing line rendering.
  - `geometry-editor-panel.tsx` — added `Draw ROI` toolbar chip; added ROI draft state; added vertex drag via window listeners; unified Delete handler across `selected.kind`; toolbar shows `Finish ROI` + `Cancel` while drafting; Backspace pops last vertex; Hint copy adapts to tool + draft state + selection.
- **Modified — copy + docs**
  - `configure/page.tsx` — CTA description: "Draw and save counting lines and polygon ROIs on the latest frame."
  - `configure/geometry/page.tsx` — header tile body updated across all three branches (no-frame / `is_default` / saved) to mention ROIs.
  - `docs/dashboard-next.md` — added a "P6-B2 — Polygon ROI Authoring" section after "P6-B1". Updated the "Out of scope" list under P6-B1 (P6-B2 promoted to implemented, P6-B3 remains).
  - `src/app/dashboard-next/README.md` — geometry row in status table updated.
  - `docs/commit-log.md` — this entry.

**Files NOT touched:**

- `src/lib/api/types.ts`, `src/lib/api/geometry.ts`, `src/lib/perception/geometry-schema.ts`, the server-side contract — no schema or wire-shape changes. All rules + types from P6-A/P6-B Preflight already covered editable ROIs.
- `actions.ts` — `saveGeometryAction` already accepts any `GeometryConfig`; ROIs ride the same path lines do.
- `frame-canvas.tsx` — coordinate translation is shape-agnostic; nothing to change.

**Verification:**

- `npm run lint` clean.
- `npx tsc --noEmit` clean.
- `npm test` — **165 passing across 11 files** (+19 new in `geometry-editor-model.test.ts`).
- `npm run build` — known limitation: page-data step fails locally without `NEXT_PUBLIC_*` env vars; compile + typecheck pass.
- Repo-wide grep guards returned nothing:
  - No legacy dark classes in any geometry file.
  - No `fabric` / `konva` / `paper-js` / `d3-` imports — editor is still hand-rolled SVG.
  - No raw `rtsp:` / `srt:` / `mediamtx` / `service_role` strings.

**Manual verification (post-deploy):**

- `/dashboard-next/cameras/<id>/configure/geometry` renders.
- Existing lines + ROIs load.
- Switch to Draw ROI; click 3+ vertices; Finish ROI commits; ROI appears + auto-selects.
- Click the first vertex (after 3+ are placed) closes the polygon instead.
- Escape cancels a draft; Backspace pops the last vertex.
- Click a saved ROI polygon to select; vertex handles appear; drag a vertex; geometry updates live; release commits.
- Delete ROI removes only that ROI; other ROIs + all lines untouched.
- Line authoring still works (P6-B1 regression check); editing a line doesn't drop ROIs.
- Save: client validates → action runs → toast → sidebar revision bumps via `router.refresh()`.
- Refresh page after save → lines + ROIs reload.
- Invalid geometry (e.g. via a forged config that fails the slug regex) → inline validation list; action not called; local edits stay.
- No fake reliability metrics anywhere.

**Follow-up:**

1. **P6-B live verification** — save real line + ROI geometry against the deployed api-server; confirm round-trip on refresh; note any aesthetics or UX friction.
2. **P6-B3 polish** — undo/redo, label editing, line direction toggle, "Refresh frame" button, perception overlay as read-only context toggle.
3. **P6-C** — processor consumes saved geometry on next session; Monitor surfaces `applied revision`.
4. **P6-D** — end-to-end verification; reliability tab gets its first real signal (revision-of-observation lineage).

**Docs updated:** this commit-log entry, `docs/dashboard-next.md` (new P6-B2 section + P6-B1 "out of scope" trim), `src/app/dashboard-next/README.md` (status table row).

---

## 2026-05-27 — P6-B1 SVG rendering fix: visible lines + nicer endpoint handles

**Subject:** The geometry editor that shipped in `62cd5d5` rendered endpoint handles correctly but the lines connecting them were effectively invisible, and the handles themselves stretched into ovals at non-square frame aspect ratios. Rewrite `GeometryEditorSvg` to use percentages for positions and device pixels for sizes — no viewBox, no `non-scaling-stroke`. Style the handles as larger white-filled circles with colored rings, plus a soft drop shadow + inner dot when selected.

**Why — invisible lines:** the SVG used `viewBox="0 0 1 1"` plus `vectorEffect="non-scaling-stroke"` so a normalized `[0..1]` coordinate space would map directly. But `non-scaling-stroke` makes the `strokeWidth` value interpret in **device pixels** instead of user units, and the original widths were `0.004`/`0.006` — effectively zero. The endpoints rendered because their `r={0.014}` was in user units (no `vectorEffect` for radii), which scaled with the 1×1 viewBox; the connecting strokes never came through. The first-deploy operator caught this immediately ("we can draw lines now but we cant actually see the lines, just the end points").

**Why — stretched handles:** with `viewBox="0 0 1 1"` and `preserveAspectRatio="none"`, x and y scale independently to fill whatever rectangle the canvas slot occupies. A `<circle r="0.014">` at a 16:9 frame becomes an oval — taller than wide on portrait slots, vice versa on landscape. Visually awkward and worse the further the canvas drifts from square.

**Fix:** drop `viewBox` and `preserveAspectRatio` entirely. Use percentages for positions (`cx="50%"` etc. — referenced to the SVG's actual render rect) and device-pixel scalar sizes for radii and stroke widths. No coordinate scaling, no aspect-ratio distortion, no `vectorEffect` shenanigans. Circles stay circular; line widths read consistently regardless of canvas dimensions.

**Styling pass on handles:**

- Default: 9px white-filled circle with a 2.5px amber ring. Cursor `grab`.
- Selected: 11px circle, 3.5px brighter-amber ring (`#fde68a`), soft drop shadow via SVG `<filter>`, plus a 3px filled inner dot in the brighter amber. Reads as "this handle is the active drag target" without any layout shift.
- Hit-target line: 18px transparent stroke under the visible line so clicks near the stroke still select.
- Lines: 3px default / 4px selected, brighter amber when selected so the whole line + handle combo reads as a unit.
- Draft preview: existing dashed amber line plus a small filled anchor marker at the start point so the first-click position is obvious.

**Files touched:**

- `src/components/dashboard-next/geometry/geometry-editor-svg.tsx` — full rewrite. Same component API (props unchanged), all callers continue to work as-is. Header comment documents the coord-system rationale so the next contributor doesn't reintroduce the `viewBox` + `non-scaling-stroke` trap.

**Verification:**

- `npm run lint` clean.
- `npx tsc --noEmit` clean.
- `npm test` — 146 passing (no test changes; SVG is presentational and uncovered by node-env vitest).
- Manual: open the editor on any camera with a latest frame, switch to Draw line, click-click-click — the line stroke is now plainly visible at standard frame ratios; handles are round, larger, and the selected one lifts off the frame with a subtle shadow + inner dot.

**Docs updated:** this commit-log entry.

---

## 2026-05-27 — P6-B1: Latest-Frame Geometry Editor Foundation (line authoring, ROI passthrough, Server Action)

**Subject:** Turn the geometry preflight at `/dashboard-next/cameras/[cameraId]/configure/geometry` into a real editor. Operators draw, select, drag, and delete **counting lines** on top of the camera's latest frame and save them via `saveGeometryAction` wrapping `updateCameraGeometryConfig`. Polygon ROI authoring is deferred to P6-B2 — existing ROIs render read-only inside the editor and pass through saves unchanged via `editorStateToGeometryConfig`. The page is a two-column server layout: editor canvas + toolbar in the main column, server-rendered status panel + persistence-boundary card + collapsed raw-JSON disclosure in the sidebar.

**Why:** This is the first real authoring surface that produces geometry the processor will consume in P6-C. Building it on the existing P6-B Preflight foundation (`75960ee` + `3e98ed7`) means we already have the types, the schema validator, the API wrapper, the route placeholder, and the read-only sidebar panels. The work this commit adds is the editor brains, the canvas + SVG primitives, the Server Action, and the page wiring. Everything stays inside `/dashboard-next` — no legacy `/dashboard` changes, no promotion, no backend changes (the api-server's P6-A endpoints are already shipped).

**Persistence boundary preserved.** Editor-local state (tool, selection, draft line, drag state, dirty flag, save state) lives in the panel component and never leaves the browser. The only shape that round-trips to the api-server is `GeometryConfig` from `src/lib/api/types.ts`, built by `editorStateToGeometryConfig` from the model module. The api-server's `extra="forbid"` Pydantic config would reject any field that leaked, but the model is the boundary that prevents the leak in the first place. The ROI-preservation test in `geometry-editor-model.test.ts` is the load-bearing safety guarantee: editing lines does not drop ROIs from the saved config.

**Validation in two places.** `validateGeometryConfig` from `@/lib/perception/geometry-schema` runs client-side inside `handleSave` (keeps structurally broken saves off the network; renders inline `<ValidationList>`) AND server-side inside the action (defense-in-depth against forged payloads). Same source of truth — no inlined rules. The action returns issues in its result envelope so the call site can render them identically.

**Drag pattern.** Endpoint drags use the existing `scroll-area.tsx` precedent: `onPointerDown` on the handle attaches window-level `pointermove` / `pointerup` / `pointercancel` listeners that detach on release. No `setPointerCapture`. Coordinates translate through `getBoundingClientRect()` snapshotted at drag-start, then `clampNormalized` keeps them in `[0, 1]`.

**Probe-default behavior.** When the server returns `is_default: true` (the synthesized probe-default record from `GET /v1/cameras/{id}/geometry-config`), the editor opens empty — the model's `geometryConfigToEditorState(config, { ignoreDefault: true })` drops the synthesized lines + ROIs so operators author fresh geometry instead of inheriting scaffolding. The sidebar status panel still shows `r0 — Not configured yet` so the relationship between "save here" and "revision bumps to r1" stays explicit.

**Files touched:**

- **Added — geometry components** (`src/components/dashboard-next/geometry/`)
  - `geometry-editor-model.ts` — pure helpers + types. `EditorTool`, `NormalizedPoint`, `EditorShapesState`, `geometryConfigToEditorState` (with `ignoreDefault` for the probe-default case), `editorStateToGeometryConfig` (the ROI/frame passthrough boundary), `createLineId` (gap-filling slug generator), `createDefaultLineLabel`, `createLine`, `clampNormalized`.
  - `geometry-editor-model.test.ts` — 17 vitest tests. Round-trip preservation (with ROIs), ROI passthrough survives line edits, deleting a line removes only that line, slug-pattern compliance, gap-filling ID generator, label/id mirror, clamping.
  - `frame-canvas.tsx` — pure layout primitive. Image underlay with frame-aspect-ratio + 16/9 fallback, SVG slot, `getBoundingClientRect`-based pointer translation through `clampNormalized`, `touch-action: none`.
  - `geometry-editor-svg.tsx` — pure SVG renderer. Lines + endpoint handles + dashed draft preview, read-only ROI polygons (dimmer). `viewBox="0 0 1 1"` + `preserveAspectRatio="none"` so normalized coords map directly to canvas pixels. `vectorEffect="non-scaling-stroke"` everywhere.
  - `geometry-editor-panel.tsx` — Client Component brains. Owns tool / selection / draft / dirty / save state. Wires window-level drag listeners (mirroring `scroll-area.tsx`). Toolbar: Select / Draw line / Delete line / shape counts + dirty badge / Discard changes / Save. Inline `<ValidationList>` for save-time issues.
- **Added — Server Action**
  - `src/app/dashboard-next/(app)/cameras/[cameraId]/configure/geometry/actions.ts` — `saveGeometryAction(formData)`. Parses `camera_id` + `config` (JSON), re-runs `validateGeometryConfig` server-side, calls `updateCameraGeometryConfig`, `revalidatePath`s the editor route. Returns `{ ok: true, message, record } | { ok: false, message, issues? }`. Never throws into the UI.
- **Modified**
  - `src/app/dashboard-next/(app)/cameras/[cameraId]/configure/geometry/page.tsx` — rewritten. Server-side fetches `getCameraGeometryConfig` + `getLatestFrame`. Renders the back link + header tile + two-column grid (editor main / sidebar aside). The sidebar's `<StatusPanel>` distinguishes `r0 — Not configured yet` from `Operator-saved` + timestamps. `<NoFrameEmptyState>` renders in the main column when `latestFrame` is null (camera hasn't streamed yet). `<RawJsonDetails>` stays collapsed for engineers.
  - `src/app/dashboard-next/(app)/cameras/[cameraId]/configure/page.tsx` — CTA text "Open preflight" → "Open editor"; description updated to "Draw and save counting lines on the latest frame. ROIs come next in P6-B2."
  - `docs/dashboard-next.md` — new "P6-B1 — Latest-Frame Geometry Editor Foundation" section after "P6-B Preflight". Documents the editor module split, persistence boundary, probe-default behavior, validation flow, and out-of-scope items (P6-B2 ROIs, P6-B3 polish).
  - `src/app/dashboard-next/README.md` — geometry row in the status table updated to reflect the editor is live.
  - `docs/commit-log.md` — this entry.

**What's deliberately deferred:**

- Polygon ROI authoring (P6-B2). Existing ROIs render read-only and pass through unchanged.
- Live perception overlay as read-only context inside the editor (P6-B3).
- "Refresh frame" button — the underlay is server-rendered at page load and stays fixed during editing (P6-B3).
- Undo/redo (P6-B3).
- Line direction toggle in toolbar — every new line gets `direction: "any"` (P6-B3 adds the toggle).
- Label editing — new lines get an auto-generated `Line N` label (P6-B3).
- Component interaction tests — `vitest.config.ts` is `environment: "node"`; no jsdom installed. Coverage focuses on the pure helpers in `geometry-editor-model.test.ts`.

**Verification:**

- `npm run lint` clean.
- `npx tsc --noEmit` clean.
- `npm test` — 146 passing across 11 files (+17 new in `geometry-editor-model.test.ts`).
- `npm run build` — known limitation: page-data step fails locally without `NEXT_PUBLIC_*` env vars (same as prior commits). Compile + typecheck pass.
- Repo-wide grep guards returned nothing:
  - `git grep -nE 'className=.*\b(glass|text-accent|text-ink-|border-glass-stroke|bg-glass-bg)\b' src/components/dashboard-next/geometry/ src/app/dashboard-next/` — no legacy dark classes in the new files.
  - `git grep -nE '\b(rtsp:|srt:|mediamtx|service_role)\b' src/` — no secrets/raw URLs.
  - `git grep -n 'fabric\|konva\|paper-js' src/` — no drawing-library imports; the editor is hand-rolled SVG against the UpStream schema.

**Manual verification (post-deploy):**

- `/dashboard-next/cameras/<id>/configure` — CTA reads "Open editor" with updated description.
- `/dashboard-next/cameras/<id>/configure/geometry`:
  - **No latest frame**: `<NoFrameEmptyState>` in main column; sidebar still visible.
  - **Operator-saved + frame present**: editor loads with current lines; existing ROIs render dim/read-only; toolbar shows live shape counts.
  - **Probe-default + frame present (`is_default: true`)**: editor opens empty; sidebar status panel reads `r0 — Not configured yet`.
- Switch to Draw tool → click start point → cursor draws a dashed preview → second click finalizes the line; tool auto-switches back to Select; "unsaved" badge appears.
- Select a line by clicking its stroke; Delete line button enables.
- Drag an endpoint; handle follows cursor; line geometry updates live; release commits the new position.
- Delete the selected line; other lines unchanged.
- Save: client validates → action runs → toast "Geometry saved" → sidebar revision bumps via `router.refresh()`.
- Save with invalid geometry (e.g. a forged config that fails the slug regex): inline `<ValidationList>` shows; action not called; local edits stay.
- ROI preservation: load a camera with both ROIs and lines, edit a line, save, refresh — ROIs unchanged.
- No polygon ROI editing exposed (no vertex handles, no "Add ROI" tool).

**Follow-up:**

1. **P6-B live verification** — operator saves a real config against the deployed api-server; confirm revision bump + GET round-trip on refresh.
2. **P6-B2** — polygon ROI authoring (vertex add/move/delete, polygon close, min/max-vertex enforcement via `GEOMETRY_LIMITS`). The current passthrough becomes editable.
3. **P6-B3** — editor polish (undo/redo, refresh frame, perception overlay context toggle, line direction toggle, label editing).
4. **P6-C** — processor consumes saved geometry on next session. Dashboard surfaces "applied revision" in Monitor.
5. **P6-D** — end-to-end verification; reliability tab gets its first real signal (revision-of-observation lineage).

**Docs updated:** this commit-log entry, `docs/dashboard-next.md` (new P6-B1 section), `src/app/dashboard-next/README.md` (status table row).

---

## 2026-05-27 — P6-B Preflight UX fix: render unconfigured empty state instead of probe-default shapes

**Subject:** The preflight page rendered shape counts and the raw JSON inspector unconditionally, which surfaced the api-server's synthesized probe-default config (1 ROI + 1 line) as if it were operator-saved data on every fresh camera. Operator feedback: "It looks like maybe the shapes aren't sensitive to each camera — i am looking at a clean camera and it shouldn't have shapes or crossing lines but it says it has both." The shapes were the same on every clean camera because they were the system default. Branch the preflight on `is_default`: for unconfigured cameras (`is_default: true`, `revision: 0`) render an explicit "No geometry saved" empty state instead of the shape counts + JSON inspector; keep the raw record available behind a collapsed `<details>` for engineers verifying the contract. For operator-saved configs (`is_default: false`) render the full status banner + counts + JSON layout as before.

**Why:** The dashboard-facing `GET /v1/cameras/{id}/geometry-config` endpoint synthesizes a probe-default config (near-full-frame entry-ROI + horizontal entry-line) when a camera has never been configured — pure UI scaffolding so the dashboard always has a valid shape to render. The processor reads a *separate* endpoint (`/v1/internal/processor/eligible-sessions`) that returns `geometry_config: null` and the processor applies its **own** probe-default fallback (`../upstream-api-server/docs/api-contracts.md:978-984`). So the dashboard-facing default and the processor-facing default are independent — suppressing the former on the dashboard doesn't change runtime behavior. The reliability-layer framing is unambiguous: an unconfigured camera should look unconfigured. Rendering ghost data as if it were saved geometry is exactly what the reliability layer should prevent — it inflates trust in a camera that is, in product terms, not yet ready.

**What changed:**
- `src/app/dashboard-next/(app)/cameras/[cameraId]/configure/geometry/page.tsx` — branch the layout on `record.is_default`. Extracted `HeaderTile` (title + sub-line vary by config state). Added `UnconfiguredEmptyState` (amber ShieldAlert icon, "No geometry saved for this camera" copy, processor-fallback caveat, revision-bump explainer). Added `RawJsonDetails` (collapsed `<details>` disclosure for engineers; surfaces the synthesized probe-default raw record without putting it in front of operators). Simplified `GeometryStatusPanel` — it's now only invoked for operator-saved configs (`is_default: false`), so the dead `is_default` banner branch is gone.

**Why dashboard-only (not server-side):** The server-side fix — having the GET return empty `rois`/`lines` arrays or 404 when no save exists — is the right architectural cleanup but cross-repo (touches `upstream-api-server` Pydantic models and any other consumers). The dashboard-only fix is small, immediate, and honest, and does not change processor runtime. The server-side cleanup is a follow-up worth tracking.

**Files touched:**
- `src/app/dashboard-next/(app)/cameras/[cameraId]/configure/geometry/page.tsx` — single-file change. Roughly 80 LOC added (HeaderTile + UnconfiguredEmptyState + RawJsonDetails + branched render), 30 LOC simplified (GeometryStatusPanel dead branch removed).

**Verification:**
- `npm run lint` clean.
- `npx tsc --noEmit` clean.
- `npm test` — 129 passing (no test changes; this is presentational).
- Manual browser checks (post-deploy):
  - Clean camera (`is_default: true`): header reads "Geometry not configured yet"; empty state with ShieldAlert icon and explainer renders; shape counts and inline JSON inspector are gone; "Show raw record (debug)" disclosure exposes the underlying record on click.
  - Saved camera (`is_default: false`): unchanged — status banner with `r1+`, "Operator-saved" copy, timestamps, shape counts, inline raw JSON card.

**Follow-up (server-side, cross-repo, not in this commit):** Change `GET /v1/cameras/{camera_id}/geometry-config` on `upstream-api-server` to return `is_default: true` with empty `rois: []` and `lines: []` (or 404 `geometry_not_configured`) when no operator save exists. This makes the contract truthful: the dashboard wouldn't need to branch on `is_default`, and any other future consumer of this endpoint would see the same honest "nothing saved" signal. Requires Pydantic model adjustment (the probe-default synthesis lives in the geometry service layer; the schema needs to allow empty shape arrays for the unsaved path) and a check for any other readers besides the dashboard.

**Docs updated:** this commit-log entry.

---

## 2026-05-27 — P6-B Preflight: geometry types, schema validation, server-only API wrapper, read-only preflight route

**Subject:** Wire up the geometry data contract end-to-end before any drawing UI ships. TS mirrors of the `upstream-api-server` Pydantic geometry schema land in `src/lib/api/types.ts`. A pure validation module at `src/lib/perception/geometry-schema.ts` mirrors every server-side rule (slug pattern, point bounds, shape/label limits, duplicate-id rules, schema version, coordinate space) with 35 unit tests. A server-only API wrapper at `src/lib/api/geometry.ts` exposes `getCameraGeometryConfig` (GET) and `updateCameraGeometryConfig` (PUT) against the existing P6-A endpoints. A new read-only preflight page at `/dashboard-next/cameras/[cameraId]/configure/geometry/` renders the camera's real saved `GeometryConfigRecord` — revision banner, ROI/line counts, raw JSON inspector — with no drawing UI. The Configure tab gains a "Geometry editor → Open preflight" card linking into it. `CameraTabs` widens its active-state matching from exact to prefix so the Configure tab stays highlighted on `/configure/geometry`.

**Why:** P6-B is the latest-frame geometry editor; before any drawing code, the data contract must be proven against the real backend rather than guessed. Exploration found the geometry endpoints already exist as **P6-A** on `upstream-api-server` (`GET`/`PUT /v1/cameras/{camera_id}/geometry-config`, Pydantic source at `../upstream-api-server/src/upstream_api/schemas/geometry.py`, contract at `../upstream-api-server/docs/api-contracts.md` ~line 818) — so this pass aligns the dashboard with the real shapes instead of inventing parallel ones. The original task spec proposed `coordinate_space: "normalized_frame"`, `version` on the record, `applies_to_classes`, `a_to_b`/`b_to_a` direction values, a `/versions` list endpoint, and `CameraGeometrySpec`/`CameraGeometryVersion` type names — none of which match the real contract (which uses `"normalized"`, `revision`, `extra="forbid"` so `applies_to_classes` is 422-rejected, `"any"`/`"in"`/`"out"` directions, no versions endpoint, `GeometryConfig`/`GeometryConfigRecord`). The dashboard side follows the server.

**What's deliberately deferred:** no drawing tools, no canvas, no Server Action for PUT — the editor in P6-B owns the mutation UI surface and the optimistic/error/revalidate flow. No `listCameraGeometryVersions` wrapper because the server endpoint does not exist. No legacy `/dashboard` changes.

**Always-200 GET awareness:** the server returns a system probe-default `GeometryConfig` (near-full-frame entry ROI + horizontal entry line) with `is_default: true`, `revision: 0`, `id: null` when a camera has no operator save. There's no "no geometry yet" 404 branch — only `camera_not_found` (404) when the camera id is unknown or belongs to a different account. The preflight banner distinguishes "Probe default — no operator save yet" from "Operator-saved" so operators can tell which they're looking at.

**Files touched:**

- **Added**
  - `src/lib/api/geometry.ts` — server-only wrapper. `getCameraGeometryConfig` (unwraps `geometry_config` envelope); `updateCameraGeometryConfig` (PUT `{config: GeometryConfig}` body, returns the new record with `is_default: false` and `revision` bumped). Header comment documents the always-200 GET behavior, the missing versions endpoint, and the deferred Server Action.
  - `src/lib/perception/geometry-schema.ts` — pure validation. Exports `GEOMETRY_LIMITS`, `LINE_DIRECTIONS`, `GeometryValidationIssue`, `validateNormalizedPoint`, `validateGeometrySlug`, `validateGeometryLabel`, `validateGeometryRoi`, `validateGeometryLine`, `validateGeometryConfig`, `createGeometryValidationSummary`. Mirrors `_MAX_SHAPES=20`, `_MAX_ROI_POINTS=64`, `_MAX_LABEL_LEN=80`, line points exactly 2, ROI points ≥ 3, slug regex `^[a-z0-9][a-z0-9-]{0,63}$`, schema version 1, coordinate space `"normalized"`, duplicate-id rejection (ROI and line namespaces separate, matching server).
  - `src/lib/perception/geometry-schema.test.ts` — 35 tests. Covers every rule the api-server enforces, plus regression guards: a `direction: "a_to_b"` test catches the user's proposed-but-wrong value; a `coordinate_space: "normalized_frame"` test catches the proposed-but-wrong value.
  - `src/app/dashboard-next/(app)/cameras/[cameraId]/configure/geometry/page.tsx` — Server Component preflight. Fetches via `getCameraGeometryConfig`; 404 → `notFound()`. Renders: status banner (revision, `is_default` distinction, updated_at), shape counts (ROI / line totals + "≤ 20 of each" copy), roadmap card with the persistence warning, raw JSON inspector. No drawing tools, no save buttons, no editable inputs.
- **Modified**
  - `src/lib/api/types.ts` — appended a "Camera Geometry Config (P6-A)" section: `GeometryLineDirection`, `GeometryPoint`, `GeometryFrame`, `GeometryRoi`, `GeometryLine`, `GeometryConfig`, `GeometryConfigRecord`, `GeometryConfigResponse`, `GeometryConfigUpdateRequest`. Header comment cites Pydantic source + contract location.
  - `src/app/dashboard-next/(app)/cameras/[cameraId]/configure/page.tsx` — added the "Geometry editor → Open preflight" card at the top. Kept the existing P6-B/C/D roadmap bullets. Page now takes `params` to build the geometry href.
  - `src/components/dashboard-next/camera-tabs.tsx` — one-line widening of `active` from `pathname === href` to `pathname === href || pathname.startsWith(\`${href}/\`)` so sub-routes keep their parent tab highlighted. Inline comment notes that this is safe today because no tab href is a prefix of another, and to revisit if that overlap ever arises.
  - `docs/dashboard-next.md` — added a "P6-B Preflight — Geometry API + Schema Contract" section after "Shared perception lib": source-of-truth pointers, what's in place, always-200 GET awareness, persistence-boundary rationale, why versioning matters for reliability (observation lineage, findings provenance, replay/shadow tests), P6-C/P6-D outlook. Updated the camera-detail tabs table to add a Configure → Geometry row.
  - `src/app/dashboard-next/README.md` — appended the `/configure/geometry` row to the status table, calling out `getCameraGeometryConfig` as the source.
  - `docs/commit-log.md` — this entry.

**Verification:**

- `npm run lint` clean.
- `npx tsc --noEmit` clean.
- `npm test` — 129 passing (35 new in `geometry-schema.test.ts`), all 10 test files green.
- `npm run build` — known limitation: page-data step fails locally without `NEXT_PUBLIC_*` env vars (same as prior commits). Compile + typecheck pass.
- Repo-wide grep guards return nothing:
  - `git grep -nE 'className=.*\b(glass|text-accent|text-ink-|border-glass-stroke|bg-glass-bg)\b' src/components/dashboard-next/ src/app/dashboard-next/` — no legacy dark classes in the new files.
  - `git grep -nE '\b(rtsp:|srt:|mediamtx|service_role)\b' src/` — no secrets/raw URLs.
  - `git grep -nE '\b(applies_to_classes|a_to_b|b_to_a|normalized_frame|listCameraGeometryVersions|CameraGeometrySpec|CameraGeometryVersion)\b' src/` — guards against the original task proposal's wrong names sneaking back in alongside the real ones.
- Manual browser verification deferred to deploy preview:
  - `/dashboard-next/cameras/<id>/configure` renders; "Geometry editor → Open preflight" card visible at the top; existing P6-B/C/D roadmap bullets below.
  - Clicking "Open preflight" navigates to `/dashboard-next/cameras/<id>/configure/geometry`.
  - On the preflight: revision banner shows real `r0`/`r1+` + `is_default` distinction; ROI/line counts non-fake; raw JSON renders the real `GeometryConfigRecord`; back link returns to Configure.
  - For a never-configured camera: banner reads "Probe default — no operator save yet", `r0`, no timestamps (verifies always-200 contract).
  - Bad `cameraId`: renders the existing `not-found.tsx`.
  - Configure tab in the tab strip stays highlighted on both `/configure` and `/configure/geometry`.

**Follow-up — P6-B (actual editor):**

1. Add `src/app/dashboard-next/(app)/cameras/[cameraId]/configure/geometry/actions.ts` wrapping `updateCameraGeometryConfig` with a Server Action. Pattern: mirror `src/app/dashboard-next/(app)/api-tokens/actions.ts`. Call `validateGeometryConfig` from `@/lib/perception/geometry-schema` **before** the upstream call so authoring errors render inline.
2. Build `<FrameCanvas>` + `<GeometryEditorSvg>` under `src/components/dashboard-next/geometry/`. Working state is editor-local (selection, drag origin, undo); convert to `GeometryConfig` only at save time. `<PerceptionOverlaySvg>` from `@/lib/perception/overlay-svg` becomes a read-only "current detections" layer over the editor.
3. The preflight page evolves into the editor route — its read-only revision/JSON panels become a "current saved" sidebar; the canvas takes the main column.
4. After P6-B, P6-C lights up processor consumption (the `/v1/internal/processor/eligible-sessions` field already wire-carries `geometry_config`); P6-D verifies end-to-end.

**Docs updated:** this commit-log entry, `docs/dashboard-next.md` (new "P6-B Preflight" section + tabs table row), `src/app/dashboard-next/README.md` (status table row).

---

## 2026-05-27 — dashboard-next foundation: lift P5 to shared lib, port to /dashboard-next, refactor camera detail into tabbed workflow

**Subject:** Prepare `/dashboard-next` for P6-B (latest-frame geometry editor) without promoting or deleting legacy `/dashboard`. Three coordinated moves: (1) lift the pure perception helpers out of the legacy route directory into a shared `src/lib/perception/` module so both segments share them; (2) port the three P5 surfaces (latest-frame perception overlay P5-D, live perception overlay P5-E, recent observations panel P5-B) to dashboard-next with light-theme styling; (3) refactor `/dashboard-next/cameras/[cameraId]` into a tabbed workflow with persistent header (Monitor / Observations / Configure / Settings / Reliability) so the Configure tab becomes the explicit seam for the upcoming geometry editor.

**Why:** Audit found `/dashboard-next` is declared as the future target (`docs/dashboard-next.md:7`, full promotion checklist exists) but every recent piece of reliability-adjacent work — P5-A through P5-E — landed only on legacy `/dashboard`. Building P6-B on legacy would put the most reliability-relevant UpStream-owned UI on the segment slated for deletion. This pass closes the regression risk for promotion by porting P5 forward, and locks the camera-detail IA into a tab shape that reads as a workflow (monitor → configure → observe → reliability) rather than a single dense screen — exactly what the Reliability Layer's future surfaces need to slot into. P6-B is *not* implemented; the Configure tab is a placeholder with the four P6 milestones called out.

**Route policy locked in docs.** New product-facing dashboard work builds under `/dashboard-next`. Legacy `/dashboard` is bug-fixes only. Theme-agnostic perception helpers go under `src/lib/perception/`; new dashboard-next UI under `src/components/dashboard-next/`; new routes under `src/app/dashboard-next/(app)/`. Codified in `AGENTS.md`, `docs/dashboard-next.md` "Route policy", and `src/app/dashboard-next/README.md`.

**Shared perception module.** Three pure files moved from `src/app/dashboard/cameras/[cameraId]/` to `src/lib/perception/`:
- `perception-overlay.ts` → `overlay-helpers.ts` (24 tests)
- `perception-overlay-svg.tsx` → `overlay-svg.tsx` (8 tests)
- `summarize-observation.ts` → `summarize-observation.ts` (23 tests)

The route-dir placement was historical, not architectural. The legacy `/dashboard/cameras/[id]` page and its three remaining mock-based tests keep working transparently — their imports moved from `./perception-overlay` to `@/lib/perception/overlay-helpers`, etc. Tests colocated with the moved code.

**Additive slots on `LiveStreamPlayerNext` / `LiveStreamPanelNext`.** The next variants were missing the `overlay?: ReactNode` prop and `renderStreaming?: (session) => ReactNode` render-prop that the legacy player/panel carry. Added both, defaulting to undefined so today's call site (`cameras/[cameraId]/page.tsx` → `cameras/[cameraId]/monitor/page.tsx`) is unaffected when neither is passed. The overlay slot stacks between the `<video>` and the connection-state scrim so reconnect/needs-gesture/fail messages still occlude the perception SVG.

**Three new dashboard-next components.** `LatestFramePerceptionOverlayNext`, `RecentObservationsPanelNext`, and `LivePerceptionOverlayNext` mirror their legacy counterparts' data flow exactly — same SWR keys, same poll cadences (5 s opt-in for the first two, 1 s default-on for the live overlay), same 404 handling, same toggle semantics. JSX restyled against `.dn-tile`/`--dn-text-50`/`--dn-creek-mid`/`--dn-creek-deep` tokens. All three reuse the shared `<PerceptionOverlaySvg />` unchanged. No new tests for the next variants — the moved helpers stay covered by the relocated unit tests, and the next-side components are JSX shells around the same logic; adding parallel tests would triple maintenance through promotion.

**Tabbed camera-detail workflow.** New shape under `src/app/dashboard-next/(app)/cameras/[cameraId]/`:
- `layout.tsx` (new) — persistent header (back link, eyebrow, name, `CameraStreamStatusBadgeNext`, copy id), `CameraDetailRealtimeNext`, and `CameraTabs`. Layout owns the lightest fetches (`getCamera` + `listStreamSessions(limit:1)`) so the header + Realtime have what they need; per-tab fetches live in each tab.
- `page.tsx` (rewritten) — 12-line redirect to `./monitor`, so bare camera URLs still resolve.
- `monitor/page.tsx` (new) — lifts today's body. Adds `LatestFramePerceptionOverlayNext` and threads `LivePerceptionOverlayNext` through the new `renderStreaming` slot.
- `observations/page.tsx` (new) — server-renders the default unfiltered observations and hands them to `RecentObservationsPanelNext`.
- `configure/page.tsx` (new) — static placeholder naming P6-B/C/D milestones. No API calls, no fake editor.
- `settings/page.tsx` (new) — read-only camera metadata (`CameraMetaPanel`), identifiers, and timestamps.
- `reliability/page.tsx` (new) — stub. No fake data; explains it'll surface findings once backend signals exist.

Reusing the `Realtime` listener in `layout.tsx` (rather than `monitor/page.tsx`) is the load-bearing choice: navigating Monitor → Observations preserves session-state pushes instead of silently killing them until the next manual nav. The session-state badge in the header continues to react on every tab.

**Tab strip.** New `src/components/dashboard-next/camera-tabs.tsx` — Client Component, `usePathname()` for active state, hardcoded segments, dn-tokens only (active = `bg-white text-black font-bold dn-glow-soft`; inactive = `text-white/70 hover:bg-white/10`).

**Shared panels extracted.** `CameraMetaPanel`, `AgentPanel`, `ValidationPanel`, `SessionPanel` moved from inline functions in the old `cameras/[cameraId]/page.tsx` into `src/components/dashboard-next/camera-panels.tsx` so Monitor and Settings share `CameraMetaPanel` without duplicating JSX.

**Files touched:**
- **Added:** `src/lib/perception/{overlay-helpers,overlay-svg,summarize-observation}.{ts,tsx}` + colocated tests; `src/components/dashboard-next/{latest-frame-perception-overlay-next,recent-observations-panel-next,live-perception-overlay-next,camera-tabs,camera-panels}.tsx`; `src/app/dashboard-next/(app)/cameras/[cameraId]/{layout,monitor/page,observations/page,configure/page,settings/page,reliability/page}.tsx`.
- **Modified:** `src/components/dashboard-next/{live-stream-player-next,live-stream-panel-next}.tsx` (additive slots); `src/app/dashboard-next/(app)/cameras/[cameraId]/page.tsx` (now a redirect); legacy `src/app/dashboard/cameras/[cameraId]/{latest-frame-perception-overlay,live-perception-overlay,recent-observations-panel,page}.tsx` (import paths updated to `@/lib/perception/*`); `AGENTS.md`, `docs/dashboard-next.md`, `src/app/dashboard-next/README.md`.
- **Deleted:** `src/app/dashboard/cameras/[cameraId]/{perception-overlay,perception-overlay-svg,summarize-observation}.{ts,tsx}` + their colocated tests (moved to `src/lib/perception/`).

**Out of scope (deliberate):**
- No promotion of `/dashboard-next` → `/dashboard`; no deletion of legacy.
- No P6-B drawing tools — Configure is placeholder only.
- No reliability data plumbing — Reliability tab is stub only.
- No new dashboard-next variants of `EmptyState` / `PageHeader` — those use prod tokens and are imported by legacy. Inlined empty blocks in the new components instead. Revisit on promotion.

**Verification:**
- `npm run lint` clean.
- `npx tsc --noEmit` clean.
- `npm test` — 94 passing across 9 files (no test count change; relocated helpers now under `src/lib/perception/`).
- `npm run build` compiles + typechecks cleanly; page-data collection fails locally without `NEXT_PUBLIC_*` env vars — same known limitation called out in prior commit-log entries, not caused by this work.
- Legacy-class grep across new dashboard-next files (`glass`, `text-accent`, `text-ink-*`, `border-glass-stroke`, `bg-glass-bg`) returns nothing.
- Secrets/raw-URL grep (`rtsp:`, `srt:`, `mediamtx`, `service_role`) returns nothing.
- Manual browser verification to be done post-deploy on `/dashboard-next/cameras/<id>/{monitor,observations,configure,settings,reliability}`: tab strip routes, header + Realtime persistence, perception overlay over live video, perception overlay over latest frame, observations rows + JSON expand, Configure placeholder, Settings read-only metadata, Reliability stub.

**Next milestone:** P6-B latest-frame geometry editor at `/dashboard-next/cameras/[cameraId]/configure/geometry/`. The Configure tab is the seam. Preflight: contract `PUT/GET/GET /v1/cameras/{id}/geometry[/versions]` with `upstream-api-server`; add `src/lib/api/geometry.ts` + `src/lib/perception/geometry-schema.ts` (UpStream-owned constraints) so no drawing library's mutable state ever becomes the persistence shape.

**Docs updated:** this commit-log entry, `AGENTS.md` (Route policy bullet under dashboard-next section), `docs/dashboard-next.md` (Route policy section + new "Camera detail — workflow tabs" section + updated route-structure tree + new "Shared perception lib" section), `src/app/dashboard-next/README.md` (status table now lists five camera-detail sub-routes + pointer to canonical docs).

---

## 2026-05-21 — P5-E cleanup: fix LiveStreamPlayer hydration mismatch, tighten live overlay poll

**Subject:** Two fixes from the P5-E deployed verification round. (1) `<LiveStreamPlayer />` no longer throws a React #418 hydration mismatch when the camera detail page is hard-refreshed while the camera is streaming. (2) The live perception overlay now polls every 1 s instead of 2 s.

**Why — #418:** the player initialized its state with `useState(() => typeof RTCPeerConnection === "undefined" ? "unsupported" : "connecting")`. `RTCPeerConnection` doesn't exist during SSR, so the server rendered the "WebRTC unavailable" tree while the client rendered the `<video>` tree — a structural hydration mismatch. React recovered by re-rendering the subtree client-side, so the UI worked, but it logged an error every load. This was a pre-existing latent bug in the player (it predates P5-E); P5-E's test procedure — hard-refresh while streaming — is what exposed it. Fix: initialize deterministically to `"connecting"`, and probe WebRTC support client-side inside the async connection attempt (`attempt$`), where it can never diverge from the server render.

**Why — poll cadence:** P5-E shipped at a 2 s poll; the processor publishes perception at ~1 FPS, so 1 s matches the source's freshness without out-pacing it. This is still a polled "latest snapshot" overlay — it is **not** frame-synchronized with the video and cannot be without a per-frame metadata channel (a future milestone; needs processor work). 1 s simply reduces the visible lag.

**Files touched:**
- `src/components/stream/live-stream-player.tsx` — deterministic initial state; WebRTC-support probe moved into `attempt$`.
- `src/components/stream/live-stream-player.test.tsx` (new) — 2 tests: SSR renders the video tree (not the "unsupported" branch), and the `overlay` slot renders.
- `src/app/dashboard/cameras/[cameraId]/live-perception-overlay.tsx` — `LIVE_OVERLAY_POLL_MS` 2 s → 1 s.
- `docs/architecture.md` — polling-intervals row updated to 1 s.

**Verification:** `npm run lint` clean · `npx tsc --noEmit` clean · `npm run test` 94 passing (2 new) · `git diff --check` clean · `next build` compiles + typechecks clean. Browser re-verification (no #418 on hard-refresh while streaming) to be done post-deploy.

**Docs updated:** this commit-log entry, `docs/architecture.md`.

---

## 2026-05-21 — P5-E: Live stream perception overlay on camera detail

**Subject:** Added a live perception overlay — the P5-C latest perception snapshot drawn over the **live WebRTC video** on the camera detail page. It reuses the P5-D `PerceptionOverlaySvg` renderer and `perception-overlay.ts` helpers unchanged, feeding the SVG into the live player through a new generic `overlay` slot. Same show/hide toggles (boxes, labels, geometry), confidence filter, manual Refresh and a "Live" poll (default on, 2 s). The P5-D latest-frame overlay is untouched and still present.

**Why:** P5-D let an operator see perception on a still frame; P5-E puts it on the live feed so they can watch detections and geometry against motion in near-real-time. This is a *practical* first live overlay — it polls the latest snapshot (the processor upserts at ~1 FPS), so the overlay can lag the video by up to the poll interval + latency. It is explicitly **not** frame-synchronized metadata; no WebRTC metadata channel / WebSocket / SSE was added.

**Single WebRTC connection:** the overlay does not open a second stream. `<LiveStreamPlayer />` gained a generic, perception-agnostic `overlay?: ReactNode` slot rendered absolutely over the `<video>` (beneath the connection-state scrim, `pointer-events-none`). `<LiveStreamPanel />` gained an optional `renderStreaming` render-prop so a caller can wrap the live player for the `streaming` state without the panel knowing anything about perception. The new `LivePerceptionOverlay` owns the snapshot fetch + toggle state, passes the SVG into that slot, and renders the controls/freshness card below.

**Frontend/backend split:** unchanged from P5-D — the backend snapshot stays *data only* (frame dims, bboxes, labels, track ids, confidence, geometry points). All overlay styling lives in the dashboard (`OVERLAY_COLORS`). No persisted style settings, no backend-driven colors, no style editor.

**Alignment:** the live `<video>` box is fixed 16:9 (`aspect-video`); the SVG `viewBox` is the snapshot frame (1280×720 = 16:9 in the verified P5-C data) with `preserveAspectRatio="xMidYMid meet"`, so it fills the same box exactly. Limitation: a snapshot whose aspect ratio is not 16:9 will letterbox within the video box and drift from a stretched video — acceptable for a v1 polled overlay; documented.

**Files touched:**
- `src/components/stream/live-stream-player.tsx` — added the generic `overlay?: ReactNode` slot over the video. No change to WebRTC behavior.
- `src/components/stream/live-stream-panel.tsx` — added the optional `renderStreaming` render-prop for the `streaming` state; every other state is unchanged.
- `src/app/dashboard/cameras/[cameraId]/live-perception-overlay.tsx` (new) — `"use client"`; SWR-polls the P5-C endpoint, owns toggle state, wraps `<LiveStreamPlayer />` and renders the controls/freshness card.
- `src/app/dashboard/cameras/[cameraId]/page.tsx` — passes `renderStreaming` into `<LiveStreamPanel />`, handing the already-fetched `latestPerception` in as the overlay's initial data.
- `live-perception-overlay.test.tsx` (new) — 7 tests.

**Reuse:** `PerceptionOverlaySvg`, `perception-overlay.ts` (`normalizeSnapshot`, `selectOverlayObjects`, `hasFrameDimensions`, `buildLatestPerceptionPath`, `CONFIDENCE_THRESHOLDS`) and `LatestPerception*` types are reused as-is — no duplication of bbox/geometry drawing logic.

**Verification:**
- `npm run lint` clean. `npx tsc --noEmit` clean. `git diff --check` clean.
- `npm run test` — 92 passing (7 new): live player + SVG render when a snapshot is present; no-snapshot / no-objects / missing-dimensions / API-error branches; controls always render; correct proxy path requested. `LiveStreamPlayer` is stubbed in the test (its real RTCPeerConnection path renders an "unsupported" branch in a node env).
- `next build` compiles + typechecks cleanly; the page-data step needs runtime env vars absent locally, so it stops on a pre-existing unrelated page — not a P5-E defect.
- Browser verification to be done post-deploy on the `/dashboard` camera detail page.

**Docs updated:** this commit-log entry, `docs/architecture.md` (polling-intervals table).

---

## 2026-05-21 — P5-D: Latest-frame perception overlay on camera detail

**Subject:** Added a "Perception Overlay" card to the camera detail page. It draws the latest perception snapshot (P5-C endpoint `GET /v1/cameras/{cameraId}/perception/latest`) on top of the latest captured frame: object bounding boxes with `label #track · roi · confidence` chips, ROI polygons and the entry line. The card has show/hide toggles for boxes, labels and geometry, a minimum-confidence filter, a manual Refresh and an opt-in 5 s "Live" poll. It is a separate card — the existing `<LatestFrameCard />` is untouched.

**Why:** P5-C made the processor's visual state (detections + geometry) readable via the API, but operators could only inspect it as raw JSON. P5-D is the visual layer: an operator can now *see* what the processor sees on a still frame. This is deliberately a latest-frame overlay only — live WebRTC overlay (P5-E) and dashboard-driven geometry editing (P6) are out of scope.

**Frontend/backend split:** the backend snapshot stays *data only* — frame dimensions, bbox coordinates, labels, track ids, confidence, geometry points. All presentation (box colors, stroke weight, label styling, opacity, show/hide state) lives in the dashboard. `OVERLAY_COLORS` in `perception-overlay.ts` is the single source of overlay styling; the api-server and processor are not touched.

**Rendering approach:** a `relative` container whose CSS `aspect-ratio` is set from the snapshot's frame dimensions, holding the frame `<img>` (`object-cover`) and an absolutely-positioned `<svg>` whose `viewBox` is `0 0 frame.width frame.height`. Shapes are drawn in raw snapshot pixels and the browser scales them; strokes use `vector-effect="non-scaling-stroke"` for constant on-screen weight. Limitation: if the latest frame's resolution differs from the snapshot's `frame` dimensions the overlay can drift — acceptable for a v1 still-frame overlay.

**Files touched:**
- `src/lib/api/types.ts` — added `PerceptionPoint`, `PerceptionBBox`, `PerceptionObject`, `PerceptionGeometryRoi`, `PerceptionGeometryLine`, `LatestPerceptionPayload`, `LatestPerceptionRecord`, `LatestPerceptionResponse`. The `snapshot` payload is opaque JSONB server-side, so the nested types are treated as best-effort and normalized defensively before use.
- `src/lib/api/perception.ts` (new) — `getLatestPerception({ accountId, cameraId })`, a server-only `serverFetch` wrapper that returns `null` on 404 / `perception_snapshot_not_found` (same posture as `getLatestFrame`).
- `src/app/dashboard/cameras/[cameraId]/perception-overlay.ts` (new) — pure helpers (no React, no I/O): `normalizeSnapshot` (coerces the JSONB payload, never throws), `resolveBBox` (pixel bbox, else `bbox_normalized` × frame dims, else `null`), `selectOverlayObjects`, `formatObjectLabel`, `confidencePercent`, `pointsToAttr`, `centroid`, `OVERLAY_COLORS`, `CONFIDENCE_THRESHOLDS`.
- `src/app/dashboard/cameras/[cameraId]/perception-overlay-svg.tsx` (new) — `PerceptionOverlaySvg`, a pure presentational `<svg>` (no hooks, no fetching) so it is directly unit-testable.
- `src/app/dashboard/cameras/[cameraId]/latest-frame-perception-overlay.tsx` (new) — `"use client"` card; server-rendered initial frame + snapshot, `useUpstreamList` for refresh/poll, local toggle state. No `accountId` prop — the proxy injects account scoping.
- `src/app/dashboard/cameras/[cameraId]/page.tsx` — fetches the initial snapshot inside the existing `Promise.all` and renders the overlay card below the latest-frame grid.
- `perception-overlay.test.ts` + `perception-overlay-svg.test.tsx` + `latest-frame-perception-overlay.test.tsx` (new) — 39 tests.

**Verification:**
- `npm run lint` clean. `npx tsc --noEmit` clean. `git diff --check` clean.
- `npm run test` — 85 passing (39 new): helper coercion / bbox fallback / label formatting / geometry helpers; SVG rendering across toggle and confidence-filter combinations; card state branching (frame + snapshot / no frame / no snapshot / no objects / frame error / missing dimensions / toolbar) via `renderToStaticMarkup`.
- `next build` compiles and typechecks cleanly; the build's page-data step needs runtime env vars not present locally, so it stops on an unrelated pre-existing page — not a P5-D defect.
- Interactive tests (clicking toggles / Refresh, changing selects) are deferred — they would need `jsdom` + `@testing-library/react`, out of scope. Toggle *behavior* is instead covered by rendering the pure `PerceptionOverlaySvg` with each toggle off. Browser verification to be done post-deploy on the dashboard.

**Docs updated:** this commit-log entry, `docs/architecture.md` (polling-intervals table).

---

## 2026-05-21 — P5-B: Recent Observations panel on camera detail

**Subject:** Added a "Recent Observations" panel to the bottom of the camera detail page. It reads the P5-A endpoint `GET /v1/cameras/{cameraId}/observations/recent` through the existing `/api/upstream` proxy and shows recent processor observations (line crossings, ROI occupancy, zone transitions, dwell) in a table — timestamp, type, a one-line summary, short stream-session id, short processor id, and a per-row raw-JSON expand/collapse. Toolbar has a type filter (all + the 7 P4 types), a 25/50/100 limit selector, a manual Refresh, and an opt-in 5 s "Live" polling toggle.

**Why:** P5-A made observations readable via the API, but operators still had to use a browser-console `fetch` or curl to see them — the blind-testing pain point P5 set out to fix. This is the UI for it. No video overlays / bounding boxes / geometry editor — that is deferred to P5-C.

**Files touched:**
- `src/lib/api/types.ts` — added `ObservationType`, `ObservationRecord`, `RecentObservationsResponse`. `ObservationRecord.type` stays a plain `string` (the column is open-vocabulary server-side) so an unknown type never breaks a read.
- `src/lib/api/observations.ts` (new) — `listRecentObservations({ accountId, cameraId, type?, limit? })`, server-only `serverFetch` wrapper matching `validations.ts` / `snapshots.ts`.
- `src/app/dashboard/cameras/[cameraId]/summarize-observation.ts` (new) — pure helpers: `summarizeObservation` (defensive per-type one-line summary, never throws on a malformed payload), `buildRecentObservationsPath`, and the `OBSERVATION_TYPES` / `OBSERVATION_LIMITS` / `DEFAULT_OBSERVATION_LIMIT` constants.
- `src/app/dashboard/cameras/[cameraId]/recent-observations-panel.tsx` (new) — `"use client"` panel; server-rendered initial rows + `useUpstreamList` for refresh/poll. `fallbackData` is key-scoped to the default (unfiltered) SWR key so a filtered view never flashes unfiltered rows. No `accountId` prop — the proxy injects account scoping, same as `LatestFrameCard`.
- `src/app/dashboard/cameras/[cameraId]/page.tsx` — fetches initial observations inside the existing `Promise.all` (404-tolerant `.catch`, same posture as the agent/validations fetches) and renders the panel as a full-width section at the bottom.
- `summarize-observation.test.ts` + `recent-observations-panel.test.tsx` (new) — 27 tests.

**Verification:**
- `npm run lint` clean.
- `npx tsc --noEmit` clean.
- `npm run test` — 46 passing (27 new): `summarizeObservation` across all 7 types + missing/malformed payloads + unknown types; `buildRecentObservationsPath`; panel rendering (rows / empty / error / toolbar) via `renderToStaticMarkup`.
- Interactive tests (clicking Refresh, toggling JSON, changing the selects) are deferred — they would need `jsdom` + `@testing-library/react`, out of scope for this change. Covered instead by the manual checklist below.
- Manual (post-deploy): open a camera detail page, confirm the panel loads observations, the type filter narrows rows (`processor.zone_exited` shows the empty state — live count is 0), the limit selector changes row count, Refresh re-fetches, the Live toggle polls, and raw-JSON expand/collapse works.

**Docs updated:** this commit-log entry.

---

## 2026-05-21 — Fix infinite render loop in RelativeTime (Maximum update depth)

**Subject:** `src/components/data/relative-time.tsx` drove React into "Maximum update depth exceeded" on dashboard-next pages that render time labels. The component's `useSyncExternalStore` used `getSnapshot = () => Date.now()` — an **uncached snapshot**. React re-invokes `getSnapshot` after every commit to detect external store changes; because `Date.now()` returns a fresh value on every call, React never saw a stable snapshot and re-rendered forever. Fixed by making the snapshot a cached counter that only changes when the 30s interval fires.

**Why it surfaced now:** `RelativeTime` is shared with the live `/dashboard`, where it had been getting away with it — the bug only triggers when a render+commit cycle straddles a 1 ms boundary (so the two `Date.now()` calls differ). The old dashboard's lighter render usually completes inside a single millisecond. dashboard-next's heavier shell (five `backdrop-filter: blur()` orbs, the cursor-glow pointer tracker, the custom scroll area) makes renders slower, so the straddle became reliable and the latent bug turned into a hard loop. It is rendered across dashboard-next via `AgentCard`, `SessionsTable`, `TokensTable`, and `LatestFrameCard` — i.e. the Agents, Stream Sessions, API Tokens, and Camera Detail pages.

**Fix:** the 30s ticker is now a proper external store. A module-level `tickCount` is incremented only by the shared `setInterval`; `getSnapshot` returns `tickCount` (stable between ticks, so React stops re-rendering); `getServerSnapshot` returns a `-1` sentinel so SSR + hydration render the deterministic absolute time and the client swaps to relative once after hydration. One shared interval is lazily created on first subscribe and torn down when the last `<RelativeTime />` unmounts.

**Files touched:**
- `src/components/data/relative-time.tsx` — replaced `getSnapshot = () => Date.now()` with a cached-counter external store. Behavior is unchanged (absolute on SSR, relative after hydration, refresh every 30s); only the snapshot is now stable. The fix also hardens the live `/dashboard`, which renders the same component.

**Verification:**
- `npm run lint` — clean.
- `npm run build` — clean.
- Functional check (deploy preview): the Agents / Stream Sessions / API Tokens / Camera Detail pages of dashboard-next render without "Maximum update depth"; relative timestamps still tick every 30s.

---

## 2026-05-20 — dashboard-next audit + documentation pass

**Subject:** Follow-up to yesterday's wire-up. Audited the new segment for genuine bugs, code-quality lapses, and documentation gaps now that it's fully wired and is the target for promotion. Real issues fixed: the sidebar Sign Out button was presentational; the AgentCard "View" pill went to `href="#"` (no agent detail page in either dashboard); a stale WIRE-UP comment in `camera-card.tsx` still claimed the View link was unwired; the home page's Minutes UsageMeter hard-coded `value={0}` which read as "measured zero usage" when really there is no usage endpoint; the WHEP player's eslint-disable lacked a rationale; `proxy.ts` PUBLIC_PATHS deserved a comment about prefix semantics. Documentation: created `docs/dashboard-next.md` as the canonical reference (architecture, theme, Realtime channel naming, shared modules, token security, promotion checklist), and trimmed `src/app/dashboard-next/README.md` to a status table that points there. AGENTS.md and `docs/architecture.md` now acknowledge the parallel deployment and the dashboard-next sibling components.

**Why:** asked for explicitly — audit the entire dashboard for errors, problems, and unprofessional code, and add docs explaining it. Audit was via two parallel Explore subagents; findings filtered against re-reads of the actual source (one of the agents flagged a non-issue — `<form action={onSubmit}>` with `onSubmit(form: FormData)` is the React 19 / Next 16 idiom, not a bug — and that was filed as a false positive).

**Files touched:**
- `src/components/nav/sidebar-next.tsx` — wired Sign Out: `POST /api/auth/sign-out` then hard-redirect via `window.location.href = "/dashboard-next/login"`, mirroring `src/components/nav/topbar.tsx`. Disabled-while-pending. Updated header comment to reflect what's wired vs. inert (the "Coming soon" placeholders are still inert, which is honest).
- `src/components/dashboard-next/agent-card.tsx` — removed the dead `<Link href="#">View</Link>`. There's no agent detail page in either dashboard; an inert pill is worse than no pill. The card already conveys every field at a glance.
- `src/components/dashboard-next/camera-card.tsx` — updated the file header (View link is now wired to the detail route) and the thumbnail comment (the placeholder is intentional; the real frame lives on the detail page via `LatestFrameCardNext` to avoid one signed-URL call per card per list render).
- `src/components/dashboard-next/usage-meter.tsx` — `value: number | null`. When null, render `—` for the numerator and keep the bar flat with a muted track. Documented in the file header.
- `src/components/dashboard-next/home-overview-client.tsx` — passes `value={null}` to the Minutes meter with an inline comment explaining the missing consumption endpoint (the cap `monthly_minutes_quota` exists; usage doesn't).
- `proxy.ts` — added a comment above `PUBLIC_PATHS` explaining the exact-or-prefix-with-slash semantics: any path added auto-opens every subpath under it. Important for future nested public flows (e.g. `/dashboard-next/login/confirm-email`).
- `src/components/dashboard-next/live-stream-player-next.tsx` — expanded the `// eslint-disable-next-line react-hooks/exhaustive-deps` comment with the *why* (mutable refs and the stable `teardown` callback are intentionally excluded; including them would re-negotiate WHEP on every state change).
- `src/lib/api/accounts.ts` — JSDoc on both functions explaining what they return and that account scoping is enforced via `serverFetch`.
- `src/components/stream/player-state-event.ts` — added a "Shared module" header note: both `/dashboard` (dark) and `/dashboard-next` (light) import this. Same for `src/lib/webrtc/whep-client.ts`. Each header points to `docs/dashboard-next.md` "Shared modules" for the relocation plan.
- `src/components/dashboard-next/token-create-dialog-next.tsx` — JSDoc on the exported component spelling out the plaintext-wipe contract (the five paths) and cross-linking `docs/architecture.md` "Token plaintext hygiene" + `docs/dashboard-next.md` "Token security".
- `src/app/dashboard/cameras/[cameraId]/camera-detail-realtime.tsx` and `src/components/dashboard-next/camera-detail-realtime-next.tsx` — comments on the channel-name string explaining the `camera:` vs `dn-camera:` divergence and pointing at the canonical doc.
- `AGENTS.md` — added a "dashboard-next (parallel redesign)" section above "Source of truth for API contracts" and a "Scoped light theme for dashboard-next" bullet under "Stack notes". Updated the Realtime convention bullet to mention both `camera-detail-realtime.tsx` files.
- `docs/architecture.md` — added a "Parallel deployment" subsection under "Place in the platform"; expanded the "Live playback" section with a two-implementations note (same `whep-client.ts`, same `player-state-event.ts`); fixed the stale "Real-time via Supabase channels" out-of-scope bullet that predated the camera detail page.
- `src/app/dashboard-next/README.md` — trimmed. Kept the intro, the route status table, and the sanctioned-surface list. Theme, Realtime, shared modules, and promotion checklist are now one-line pointers to `docs/dashboard-next.md` — single source of truth, no duplication to go stale.
- `docs/dashboard-next.md` (NEW, ~280 lines) — the canonical reference. Sections: Purpose & status, Architecture (segment scope, route structure, layout flow), Data flow (three patterns with a per-route table), Camera detail, Token security (with the full wipe matrix), Theme system (token glossary + how-to-add), Realtime channel naming convention, Shared modules, Auth routing, Placeholder tiles, and the **authoritative** Promotion checklist (replaces the README's duplicate).

**Verification:**
- `npm run lint` — clean.
- `npm run build` — clean. TypeScript clean; all 7 dashboard-next routes register identically to yesterday's build (no route shape change).
- Manual click-through deferred to deploy preview: Sign Out from the sidebar lands on `/dashboard-next/login`; AgentCard layout renders without a trailing pill (rows fill the card cleanly); Minutes meter reads "— / N min"; the docs read coherently end-to-end (every `docs/dashboard-next.md` cross-link resolves; `AGENTS.md` and `docs/architecture.md` point at the new doc; the README points at it too).

---

## 2026-05-19 — Wire dashboard-next to the real upstream API

**Subject:** `dashboard-next` was a complete frontend redesign (light theme, Satoshi, creek-gradient backdrop, animated orbs, custom scrollbar) rendering mock data from `buildAgents()` / `buildSessions()` / `buildTokens()` builders inline in each page. Every page already had `WIRE-UP:` comments naming the exact API functions to call. This commit replaces the mock data layer with real `serverFetch` + `useUpstreamList` calls (mirroring the live `/dashboard` patterns), builds the missing camera detail page, ports the token create/revoke flows + login form to their respective Server Actions, and exposes `/dashboard-next/login` publicly. Outcome: dashboard-next is a functionally-equivalent live operator dashboard ready for eventual promotion to replace `/dashboard`.

**Why:** asked for explicitly — implement the existing dashboard's API/functionality into the dashboard-next dashboard. The plan was approved at `/Users/elkanbruha/.claude/plans/effervescent-stirring-summit.md`.

**Approach:** for each list page the established pattern from old `/dashboard/` is `Server Component does parallel fetches → hands fallbackData to a new client wrapper that polls with useUpstreamList(default 10s)`. The wrapper renders the existing presentational components (they were already prop-shaped to `@/lib/api/types`, so wiring was mechanical — no component types had to change). For the camera detail page, the WHEP player + latest-frame card + Realtime listener were ported verbatim from `src/components/stream/*` and `src/app/dashboard/cameras/[cameraId]/camera-detail-realtime.tsx`, with only the JSX restyled — logic (backoff schedule, visibility/bfcache teardown, gesture-play fallback, `player-state` event broadcast) is unchanged. The two pieces of `dashboard-next` infra missing in `lib/api/` — `getAccount` and `getAccountLimits` for the Plan & Usage tile — became a new `src/lib/api/accounts.ts` module. Two home tiles (Network, Billing) remain illustrative because the backing endpoints don't exist (no aggregate-latency endpoint; no billing service).

**Files touched:**
- `proxy.ts` — added `/dashboard-next/login` to `PUBLIC_PATHS`; added post-login redirect (`/dashboard-next/login` → `/dashboard-next`) mirroring the existing `/login` → `/dashboard` branch.
- `src/lib/api/accounts.ts` (NEW) — `getAccount` + `getAccountLimits` wrappers over `serverFetch`. Used by the home page Plan & Usage tile.
- `src/app/dashboard-next/(app)/page.tsx` — replaced static tile values with parallel fetch of summary/agents/tokens/account/limits → hands to new client wrapper.
- `src/components/dashboard-next/home-overview-client.tsx` (NEW) — runs 4 `useUpstreamList` polls and renders the `<Tile />` grid with derived values + status dots. Uses `agentState()` from `agent-card.tsx` and `tokenStatus()` from `tokens-table.tsx` for single-source-of-truth thresholds.
- `src/app/dashboard-next/(app)/cameras/page.tsx` — parallel fetch listCameras + listAgents → CamerasGridClient.
- `src/components/dashboard-next/cameras-grid-client.tsx` (NEW) — `useUpstreamList` for cameras + agents; renders existing `<CameraCard />` per row + empty state.
- `src/components/dashboard-next/camera-card.tsx` — "View" pill now links to `/dashboard-next/cameras/{id}`.
- `src/app/dashboard-next/(app)/agents/page.tsx` + `agents-grid-client.tsx` (NEW) — same pattern, polls `/v1/agents`.
- `src/app/dashboard-next/(app)/stream-sessions/page.tsx` + `sessions-table-client.tsx` (NEW) — parallel fetch sessions + cameras + agents; client polls just `/v1/stream-sessions?limit=100` (name lookups change on a different cadence than session state).
- `src/app/dashboard-next/(app)/api-tokens/page.tsx` — server-fetches tokens + role; renders `<TokensTable />` with `renderRowActions` injecting `<TokenRowActionsNext />` for revoke (active rows only). No polling — Server Action `revalidatePath` refreshes after each mutation, mirroring the live dashboard.
- `src/app/dashboard-next/(app)/api-tokens/actions.ts` (NEW) — `createTokenAction` + `revokeTokenAction` mirror of `src/app/dashboard/settings/api-tokens/actions.ts`; targets `/dashboard-next/api-tokens` for revalidation.
- `src/components/dashboard-next/token-create-dialog-next.tsx` (NEW) — light-theme port of the dark `TokenCreateDialog`. **Same security posture:** plaintext lives ONLY in this component's `secret` state and is wiped on dialog close, route change, tab blur, visibility-hidden, beforeunload. Dialog content is wrapped in `<div className="dashboard-next">` inside `Dialog.Portal` so `.dn-*` styles work inside the portal (the portal mounts outside the segment's `.dashboard-next` scope).
- `src/components/dashboard-next/token-row-actions-next.tsx` (NEW) — light-theme port of `TokenRowActions`. Two-step confirm; calls `revokeTokenAction` via `useTransition`.
- `src/components/dashboard-next/tokens-table.tsx` — added optional `renderRowActions?: (token) => ReactNode` prop. Hidden when omitted, so the table stays read-only-friendly for non-admins. The actions column renders to the right of the existing columns.
- `src/app/dashboard-next/(app)/cameras/[cameraId]/page.tsx` (NEW) — Server Component camera detail page. Mirrors the live `/dashboard/cameras/[cameraId]/page.tsx` data flow exactly: parallel fetch camera, agent (gracefully handles 404), current session (limit 1), latest frame, validations. Renders header (back link + name + status badge), live stream + session panels (left column), latest-frame card (right column), camera-meta + agent + validation panels (3-column grid). 404 on missing camera → `notFound()`.
- `src/app/dashboard-next/(app)/cameras/[cameraId]/not-found.tsx` (NEW) — light-themed "Camera not found" page with link back to the cameras list.
- `src/components/dashboard-next/live-stream-player-next.tsx` (NEW) — WHEP player port. Backoff schedule, visibility/bfcache teardown, `player-state` event broadcast all preserved verbatim from `src/components/stream/live-stream-player.tsx`; only the shell + overlay JSX is restyled (light `dn-tile` frame; video itself stays on black). Uses the same `dispatchPlayerState` helper as the dark player, so the existing badge-listener pattern works across both.
- `src/components/dashboard-next/live-stream-panel-next.tsx` (NEW) — server-rendered wrapper that picks state: no-session / waiting / live / ended.
- `src/components/dashboard-next/latest-frame-card-next.tsx` (NEW) — 7s `useUpstreamList` poll on `/v1/cameras/{id}/latest-frame` with graceful 404 (snapshot_not_found) handling.
- `src/components/dashboard-next/camera-stream-status-badge-next.tsx` (NEW) — light-theme port of `CameraStreamStatusBadge`. Same render-time reset pattern when initialStatus leaves "streaming". Reuses the existing `player-state-event.ts` constants from `src/components/stream/` — no need to duplicate the event-name string.
- `src/components/dashboard-next/camera-detail-realtime-next.tsx` (NEW) — logic-only port of the dark `camera-detail-realtime.tsx`. Subscribes to `stream_sessions` postgres_changes filtered by `camera_id`; calls `router.refresh()` on state transitions only (no-op writes ignored).
- `src/components/dashboard-next/login-form-next.tsx` — wired to `signInAction` via `useActionState`. Reads `next` from `useSearchParams()` (defaults to `/dashboard-next`); passes through a hidden form field; renders `state.error` inline. Proximity-glow microinteraction preserved. Submit button disables during pending action.
- `src/app/dashboard-next/login/page.tsx` — wraps `<LoginFormNext />` in `<Suspense fallback={null}>` to satisfy Next 16's CSR-bailout boundary requirement for `useSearchParams`.
- `src/app/dashboard-next/README.md` — flipped status from "frontend-only" to "fully wired"; added a per-route table of data sources + polling cadences; documented why Network and Billing tiles remain illustrative; updated promotion checklist to reflect what's already done vs. what remains (rename + cleanup pass).

**Verification:**
- `npm run lint` — clean.
- `npm run build` — clean. All routes register correctly (`/dashboard-next`, `/dashboard-next/{agents,api-tokens,cameras,cameras/[cameraId],login,stream-sessions}`), TypeScript clean, login is statically pre-rendered (form's `useSearchParams` is now inside Suspense), every dashboard-next list page is dynamic (ƒ) as expected.
- Manual end-to-end checks (per the plan's verification section, deferred to a deploy preview): home tiles update on 10 s tick; cameras grid → detail navigation works; WHEP player connects + badge mirrors state; Realtime push fires `router.refresh()` on session state change; token create + revoke flows; viewer-role gating on "New Key"; `/dashboard-next/login` accessible while signed out; signed-in visit redirects to `/dashboard-next`.

---

## 2026-05-15 — Filter player-state event by `cameraId` (multi-tab fix)

**Subject:** The window-scoped `upstream:player-state` event introduced yesterday for the unified status badge had no `cameraId` filter — every listener in every tab saw every dispatch. With two browser tabs open on different cameras, tab A's player flipping to `connected` would flip tab B's badge. Fixed by adding a required `cameraId` field to the event payload and making `<CameraStreamStatusBadge />` filter on it.

**Why:** caught in today's audit pass (`/Users/elkanbruha/.claude/plans/luminous-coalescing-goblet.md`). Inline comment in `player-state-event.ts` had already flagged this as a known limitation ("at most one LiveStreamPlayer on a page today"). Single-tab usage was unaffected; multi-tab was visibly buggy.

**Files touched:**
- `src/components/stream/player-state-event.ts` — added `cameraId: string` to `PlayerStateEventDetail`. Comment block rewritten to mark the filter as REQUIRED, not optional, since dropping it silently breaks multi-tab.
- `src/components/stream/live-stream-player.tsx` — added `cameraId` prop; dispatches it in the state-change effect.
- `src/components/stream/live-stream-panel.tsx` — forwards `session.camera_id` into the player.
- `src/components/stream/camera-stream-status-badge.tsx` — added `cameraId` prop; the listener short-circuits on `detail.cameraId !== cameraId`.
- `src/app/dashboard/cameras/[cameraId]/page.tsx` — passes `camera.id` to the badge.

**Verification:**
- `npm run lint` clean.
- `npx tsc --noEmit` clean (the prop addition is required, so any forgotten call site would fail typecheck).
- `npm run test` — 19 passing, unchanged.
- Functional check (post-deploy): open camera A in one tab, camera B in another. Stop the agent on A. A's badge transitions to `idle` (Realtime-driven) without B's badge changing.

---

## 2026-05-14 — Unify "live" indicator with actual WebRTC playback state

**Subject:** The camera detail page's header status badge previously read straight from `cameras.status` in the DB — so it flipped to "Streaming" the moment the streaming-server's `runOnReady` hook posted `stream-started`, ~1–3 s before the dashboard's WebRTC player had actually rendered the first frame. The user saw two distinct loading phases: the badge would say "Streaming" while the video pane was still showing "Connecting…". Bridge them: the badge now stays in a `connecting` state until the WebRTC player itself broadcasts that ICE has connected and video is playing.

**Why:** asked for explicitly. After the polling → Realtime swap and the agent's GOP fix, the badge-vs-video gap is the only visible "two loadings" left in the flow.

**How it works:** `<LiveStreamPlayer />` dispatches a window-scoped `CustomEvent("upstream:player-state", { detail: { kind } })` on every state transition (connecting, connected, reconnecting, failed, etc.). A new `<CameraStreamStatusBadge />` client island in the page header listens for those events. When `cameras.status === "streaming"` but the last player event was anything other than `connected`, the badge renders "connecting" instead. Once the player reports `connected`, the badge flips to "streaming". For non-streaming statuses (`idle`, `error`, `disabled`, etc.) the badge passes through unchanged, since the player isn't mounted at all.

**Why a custom DOM event vs Context:** the badge lives in the page header (Server Component path) and the player lives further down the tree inside `<LiveStreamPanel />`. Sharing state via Context would force the entire header into a client subtree just to access the provider value. The custom event keeps `<CameraStreamStatusBadge />` as the only client island that needs to know. Documented inline in `player-state-event.ts`. If we ever render multiple `<LiveStreamPlayer />`s on a single page, we'll add a `cameraId` field to the event detail and filter on it; the file is the single import point for that change.

**Edge cases:** when the session ends, the player unmounts and the page re-renders with `cameras.status` flipping back to `idle`/`error`/etc. Without a reset, the badge would remember the prior session's final `connected` event and short-circuit the next session's "connecting" phase. Handled by resetting the cached player-kind state during render whenever `initialStatus` transitions away from "streaming" — the React 19-sanctioned pattern for prop-driven state resets (eslint's `react-hooks/set-state-in-effect` catches the older effect-based approach).

**Files touched:**
- `src/components/stream/player-state-event.ts` (NEW) — single-source-of-truth for the event name, payload type, and the dispatch helper. Comment block explains why we picked custom events over Context.
- `src/components/stream/camera-stream-status-badge.tsx` (NEW) — client island wrapping `<StatusBadge />` with the player-state listener and the render-time reset on initialStatus transitions.
- `src/components/stream/live-stream-player.tsx` — dispatches the event on every state-kind change via a tiny `useEffect`.
- `src/components/data/status-badge.tsx` — added `connecting` → `warn` tone alongside the existing `reconnecting`/`validating`/`pending` transitional entries.
- `src/app/dashboard/cameras/[cameraId]/page.tsx` — swapped `<StatusBadge status={camera.status} />` in the header for `<CameraStreamStatusBadge initialStatus={camera.status} />`. The remaining `<StatusBadge />` uses inside the page (`agent`, `validation`, `session`) are unchanged — they reflect their own subjects, not the live viewer state.

**Verification:**
- `npm run lint` clean (the render-time-reset pattern passes `react-hooks/set-state-in-effect`).
- `npm run test` — 19 passing, unchanged.
- `npx tsc --noEmit` clean.
- Live verified by exercise: start agent, watch the badge — should stay "connecting" through the SRT + WHEP + ICE + first-keyframe window, flip to "streaming" the instant the video pane stops showing the overlay.

---

## 2026-05-14 — Replace camera-detail SWR polling with Supabase Realtime

**Subject:** The camera detail page used to poll `/v1/stream-sessions?camera_id=...&limit=1` every 5 seconds and call `router.refresh()` when `state` changed. That meant the "live" indicator could light up anywhere from 0 to 5 seconds after the api-server transitioned the session — a noticeable user-visible delay between starting the agent and the dashboard catching up. Swap polling for a Supabase Realtime subscription filtered to `stream_sessions where camera_id = $1`. Broadcast latency is ~50–200 ms, and the dashboard makes one subscription at mount instead of an api-server roundtrip every 5 s.

**Why:** measured 5–10 s gap from agent connect to dashboard "live" indicator; ~5 s of that was polling jitter. The other contributor (WebRTC ICE + first-keyframe wait) is on the agent / streaming-server side and is tracked separately.

**Why Realtime instead of staying inside the `/api/upstream` proxy:** broadcasts are a push channel, not a read. Tunneling them through the api-server would require a new SSE/WebSocket endpoint, server-side Postgres LISTEN/NOTIFY plumbing or a Supabase Realtime client running server-side, and custom retry/heartbeat in the browser. Supabase Realtime already does all of that, respects the existing `stream_sessions_member_select` RLS policy (so a member only sees their own broadcasts), and uses the user's existing Supabase session — no new auth surface. This mirrors the existing carve-out for `latest-frame`. Documented in `AGENTS.md` as a sanctioned exception under "Conventions baked into the codebase".

**Companion change** (`upstream-api-server`): `20260514120000_realtime_publication.sql` adds `stream_sessions` and `cameras` to the `supabase_realtime` publication. Auto-applies on push to main via Supabase's GitHub integration. The `cameras` table is added for the (future) list-view subscription; today only the detail page uses Realtime.

**Files touched:**
- `src/app/dashboard/cameras/[cameraId]/camera-detail-realtime.tsx` (NEW) — replaces the polling component. Filtered `postgres_changes` subscription, calls `router.refresh()` only when `state` actually changes (suppresses no-op broadcasts on other column writes).
- `src/app/dashboard/cameras/[cameraId]/camera-detail-polling.tsx` (DELETED).
- `src/app/dashboard/cameras/[cameraId]/page.tsx` — swap the import + component name.
- `src/components/stream/live-stream-player.tsx` — update one inline comment that referenced the old component.
- `AGENTS.md` — document the Realtime exception under "Conventions baked into the codebase".

**Verification:** with the migration applied to the hosted Supabase project and the dashboard deployed, start the agent, watch the detail page — the "live" indicator should light up within a second of `stream_sessions.state` flipping in the DB. Stop the agent — "live" should clear nearly as fast. Compare against the prior 5-second polling window.

---

## 2026-05-13 — Route WHEP signaling through api-server proxy for read-path auth

**Subject:** Move live WebRTC playback from a direct browser → MediaMTX flow to a proxied browser → api-server → MediaMTX flow. The api-server now enforces account-scoped read auth on WHEP, identical to the existing `GET /v1/stream-sessions/{id}` pattern. Drops the `NEXT_PUBLIC_MEDIAMTX_BASE_URL` env var and adds vitest as the dashboard's first unit-test framework.

**Why:** With the previous commit, anyone on the network could view any stream — MediaMTX's `authInternalUsers` is permissive and the dashboard hit it directly. Routing through the api-server gives us auth for free via the existing `CurrentCaller` dependency and removes the need for any new shared secret. UDP/ICE media still flows direct, so there's no perf penalty on the actual stream.

**What changed (dashboard):**
- `src/lib/webrtc/whep-client.ts` — fix the Location-header resolution that threw on relative URLs. Now: `${url}/${encodeURIComponent(locationHeader)}`. Works for the same-origin proxy URL and is robust to special chars.
- `src/components/stream/live-stream-player.tsx` — prop change from `streamPath` to `sessionId`. WHEP URL becomes `/api/upstream/v1/stream-sessions/${sessionId}/whep`. The mixed-content guard is gone (same-origin relative URLs can't be mixed-content). No env var imported.
- `src/components/stream/live-stream-panel.tsx` — dropped the `derivePlaybackPath` helper and "Unexpected streamid" branch. The api-server now owns the streamid → path derivation. Pass `sessionId={session.id}` to the player.
- `src/lib/env.ts` — removed `NEXT_PUBLIC_MEDIAMTX_BASE_URL` from the schema.
- `.env.example`, `.env.local` — removed the same line.
- `package.json` — added vitest + `@vitest/coverage-v8` as devDeps; new `test` and `test:watch` scripts.
- `vitest.config.ts` (NEW) — minimal config, `@` alias, node environment (no jsdom yet).
- `src/lib/webrtc/whep-client.test.ts` (NEW) — 12 cases covering happy path, all three typed errors, AbortSignal lifecycle, Location-header handling, and `closeWhepSession` semantics.
- `src/components/stream/live-stream-panel.test.tsx` (NEW) — 7 cases asserting the right branch (waiting / streaming / ended / failed) renders for each session state.

**Cross-repo changes (separate commits in those repos):**
- `upstream-api-server` — new `POST /v1/stream-sessions/{id}/whep` + `DELETE /v1/stream-sessions/{id}/whep/{resource_id}` endpoints (account-scoped via `CurrentCaller`). New `services/whep_proxy.py` + `services/http_client.py`. `tests/test_whep_proxy.py` with 27 cases covering happy path, cross-account, state-gating, MediaMTX failures, and path-traversal defense. `scripts/smoke_whep_proxy.py` for live testing against a running api-server.
- `upstream-streaming-server` — docs only. The chosen design keeps MediaMTX permissive locally and relies on a production firewall around its read ports. FU-3 in `docs/follow-ups.md` is now resolved by the api-server proxy. New `scripts/smoke_whep_read.sh` exercises the WHEP read path directly via curl (used to verify the previous-commit player end-to-end against MediaMTX).

**Design notes:**
- **Stateless proxy.** The api-server reconstructs the MediaMTX URL from `session.streamid` + a `resource_id` path param on DELETE. No mapping table, no in-memory cache. Api-server restarts are safe — orphaned ICE sessions time out within ~30 s.
- **Bare resource id in Location.** The api-server returns `Location: <uuid>` (just the resource id, not a path). The whep-client appends to the POST URL. Avoids the proxy-prefix problem cleanly.
- **404 preservation.** MediaMTX returning 404 (path not yet registered after api-server flipped session to `streaming`) is preserved as 404 `stream_not_ready` so the existing WhepNotFoundError retry logic keeps working.
- **No new shared secrets.** Reuses the existing Supabase JWT + account scoping. Production hardening is operational (firewall MediaMTX's read ports to the api-server's egress IP only).

**Verification:**
- `npm run test` → 19 passing (12 whep-client + 7 panel).
- `npm run lint` clean.
- `npm run build` clean.
- Manual end-to-end (with `make dev` api-server + `docker compose up` streaming-server + a publishing agent):
  - Open `/dashboard/cameras/<id>` while signed into the agent's account → live video appears.
  - Sign out → WHEP 401, player surfaces "failed".
  - Sign into a different account, hand-craft a WHEP POST against another account's session id → 404 `session_not_found` (does not leak existence).

**Docs updated:** `docs/commit-log.md` (this entry), `docs/architecture.md` (rewritten "Live playback (WebRTC)" section, updated "Out of scope" list).

---

## 2026-05-13 — Live WebRTC playback on the camera detail page

**Subject:** Replace the `<PlaybackComingSoon />` placeholder with a working WHEP-based live video player. The dashboard now consumes the WebRTC read endpoint that `upstream-streaming-server` has been exposing since M1.

**Why:** The streaming-server's MediaMTX 1.9.3 has been publishing a working WHEP endpoint at `:8889/<path>/whep` since M1, but the dashboard's only stream surface was a snapshot frame that polls every 7 s. Adding live playback closes the most visible UX gap on the camera detail page and exercises the streaming-server's read path end-to-end — which surfaced the read-path auth gap that's now tracked as a follow-up in that repo.

**What changed (dashboard):**
- `src/lib/webrtc/whep-client.ts` (NEW) — framework-free WHEP negotiator. Exports `connectWhep({ url, signal })` + typed errors (`WhepNotFoundError`, `WhepRejectedError`, `WhepNetworkError`) + `closeWhepSession(resourceUrl)`. ~120 lines, no deps. Honors `AbortSignal`.
- `src/components/stream/live-stream-player.tsx` (NEW) — `"use client"`. Owns `RTCPeerConnection` lifecycle, backoff (500 ms → 8 s, 5 attempts), manual retry, tab-hide/pagehide teardown + reconnect on visibility-return, mixed-content guard, WebRTC-unavailable guard, iOS Safari autoplay fallback ("Tap to play" overlay).
- `src/components/stream/live-stream-panel.tsx` (NEW) — Server Component. Branches on session state: `null` / `approved` / `streaming` / `ended|expired|failed`. Derives `streamPath = session.streamid.slice("publish:".length)` defensively.
- `src/app/dashboard/cameras/[cameraId]/page.tsx` — swapped `<PlaybackComingSoon />` for `<LiveStreamPanel session={currentSession} />`. Dropped the duplicate "No session yet" stub since `<LiveStreamPanel>` now renders that state itself.
- `src/components/stream/playback-coming-soon.tsx` (DELETED).
- `src/lib/env.ts` — added `NEXT_PUBLIC_MEDIAMTX_BASE_URL` to the schema. Build-time inlined per the existing pattern; the same Netlify "Builds scope" gotcha applies.
- `.env.example`, `.env.local` — added `NEXT_PUBLIC_MEDIAMTX_BASE_URL=http://localhost:8889` (default points at `docker compose up` in `upstream-streaming-server`).

**Cross-repo doc updates (no code changes in those repos):**
- `upstream-streaming-server/docs/stream-auth.md` — new top-level section "Read-path auth (separate from ingest auth)" documenting that M1's permissive reader config is now actively exercised, and that production playback requires its own auth design.
- `upstream-streaming-server/docs/follow-ups.md` — new FU entry for read-path authentication, naming the touch points across all three repos.
- `upstream-streaming-server/docs/commit-log.md` — cross-repo entry pointing at the new FU.
- `upstream-api-server/docs/api-contracts.md` — note on the `StreamSession.streamid` coupling and the planned `playback` block follow-up.
- `upstream-api-server/docs/commit-log.md` — cross-repo entry.

**Design notes:**
- The browser hits MediaMTX **directly**, not through the api-server proxy. UDP/ICE bypasses the proxy anyway; routing the HTTP signaling alone would add nothing.
- Existing `<CameraDetailPolling>` (5 s session-state poll) drives mount/unmount of the player via `router.refresh()` on state transitions — no new polling.
- 404 from WHEP is the common race condition (api-server flips state to `streaming` a few seconds before MediaMTX registers the path) and is treated as a transient, retryable error.
- Mixed-content guard: if `location.protocol === "https:"` and the base URL is HTTP, render a clear error rather than letting the fetch fail silently.
- Read-path auth is **out of scope** for this PR and is fully documented in the streaming-server's `follow-ups.md`. Until shipped, `NEXT_PUBLIC_MEDIAMTX_BASE_URL` must not point at a public hostname.

**Verification:** Manual end-to-end requires `upstream-streaming-server` running locally + an agent publishing. Steps in the PR description: open `/dashboard/cameras/<id>`; observe "Waiting for stream" → live video on session-state transition; stop the agent and observe "Stream ended"; refresh mid-stream → reconnects; hide the tab → tears down; show the tab → reconnects. `npm run lint` and `npm run build` clean.

**Docs updated:** `docs/commit-log.md` (this entry), `docs/architecture.md` (new "Live playback (WebRTC)" section, updated "Out of scope" list), cross-repo docs above.

---

## 2026-05-13 — Fix routing (route group → real prefix) + Tailwind base-2 token shadow

**Subject:** Two visible bugs the first real user hit on hosted: every link in the sidebar (`/dashboard/cameras`, `/agents`, etc.) 404'd, and the 404-page "Back to dashboard" button rendered white text on white.

**Why — routing:** The `(dashboard)` parens around the folder name make it a Next.js **route group** — invisible in the URL. So `(dashboard)/cameras/page.tsx` lived at `/cameras`, not `/dashboard/cameras`. Only `/dashboard` happened to work because there was a redundant `(dashboard)/dashboard/page.tsx`. Sidebar hrefs and `next/link` targets all assumed the `/dashboard/*` prefix; everything else 404'd.

**Why — Tailwind:** Color token `--color-base-2` in the `@theme inline` block collided with Tailwind v4's built-in `text-base` font-size utility. `text-base-2` parsed as the size utility with junk suffix instead of generating a color. Where rendered (404 page button), text inherited the parent `color: var(--ink)` (cream) on a `bg-ink` cream background — invisible.

**What changed:**
- Flattened `src/app/(dashboard)/*` → `src/app/dashboard/*`. The dashboard layout, error/loading/not-found boundaries, and all four list + detail + tokens pages now live under a real `/dashboard/` URL segment. The redundant inner `(dashboard)/dashboard/` subfolder is gone; its `page.tsx` and `overview-cards.tsx` are now at the top of `src/app/dashboard/`.
- Updated `@/app/(dashboard)/...` imports in `components/tokens/{token-create-dialog,token-row-actions}.tsx` to use the new path.
- Renamed Tailwind color token `--color-base-2` → `--color-base-deep` in `src/app/globals.css`. Replaced all `text-base-2` / `bg-base-2` usages with the new name (login form, signup form, token dialog, not-found pages, error boundary, latest-frame card — 9 occurrences total).

**Verification:** `npm run lint` + `npx tsc --noEmit` clean. After Turbopack picks up the file moves, all sidebar nav links resolve (was 404, now 200), and the not-found "Back to dashboard" button is dark text on cream (legible).

**Docs updated:** `docs/commit-log.md` (this entry).

---

## 2026-05-13 — Migrate to api-server Phase 4.5 endpoints

**Subject:** Swap the dashboard's four direct-Supabase reads to the new api-server endpoints. Drops the bespoke `/api/cameras/[id]/latest-frame` Route Handler and the local `account_members`/`stream_validations`/`snapshots`/`api_tokens` queries.

**Why:** Closing the dashboard's gap with the api-server design doc (Section 9). Two benefits: (1) authorization lives in one place (api-server `current_caller`) instead of two (api-server + Supabase RLS on the dashboard side); (2) the overview page now uses a single `/v1/dashboard/summary` call instead of three list endpoints + client-side derivation.

**What changed:**
- `src/lib/api/types.ts` — added `ApiTokenListResponse`, `StreamValidationListResponse`, `DashboardSummary`, `CurrentUser`, `MembershipSummary`, `AccountSummary`, `AccountLimits`; extended `LatestFrame` with `expires_at`.
- `src/lib/api/api-tokens.ts` — `listTokens(accountId)` now calls `serverFetch('/v1/api-tokens')`. No Supabase imports.
- `src/lib/api/snapshots.ts` — `getLatestFrame()` calls `serverFetch('/v1/cameras/{id}/latest-frame')`. Returns `null` on 404/`snapshot_not_found` so empty-state behaviour is preserved.
- `src/lib/api/validations.ts` — `listValidations({accountId, sessionId})` (new `accountId` param) calls `serverFetch('/v1/stream-sessions/{id}/validations')`.
- `src/lib/api/dashboard.ts` (NEW) — `getDashboardSummary({accountId})` for the overview page.
- `src/app/(dashboard)/dashboard/page.tsx` — fetches the summary in one call instead of three list endpoints.
- `src/app/(dashboard)/dashboard/overview-cards.tsx` — props collapsed from three arrays to one `initialSummary: DashboardSummary`. Polls `/v1/dashboard/summary` (1 request) instead of `/v1/agents` + `/v1/cameras` + `/v1/stream-sessions` (3 requests). Validation-errors-24h count now surfaces in the "errors" card.
- `src/components/stream/latest-frame-card.tsx` — uses `useUpstreamList<LatestFrame>('/v1/cameras/{id}/latest-frame')`. `UpstreamApiError` with code `snapshot_not_found` surfaces the empty state without flickering the error boundary.
- `src/app/(dashboard)/cameras/[cameraId]/page.tsx` — passes `accountId` to `listValidations`.
- `src/app/api/cameras/` (DELETED) — bespoke latest-frame Route Handler retired; replaced by the catch-all proxy.

**Verification:** Lint + `tsc --noEmit` clean. Manual end-to-end check (against the hosted api-server deployed at commit `577044a`) pending the next dashboard reload.

**Docs updated:** `docs/commit-log.md` (this entry).

---

## 2026-05-13 — Signup flow + auto-provisioning UI

**Subject:** Add `/signup` route that calls `supabase.auth.signUp()` with workspace metadata; pair with an api-server trigger on `auth.users` insert that auto-provisions `accounts` + `account_members` + `account_limits`. Cross-link from `/login`.

**Why:** Before this change, a brand-new Supabase user landed on `/select-account`'s "no account yet" empty state because nothing on either side of the platform provisioned tenant rows on signup. The dashboard README documented a manual SQL block as the only path. This closes that gap end-to-end and unblocks self-serve onboarding.

**What changed:**
- `proxy.ts` — added `/signup` to `PUBLIC_PATHS` so the auth gate lets unauthenticated users reach the page.
- `src/app/(auth)/signup/page.tsx` (NEW) — Server Component rendering the signup card with a cross-link to `/login`. Reuses `safeNextPath` so an open-redirect attempt via `?next=//evil.com` lands on `/dashboard`.
- `src/app/(auth)/signup/signup-form.tsx` (NEW) — Client Component using `useActionState` + `useFormStatus`. Three fields: email, password (≥8 chars), optional workspace name. Renders a "check your email" success screen when Supabase returns no session (email confirmation on).
- `src/app/(auth)/signup/actions.ts` (NEW) — `signUpAction` Server Action. Calls `supabase.auth.signUp({ email, password, options: { data: { workspace_name } } })`. The api-server trigger picks the workspace name out of `raw_user_meta_data` to name the account. Returns `{ confirmationRequired, email }` when no session was issued; redirects otherwise.
- `src/app/(auth)/login/page.tsx` — added a "Don't have an account? Create one" link with `?next=` preservation.
- `README.md` — replaced the "Manual account seeding" walkthrough with an "Account provisioning" section explaining the trigger flow; kept the SQL fallback for api-server-isolated testing and orphan-user backfills.

**Companion change (separate repo, same logical commit):** `upstream-api-server/supabase/migrations/20260513140000_signup_trigger.sql` adds `handle_new_user()` + `on_auth_user_created` trigger. See that repo's `docs/commit-log.md`.

**Verification:** `npm run lint` + `npx tsc --noEmit` clean. Full end-to-end check (signup with workspace name → land on /dashboard → verify Studio SQL shows membership + limits) requires the api-server's local Supabase running with the new migration applied.

**Docs updated:** `docs/commit-log.md` (this entry), `README.md`.

---

## 2026-05-13 — Post-MVP audit fixes

**Subject:** Eight fixes flagged by the post-implementation audit: open-redirect, account-missing redirect target, sign-out cookie clear, RSC-safe cookie clear, and three minor UX/a11y polishes.

**Why:** Verification audit on the freshly-shipped MVP surfaced two blockers (open-redirect on the login `next` param; `account_id_required` bouncing users through `/login` instead of `/select-account`) and a handful of smaller correctness/UX gaps. Each is small in isolation but adds up to a more trustworthy login + sign-out flow.

**What changed:**
- `src/lib/safe-next.ts` (NEW) — `safeNextPath()` helper that rejects protocol-relative, backslash, and colon-bearing `next` values. Used at both the login page (display) and login Server Action (redirect).
- `src/app/(auth)/login/page.tsx` + `src/app/(auth)/login/actions.ts` — use `safeNextPath`; an attacker passing `?next=//evil.com` now lands on `/dashboard` after sign-in instead of `https://evil.com`.
- `src/lib/api/client.ts` — new `ProxyAccountMissing` error class. `proxyFetch` inspects the 401 body's `error.code` and throws `ProxyAccountMissing` for `account_id_required` / `forbidden_account`; SWR `onError` routes it to `/select-account` (instead of `/login`, which forced a needless re-login round-trip).
- `src/app/api/auth/sign-out/route.ts` — also `cookies().delete(ACTIVE_ACCOUNT_COOKIE)` so the next user on the same browser doesn't inherit a stale account pin.
- `src/lib/account/active.ts` — `clearActiveAccountCookie()` now try/catches the `.delete()` call. Server Components can't mutate cookies in Next 16; the next request through `proxy.ts` or a Server Action will clean up.
- `src/components/nav/topbar.tsx` — sign-out only redirects to `/login` on `res.ok`; on failure, toasts and re-enables the button.
- `src/components/data/copy-button.tsx` — `disabled={!value}` + faded styling + descriptive `aria-label`.
- `src/components/data/status-badge.tsx` — added `role="status"` and `aria-label` so screen readers convey state semantics.

**Triaged out (false positives or low value)** — captured in plan file under "False positives / not fixing":
- `datetime-local` timezone conversion (parses as local time per ECMAScript spec — correct).
- `getUser` / `getSession` ordering in proxy (no real race).
- Pre-checking role in token-create action (defense-in-depth, not a bug).
- `listValidations` missing account-scope filter (RLS already gates).
- DataTable row-click bubble — real footgun but no current row has an interactive child. Re-open when one does.
- `unstable_instant` export on camera detail — perf polish, deferred.

**Verification:** `npm run lint` + `npx tsc --noEmit` clean. Manual checks per the plan's verification section to be run against a real Supabase project and a local `upstream-api-server`.

**Docs updated:** `docs/commit-log.md` (this entry). Plan file at `~/.claude/plans/gleaming-moseying-corbato.md` carries the full audit + fix log.

---

## 2026-05-13 — Phase 7: polish

**Subject:** Loading / error / not-found boundaries, observability shim, and end-to-end docs.

**Why:** The MVP is functionally complete after Phase 6 but lacks the production-minded edges: a deterministic recovery story when things break, friendly empty/error UI, and durable documentation for the next contributor.

**What changed:**
- `src/lib/error.ts` — single `reportError(err, context)` chokepoint. Today it `console.error`s in dev; the Sentry/OTel swap is now a one-file change.
- `src/app/(dashboard)/loading.tsx` — skeleton matching the glass grid; rendered automatically as a Suspense boundary while RSC fetches complete.
- `src/app/(dashboard)/error.tsx` — friendly fallback for unhandled errors with a `reset()` action; logs via `reportError`.
- `src/app/not-found.tsx` + `src/app/(dashboard)/cameras/[cameraId]/not-found.tsx` — top-level + segment-specific 404 pages.
- Proxy and SWR `onError` now route through `reportError`. Auth-expired path still triggers the deterministic `/login?next=…` redirect.
- `docs/architecture.md` — service map, request flow, polling cadence, direct-Supabase rationale, token plaintext hygiene contract, scope cuts. Co-equal with `../upstream-api-server/docs/architecture.md` for cross-repo reasoning.
- `AGENTS.md` — Next 16 specifics (proxy rename, async cookies, caching defaults), conventions for new pages, day-zero verifications to repeat on dep bumps, secrets policy.
- `README.md` — refreshed stack, manual account seeding SQL, full project layout, scripts table, contract pointers.

**Verification:** `npm run lint` + `npx tsc --noEmit` clean. End-to-end run requires real Supabase project credentials in `.env.local` plus the api-server running locally (`make dev` in the sibling repo); see the verification checklist in `~/.claude/plans/gleaming-moseying-corbato.md`.

**Docs updated:** `docs/commit-log.md` (this entry), `docs/architecture.md` (new), `AGENTS.md`, `README.md`.

---

## 2026-05-13 — Phase 6: camera detail

**Subject:** Single-camera deep-dive with current-session info, latest-frame card, and validation status; live playback deferred via clearly-labelled placeholder.

**Why:** This is the page operators land on when troubleshooting. It needs everything we can show — metadata, freshness, validation result — and a definitive answer to "is the camera streaming right now?".

**What changed:**
- `src/app/(dashboard)/cameras/[cameraId]/page.tsx` — Server Component fetches the camera, its agent, the most recent session, validations for that session, and the latest snapshot in parallel. Renders a two-column hero (playback placeholder + session panel | latest frame) then a three-up bottom row (camera metadata | agent | validation).
- `src/app/(dashboard)/cameras/[cameraId]/camera-detail-polling.tsx` — invisible client hook that polls the most recent session every 5 s and triggers `router.refresh()` on state transitions so the server-rendered panels catch up.
- `src/app/api/cameras/[cameraId]/latest-frame/route.ts` — Route Handler that confirms camera ownership through `getCamera` (consistent error semantics with the rest of the proxy) and returns `{ frame: LatestFrame | null }` with a freshly-signed 60-second Supabase Storage URL.
- `src/components/stream/latest-frame-card.tsx` — Client Component with SWR (`refreshInterval: 7_000`) hitting the bespoke route handler; renders the JPEG with width/height/bytes and a relative-time stamp. Empty state when the camera hasn't streamed yet.
- `src/components/stream/playback-coming-soon.tsx` — deliberate, honest placeholder for the WebRTC live view. Single drop-in point so the future swap to a real WHEP player is localized.
- `src/components/data/copy-button.tsx` — small icon-only clipboard helper used for camera id, session id, and (in upcoming phases) other UUIDs.

**Verification:** `npm run lint` clean (after pruning unused props), `npx tsc --noEmit` clean.

**Docs updated:** `docs/commit-log.md` (this entry).

---

## 2026-05-13 — Phase 5: API tokens UI

**Subject:** Owner/admin token management with one-shot plaintext reveal, role-gated creation, and revoke flow.

**Why:** Without an API token the agent can't talk to upstream-api. Token issuance is the first thing every operator does. Plaintext is shown exactly once; everything else must be hostile to accidental leakage.

**What changed:**
- `src/app/(dashboard)/settings/api-tokens/page.tsx` — Server Component renders the tokens table from a direct Supabase read; computes display status (`active` / `revoked` / `expired`); role-gates the create button.
- `src/app/(dashboard)/settings/api-tokens/actions.ts` — `createTokenAction` (POSTs to api-server via `serverFetch`, returns plaintext to the client once and revalidates the page) and `revokeTokenAction` (DELETE). Both refuse non-admin callers up front.
- `src/components/tokens/token-create-dialog.tsx` — Radix Dialog with a two-step flow (form → reveal). Plaintext state wipes on dialog close, `visibilitychange → hidden`, window `blur`, `beforeunload`, and route change. Token field is readonly with autocomplete off; copy button uses `navigator.clipboard.writeText`. Install snippet is rendered with the plaintext interpolated.
- `src/components/tokens/token-row-actions.tsx` — two-click revoke confirmation; toasts on success/failure via sonner; refreshes the page.

**Security hygiene baked in:**
- Plaintext never stored in SWR cache, parent state, localStorage, or URL.
- Server Action validates role *before* the upstream call to avoid the api-server logging a 403.
- TODO/followup: verify the api-server access log middleware does not log the response body of `POST /v1/api-tokens` (request body redaction is enough — the response body carries the plaintext).

**Verification:** `npm run lint` + `npx tsc --noEmit` clean.

**Docs updated:** `docs/commit-log.md` (this entry).

---

## 2026-05-13 — Phase 4: read-only pages

**Subject:** Wire the overview, agents, cameras, and stream sessions pages end-to-end with visibility-gated SWR polling.

**Why:** Operators need at-a-glance state of the fleet before any deep-dive. Phase 4 binds the api-server data to the brand-aligned shell with consistent table semantics, empty states, and 10-second poll cadence per the design doc.

**What changed:**
- Shared components:
  - `src/components/data/status-badge.tsx` — tone-mapped pills covering all agent/camera/session/heartbeat statuses.
  - `src/components/data/data-table.tsx` — minimal generic table with optional row navigation.
  - `src/components/data/empty-state.tsx`, `relative-time.tsx`, `page-header.tsx` — common layout primitives.
  - `src/lib/time.ts` — `Intl.RelativeTimeFormat` + `DateTimeFormat` helpers (no date-library dependency).
  - `src/lib/api/use-list.ts` — `useUpstreamList` SWR wrapper applying the dashboard's default polling config.
- Pages (each is a Server Component fetching the initial payload via `serverFetch`, handing it to a Client Component as `fallbackData`):
  - `/dashboard` — `OverviewCards` derives Agents Online / Cameras Streaming / Active Sessions / Cameras With Errors counts from the three list endpoints; each card links to the relevant page.
  - `/dashboard/agents` — `AgentsTable` (name + hostname, status, version, OS + Python, last seen relative).
  - `/dashboard/cameras` — `CamerasTable` (name + external_id, status, agent name, defaults summary, latency mode). Row click → camera detail.
  - `/dashboard/stream-sessions` — `SessionsTable` (short id, state, camera, agent, approved spec, started/ended relative).
- All client tables poll through `/api/upstream/v1/...` with SWR. The proxy auto-injects `account_id` so the client never has to know it.

**Deliberate scope cuts (not blockers):**
- No latest-frame thumbnails on the cameras list (avoided N Storage signed-URL lookups per poll). Thumbnails will land on the camera detail page in Phase 6.
- No filter/search controls; small fleets at MVP. Add when there's an actual user complaint.

**Verification:** `npm run lint` + `npx tsc --noEmit` clean.

**Docs updated:** `docs/commit-log.md` (this entry).

---

## 2026-05-13 — Phase 3: upstream proxy + API lib

**Subject:** Type the api-server surface and add the catch-all Route Handler proxy that injects the Supabase JWT server-side.

**Why:** Phase 4+ need a typed, auth-injecting fetcher that keeps the Supabase access token out of browser JS. A single catch-all proxy at `/api/upstream/[...path]` gives us one place to mint `Authorization`, append `account_id`, and translate stale-account 403s into 401s that wipe the cookie and force a chooser flow.

**What changed:**
- `src/lib/api/types.ts` — TS mirrors of pydantic schemas: `Agent`, `Camera`, `StreamSession`, `StreamParams`, `ApiToken`, `StreamValidation`, `LatestFrame`, list envelopes. Source of truth is documented as `upstream-api-server/src/upstream_api/schemas/`.
- `src/lib/api/errors.ts` — `UpstreamApiError` class, `ApiErrorEnvelope` shape, `classify()` categorizer, and a `FRIENDLY` map for the canonical error codes (`limit_exceeded.*`, `camera_already_streaming`, `forbidden.role`, …).
- `src/app/api/upstream/[...path]/route.ts` — catch-all proxy. Verifies the Supabase session via `getUser()`, fetches the access token via `getSession()`, forwards method/body/query to the upstream URL (`NEXT_PUBLIC_UPSTREAM_API_URL + /v1/...`). Strips hop-by-hop headers (and `authorization`/`cookie`/`host`). Auto-injects `account_id` from the cookie, falling back to a single-membership lookup. Translates upstream `403 account_id_required|forbidden_account` into a `401` while deleting the active-account cookie.
- `src/lib/api/client.ts` — `proxyFetch` (browser) + `defaultSwrConfig` (visibility-gated polling, no retry on auth-expired, 401 → `/login?next=...`). Exports `ProxyAuthExpired` so callers can opt into custom recovery.
- `src/lib/api/server.ts` — `serverFetch` for RSC + Route Handlers. Always requires explicit `accountId`; refuses to fall back to ambient state.
- `src/lib/api/{agents,cameras,stream-sessions}.ts` — typed wrappers around the existing api-server endpoints.
- `src/lib/api/api-tokens.ts` — `listTokens(accountId)` direct Supabase read (api-server lacks a list endpoint). Selects only safe columns; never `hash`. Gated by RLS `api_tokens_admin_select`.
- `src/lib/api/snapshots.ts` — `getLatestFrame()` queries `snapshots` direct then mints a 60-second Supabase Storage signed URL.
- `src/lib/api/validations.ts` — `listValidations(sessionId)` direct Supabase read of `stream_validations` (gated by RLS `stream_validations_member_select`).

**Verification:** `npm run lint` + `npx tsc --noEmit` clean.

**Docs updated:** `docs/commit-log.md` (this entry).

---

## 2026-05-13 — Phase 2: active-account resolver

**Subject:** Resolve and persist the current Upstream account for dashboard sessions; ship a multi-membership chooser.

**Why:** Upstream users can belong to multiple accounts. The api-server requires `?account_id=` on every request from multi-membership users and 403s otherwise (`account_id_required`). The dashboard needs a deterministic resolver so single-membership users move seamlessly to `/dashboard` and multi-membership users land on a chooser before any API call.

**What changed:**
- `src/lib/account/memberships.ts` — `listMemberships()` queries `account_members` joined to `accounts` via Supabase server client, wrapped in React's `cache()` for per-request memoization. RLS policy `account_members_self_select` keeps this safe.
- `src/lib/account/active.ts` — `getActiveAccount()` orchestrator: redirects to `/login` if no session, to `/select-account` if zero or >1 memberships with no cookie pin, clears stale cookies that point at accounts the user no longer belongs to, and auto-uses the only membership when there's exactly one.
- `src/lib/account/actions.ts` — `setActiveAccountAction` Server Action validates the chosen `account_id` against the caller's memberships before writing the `upstream_active_account` cookie (httpOnly, SameSite=Lax, 30-day).
- `src/app/select-account/page.tsx` — top-level route (deliberately outside `(dashboard)` to avoid the `getActiveAccount → /select-account` redirect loop). Renders a chooser card per membership; shows a "no account yet" empty state if the user has zero memberships.
- `src/app/(dashboard)/layout.tsx` — switched from a bare auth check to `getActiveAccount()`. Passes the active account name/slug/role into the topbar; flags the multi-membership flow.
- `src/components/nav/topbar.tsx` — surfaces account name + slug + role, with a "Switch" link to `/select-account` when the user has >1 memberships.

**Verification:** `npm run lint` clean, `npx tsc --noEmit` clean. Full end-to-end check requires a real Supabase user with seeded memberships.

**Docs updated:** `docs/commit-log.md` (this entry).

---

## 2026-05-13 — Phase 1: foundation (auth + shell)

**Subject:** Wire Supabase Auth with cookie-based sessions, gate `/dashboard/*` via Next 16 `proxy.ts`, and stand up the brand-aligned dashboard shell.

**Why:** Deliver the MVP foundation per the approved plan (`/Users/elkanbruha/.claude/plans/gleaming-moseying-corbato.md`). Phase 1 must end with a deployable shell where logging in lands the user on a styled, empty dashboard so subsequent phases (data, tokens, camera detail) can layer on without fighting the framework.

**What changed:**
- `src/lib/env.ts` — zod-validated `NEXT_PUBLIC_*` env. Fails fast at boot with a clear message.
- `src/lib/supabase/{server,client}.ts` — `@supabase/ssr` factories. Server adapter uses Next 16 async `cookies()` via the `getAll/setAll` interface.
- `proxy.ts` — Next 16 auth gate (`middleware.ts` is now `proxy.ts` per `next/dist/docs/01-app/01-getting-started/16-proxy.md`). Refreshes Supabase session per request; redirects unauthenticated dashboard hits to `/login?next=...`; redirects authenticated `/login` to `/dashboard`. Matcher excludes static assets and `/api/upstream` (which does its own auth).
- `src/app/globals.css` — brand tokens (creek-green / ink / glass) from `upstream-web` plus a Tailwind v4 `@theme inline` block exposing them as utility colors. Dark base, subtle radial gradients, glass panel class.
- `src/app/layout.tsx` — root layout with `<Toaster />` (sonner) styled to match the glass theme.
- `src/app/page.tsx` — redirects `/` → `/dashboard`.
- `src/app/(auth)/layout.tsx` + `login/page.tsx` + `login-form.tsx` + `actions.ts` — Supabase email/password sign-in via React 19 `useActionState` Server Action. Returns inline error or redirects to `?next=` target.
- `src/components/nav/{sidebar,topbar}.tsx` — sidebar nav (Dashboard / Cameras / Agents / Stream sessions / API tokens) with active-route highlight; topbar with account name placeholder and sign-out.
- `src/app/(dashboard)/layout.tsx` — server-side auth check + sidebar/topbar grid shell.
- `src/app/(dashboard)/dashboard/page.tsx` — welcome placeholder (real overview wired in Phase 4).
- `src/app/api/auth/sign-out/route.ts` — clears Supabase session.
- Dependencies: added `@supabase/supabase-js@^2.105`, `@supabase/ssr@^0.10.3`, `swr@^2.4`, `zod@^4.4`, `clsx@^2.1`, `lucide-react@^1.14`, `sonner@^2`, `@radix-ui/react-dialog@^1.1`.

**Day-zero verifications passed:**
- `@supabase/ssr@0.10.3` cookies adapter accepts `Promise<...>` returns → compatible with Next 16 async `cookies()`. (See `node_modules/@supabase/ssr/dist/main/types.d.ts`.)
- `stream_validations` RLS policy for dashboard reads confirmed (api-server migration `20260512130300_stream_sessions.sql:103`).
- Snapshots bucket privacy + Supabase project credentials: deferred to operator before launch.

**Verification:** `npm run lint` clean. `npx tsc --noEmit` clean. End-to-end check requires a real Supabase project + a seeded user (manual SQL for `accounts` / `account_members` / `account_limits` per the plan's verification section).

**Docs updated:** `docs/commit-log.md` (this entry).

---

## 2026-05-13 — Initial scaffold

**Subject:** Bootstrap Next.js 16 + Tailwind v4 + TypeScript dashboard skeleton.

**Why:** Set up the operator dashboard repo as a sibling to `upstream-api-server` and `upstream-web`. Stack versions are pinned to match `upstream-web` (Next 16.2.6, React 19.2.4, Tailwind v4) so cross-repo work doesn't require switching mental models.

**What changed:**
- `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `.gitignore`, `.env.example`.
- `src/app/{layout,page}.tsx` and `src/app/globals.css` — minimal placeholder landing page.
- `README.md` — overview, env, link to api-server docs, dashboard-relevant Phase 4 endpoints.
- `AGENTS.md` (+ `CLAUDE.md` re-export) — Next.js 16 caveat, contract pointers, commit-log policy.
- `docs/commit-log.md` — this file.

**Docs updated:** `README.md`, `AGENTS.md`, `docs/commit-log.md` (this entry).

---

## Template

Copy-paste for the next entry. Replace the date and drop the parens.

```
## YYYY-MM-DD — One-line title

**Subject:** Imperative-mood sentence describing the change.

**Why:** The motivation. What problem is this solving? What constraint forced the decision?

**What changed:**
- File or area — what it does now.
- File or area — what it does now.

**Docs updated:** Comma-separated list of doc files touched in this commit.
```
