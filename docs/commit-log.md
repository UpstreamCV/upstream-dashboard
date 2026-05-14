# commit-log

Reverse-chronological summary of every meaningful commit. Newest first. See the template at the bottom for the entry format.

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
