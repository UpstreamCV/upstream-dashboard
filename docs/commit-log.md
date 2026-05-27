# commit-log

Reverse-chronological summary of every meaningful commit. Newest first. See the template at the bottom for the entry format.

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
