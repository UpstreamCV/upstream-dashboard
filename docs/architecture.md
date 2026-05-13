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
3. **Active account resolution.** `getActiveAccount()` (`src/lib/account/active.ts`) is called from every `(dashboard)/*` Server Component. It validates the `upstream_active_account` cookie against the user's actual memberships (queried via the Supabase server client; RLS scopes to `auth.uid()`), auto-picks for single-membership users, and redirects multi-membership users with no pin to `/select-account`. Stale cookies (pointing at an account the user no longer belongs to) are cleared automatically.
4. **API calls (browser).** Client components use SWR pointed at `/api/upstream/...`. The catch-all Route Handler (`src/app/api/upstream/[...path]/route.ts`) verifies the Supabase session, fetches the access token via `getSession()`, injects `Authorization: Bearer <access_token>`, appends `?account_id=` from the cookie (with a single-membership fallback), and forwards method/body/query to `upstream-api-server`. `Cookie`, `Host`, and `Authorization` headers are stripped before forwarding.
5. **API calls (server).** Server Components and Route Handlers use `serverFetch` (`src/lib/api/server.ts`), which mints the same `Authorization` server-side but requires the caller to pass `accountId` explicitly. No ambient state.

The Supabase access token therefore never appears in browser JavaScript or `localStorage`. It lives in HTTP-only cookies and is read only by Next-side code.

### Auth-recovery

If the upstream-api returns `403 account_id_required` or `403 forbidden_account`, the catch-all proxy rewrites the response to `401`, deletes the `upstream_active_account` cookie, and lets the client SWR handler (`defaultSwrConfig.onError`) redirect to `/login?next=…` (which through the proxy gate will land on `/select-account` once the user is signed in). This single recovery path handles both expired Supabase sessions and drifted account pins.

## Direct Supabase reads (for known gaps)

Four pieces of data the dashboard needs aren't exposed by `upstream-api-server` yet:

| Data | Today | Followup api-server endpoint |
|---|---|---|
| List API tokens for an account | Supabase server-side, columns whitelisted (no `hash`) | `GET /v1/api-tokens` |
| Latest snapshot per camera + Storage signed URL | Supabase server-side, 60 s signed URL | `GET /v1/cameras/{id}/latest-frame` |
| Stream validations for a session | Supabase server-side (`stream_validations_member_select` RLS) | `GET /v1/stream-sessions/{id}/validation` |
| Dashboard summary counts | Client-side derivation from list endpoints | `GET /v1/dashboard/summary` |

These reads are all RLS-protected (server policies in `upstream-api-server/supabase/migrations/`). They live entirely server-side (Server Components or Route Handlers) — the dashboard never executes Supabase queries from browser code. The migration target is clear: replace the direct Supabase query with `serverFetch` once the api-server endpoint lands. Each is a single-file change.

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
- Account signup. Manual seeding (see `README.md`).
- Agent detail page; dev/stream-health debug page; team/billing/recording surfaces.
- Real-time via Supabase channels.

## Source-of-truth pointers

- API contract: `../upstream-api-server/docs/api-contracts.md` (status codes, error envelopes).
- Platform architecture: `../upstream-api-server/docs/architecture.md`.
- Schema: `../upstream-api-server/supabase/migrations/`.
- Plan that produced this MVP: `~/.claude/plans/gleaming-moseying-corbato.md` (operator-only).
