# Architecture — upstream-dashboard

Where this app sits, how a request flows, and the deliberate scope cuts the MVP makes. Pair this doc with `../upstream-api-server/docs/architecture.md` (the platform-level overview) and `docs/api-contracts.md` over there (endpoint shapes and error codes).

## Place in the platform

```
                                upstream-dashboard (this repo)
                                        │
                                        │  Supabase JWT in
                                        │  Authorization: Bearer …
                                        ▼
                                upstream-api-server (FastAPI)
                                        │
                                        ▼
                                Supabase Postgres ── Supabase Storage
                                        ▲
                          ┌─────────────┘
upstream-agent ── SRT ─► upstream-streaming-server (MediaMTX)
                                        │
                                        └─► upstream-processor (CV)
```

The dashboard is a **control + visibility** layer. It never ingests video, never validates streams, never holds raw secrets. Browser-initiated authentication is the only direct Supabase surface; everything else routes through the api-server.

### Parallel deployment: `/dashboard` and `/dashboard-next`

The same Next app serves two dashboards in parallel: the dark-themed live `/dashboard` (described throughout this doc) and a light-themed redesign at `/dashboard-next` that is the target replacement. Both share the same data layer (the catch-all proxy, `serverFetch` / `useUpstreamList`, account scoping, auth) — only the UI shell and theme differ. The new segment is fully wired and is scoped under `.dashboard-next` with its own `--dn-*` tokens so it cannot interfere with the live one. See `docs/dashboard-next.md` for the new segment's architecture, theme system, Realtime channel-naming convention (the two dashboards use distinct channel names while running in parallel), and the authoritative promotion checklist.

## Identity & request flow

1. **Sign in.** `(auth)/login` Server Action calls `supabase.auth.signInWithPassword`. Supabase Auth sets HTTP-only cookies (`sb-*`). On success, the action redirects to `?next=` or `/dashboard`.
2. **Session refresh.** Every request runs through `proxy.ts` (Next 16's renamed middleware). The proxy uses `@supabase/ssr`'s `createServerClient` with cookie adapters; calling `getUser()` triggers a server-side refresh when needed and writes new cookies via `NextResponse.next`. Unauthenticated requests to `/dashboard/*` (or any non-public path) redirect to `/login?next=…`.
3. **Active account resolution.** `getActiveAccount()` (`src/lib/account/active.ts`) is called from `src/app/dashboard/layout.tsx` and every page that needs `activeAccountId`. It validates the `upstream_active_account` cookie against the user's actual memberships (queried via the Supabase server client against `account_members` — the *only* non-auth Supabase read this app makes, since `/v1/users/me` isn't wired in yet; RLS scopes to `auth.uid()`). It auto-picks for single-membership users, and redirects multi-membership users with no pin to `/select-account`. Stale cookies (pointing at an account the user no longer belongs to) are cleared automatically. The catch-all proxy at `src/app/api/upstream/[...path]/route.ts` deliberately does **not** call `getActiveAccount()` — that function `redirect()`s, which is wrong for an API route. The proxy reads the cookie directly and falls back to a single-membership lookup if absent.
4. **API calls (browser).** Client components use SWR pointed at `/api/upstream/...`. The catch-all Route Handler (`src/app/api/upstream/[...path]/route.ts`) verifies the Supabase session, fetches the access token via `getSession()`, injects `Authorization: Bearer <access_token>`, appends `?account_id=` from the cookie (with a single-membership fallback), and forwards method/body/query to `upstream-api-server`. `Cookie`, `Host`, and `Authorization` headers are stripped before forwarding.
5. **API calls (server).** Server Components and Route Handlers use `serverFetch` (`src/lib/api/server.ts`), which mints the same `Authorization` server-side but requires the caller to pass `accountId` explicitly. No ambient state.

The Supabase access token therefore never appears in browser JavaScript or `localStorage`. It lives in HTTP-only cookies and is read only by Next-side code.

### Auth-recovery

Two distinct recovery paths, both terminating in `defaultSwrConfig.onError` in `src/lib/api/client.ts`:

- **Account drift.** If upstream-api returns `403 account_id_required` or `403 forbidden_account`, the catch-all proxy rewrites the response to `401`, deletes the `upstream_active_account` cookie, and the client `proxyFetch` throws `ProxyAccountMissing`. SWR `onError` redirects straight to `/select-account` — no re-login needed.
- **Session expiry.** Any other `401` from the proxy means the Supabase session is gone (no cookies, refresh failed, etc.). `proxyFetch` throws `ProxyAuthExpired`; SWR `onError` redirects to `/login?next=<current-path>`.

Both errors set `shouldRetryOnError = false` in the SWR config so we don't thrash before the redirect.

## Resource reads — all via the api-server

Earlier MVP iterations queried Supabase directly server-side for four data points the api-server didn't yet expose. As of api-server Phase 4.5 (commits up to `c771946` / `5f7bfbe` here), all four are now first-class endpoints, and the dashboard fetches them through `serverFetch`:

| Data | Endpoint | Wrapper |
|---|---|---|
| List API tokens for an account | `GET /v1/api-tokens` | `src/lib/api/api-tokens.ts` |
| Latest snapshot + Storage signed URL | `GET /v1/cameras/{id}/latest-frame` | `src/lib/api/snapshots.ts` (returns `null` on 404 / `snapshot_not_found`) |
| Stream validations for a session | `GET /v1/stream-sessions/{id}/validations` | `src/lib/api/validations.ts` |
| Dashboard summary counts | `GET /v1/dashboard/summary` | `src/lib/api/dashboard.ts` |

The only Supabase access from app code today is **auth**: session refresh in `proxy.ts`, `signInWithPassword` / `signUp` in the auth Server Actions, `getSession()` inside `serverFetch` to read the bearer token, and one `account_members` read in `listMemberships()` (used to resolve the active-account cookie and to render the `/select-account` chooser). No `snapshots`, `api_tokens`, `stream_validations`, or `accounts` reads remain.

When `/v1/users/me` (or equivalent membership listing) lands on the api-server, `listMemberships()` becomes a single-file migration to `serverFetch` and the dashboard's last non-auth Supabase query goes away.

## Polling model

Polling drives the live feel of the dashboard. SWR client config:

- `refreshWhenHidden: false` — hidden tabs don't burn the api-server.
- `revalidateOnFocus: true` — focusing the tab re-syncs immediately.
- `dedupingInterval: 3000` — half the fastest interval; dedupes thrash.
- `keepPreviousData: true` — avoids flicker on detail pages.
- `shouldRetryOnError: !(err instanceof ProxyAuthExpired)` — auth errors don't retry; they redirect.

Intervals:

| Page / data | Interval |
|---|---|
| Overview cards | 10 s (each card SWRs its own list) |
| Cameras / agents / sessions lists | 10 s |
| Camera detail — session state | 5 s (triggers `router.refresh()` on transitions) |
| Camera detail — latest frame | 7 s |
| Camera detail — recent observations | off by default (opt-in 5 s "Live" toggle) |
| Camera detail — latest-frame perception overlay | off by default (opt-in 5 s "Live" toggle) |
| Camera detail — live perception overlay | 1 s while "Live" on (default on) — matches the processor's ~1 FPS publish rate |

Higher-frequency polling is appropriate for the detail page only because at most one camera is on screen at a time.

## Token plaintext hygiene

`POST /v1/api-tokens` returns the plaintext once. The token-create dialog (`src/components/tokens/token-create-dialog.tsx`) is the only place it ever exists in React state. The state is wiped on **all** of:

- dialog close (`onOpenChange(false)`)
- `document.visibilitychange === 'hidden'`
- window `blur`
- `beforeunload`
- route change (`usePathname()` effect)

Plaintext is **never**:
- placed in SWR cache,
- lifted to a parent component or store,
- written to `localStorage` or `sessionStorage`,
- placed in a URL query param,
- logged (no `console.log` even in development).

Followup: confirm the api-server's `AccessLogMiddleware` does not log POST response bodies. If it does, redact `/v1/api-tokens` specifically.

## Visual system

Brand-aligned with `upstream-web`:
- Dark green base `#1a2613` / `#0f1809` with subtle radial gradients.
- Glass panels (`.glass`, `.glass-2`) — translucent + backdrop blur.
- Italic display em-emphasis in the brand green (`#5fb886`).
- Mono for IDs, timestamps, and code (system `ui-monospace`).
- Tailwind v4 with brand tokens exposed via `@theme inline` (`text-ink`, `text-accent`, `bg-glass-bg`, etc.).
- No design library; status badges, tables, and modals are hand-rolled. Modal uses `@radix-ui/react-dialog` for the focus trap (security-critical for the token reveal).

## Live playback (WebRTC)

The camera detail page renders live video via `<LiveStreamPanel>` whenever the camera's most recent session is in state `streaming`. The flow:

1. Server-render `CameraDetailPage` fetches the latest session via `listStreamSessions({ cameraId, limit: 1 })` and hands it to `<LiveStreamPanel>`.
2. `<LiveStreamPanel>` (Server Component, `src/components/stream/live-stream-panel.tsx`) branches on `session.state`. Only when `streaming` does it render `<LiveStreamPlayer sessionId={session.id} approved={session.approved} />`.
3. `<LiveStreamPlayer>` (Client Component, `src/components/stream/live-stream-player.tsx`) builds the WHEP URL as `/api/upstream/v1/stream-sessions/${sessionId}/whep` and calls `connectWhep` (`src/lib/webrtc/whep-client.ts`).
4. The WHEP negotiator POSTs an SDP offer with `Content-Type: application/sdp` through the dashboard's existing `/api/upstream/[...path]` proxy. The proxy injects the Supabase JWT server-side; the api-server then verifies the caller is a member of the session's account and forwards the offer to MediaMTX. The api-server's response includes the SDP answer plus a `Location` header carrying a bare resource id, which the player appends to the POST URL to form the DELETE target on teardown.
5. The actual WebRTC media (RTP over UDP) flows browser ↔ MediaMTX **directly** via the ICE candidates in the SDP answer. The api-server is only in the HTTP signaling path. The api-server never sees the SRT/RTP stream.
6. Existing `<CameraDetailPolling>` (5 s `useUpstreamList` on `/v1/stream-sessions?camera_id=...&limit=1`) detects state transitions and calls `router.refresh()`, which mounts/unmounts the player cleanly.

**Read-path auth.** The api-server enforces auth on every WHEP request via the same `CurrentCaller` dependency that gates `GET /v1/stream-sessions/{id}`. Cross-account access returns 404 `session_not_found` (does not leak existence). Sessions in non-`streaming` state return 409 `session_not_streaming`. See `../upstream-api-server/docs/api-contracts.md` for the full endpoint contract.

**No new browser-facing env vars.** WHEP signaling goes through the same `/api/upstream` proxy as everything else, so `NEXT_PUBLIC_MEDIAMTX_BASE_URL` is gone — production deploys configure the streaming-server URL once, server-side, via `UPSTREAM_MEDIAMTX_BASE_URL` on the api-server.

**Backoff schedule** on connection failure: 500 ms, 1 s, 2 s, 4 s, 8 s, then a manual "Retry" button. 404 from WHEP is the common race (api-server has flipped the session to `streaming` a few seconds before MediaMTX registers the path) and is treated as transient. The player tears down on tab-hide and bfcache `pagehide`, and reconnects on visibility-return — this avoids ghost readers in MediaMTX's `paths/list` and keeps bandwidth honest.

**Two implementations, shared internals.** `/dashboard-next` ships a light-themed sibling at `src/components/dashboard-next/live-stream-player-next.tsx` with identical WHEP logic — only the shell + overlay JSX differ. Both players import the same `connectWhep` from `src/lib/webrtc/whep-client.ts` and dispatch via the same `upstream:player-state` custom event (`src/components/stream/player-state-event.ts`). On promotion the dark player is retired in favor of the light one — see `docs/dashboard-next.md` "Shared modules" and "Promotion checklist".

**Production deploy posture.** MediaMTX itself must remain unreachable from the public internet on its read ports (`8889/tcp` signaling, `8554/tcp` RTSP, `9997/tcp` HTTP API). Only the api-server should be able to reach them; the UDP ICE port (`8189/udp`) stays public so browsers can negotiate ICE. See `../upstream-streaming-server/docs/stream-auth.md` (Read-path auth section).

## Out of scope (today)

- "Live wall" tile view of all currently-streaming cameras across the account.
- TURN servers for browsers behind restrictive NATs (today MediaMTX uses its own host candidates).
- Agent detail page (`getAgent()` exists in `src/lib/api/agents.ts` but no route consumes it yet).
- Stream-session detail page (`getStreamSession()` likewise).
- Team management (invite / role change), billing, snapshot recording history.
- Real-time via Supabase channels for general resource lists (cameras, agents, sessions, tokens) — polling is good enough today. The one exception is the camera detail page, which uses a Realtime subscription on `stream_sessions` to drive sub-second state transitions; both `/dashboard` and `/dashboard-next` versions exist (see `docs/dashboard-next.md` "Realtime channel naming convention" for how they coexist).
- Password reset / email change UI (the `createSupabaseBrowserClient` factory in `src/lib/supabase/client.ts` is kept around for this; nothing imports it yet).

## Source-of-truth pointers

- API contract: `../upstream-api-server/docs/api-contracts.md` (status codes, error envelopes).
- Platform architecture: `../upstream-api-server/docs/architecture.md`.
- Schema: `../upstream-api-server/supabase/migrations/`.
- Plan that produced this MVP: `~/.claude/plans/gleaming-moseying-corbato.md` (operator-only).
