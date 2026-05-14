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

## Out of scope (today)

- WebRTC playback. Streaming-server hasn't defined the WHEP URL convention yet. `<PlaybackComingSoon />` is the single drop-in point.
- Agent detail page (`getAgent()` exists in `src/lib/api/agents.ts` but no route consumes it yet).
- Stream-session detail page (`getStreamSession()` likewise).
- Team management (invite / role change), billing, snapshot recording history.
- Real-time via Supabase channels — the polling cadence above is good enough for the data shapes today.
- Password reset / email change UI (the `createSupabaseBrowserClient` factory in `src/lib/supabase/client.ts` is kept around for this; nothing imports it yet).

## Source-of-truth pointers

- API contract: `../upstream-api-server/docs/api-contracts.md` (status codes, error envelopes).
- Platform architecture: `../upstream-api-server/docs/architecture.md`.
- Schema: `../upstream-api-server/supabase/migrations/`.
- Plan that produced this MVP: `~/.claude/plans/gleaming-moseying-corbato.md` (operator-only).
