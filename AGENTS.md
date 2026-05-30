# AGENTS.md — upstream-dashboard

Guidance for coding agents (and humans) working in this repo.

## This is NOT the Next.js you know

This project pins **Next.js 16.2.6**. APIs, conventions, and file structure differ from older Next versions. Read the relevant guide in `node_modules/next/dist/docs/` before writing non-trivial app code. Heed deprecation notices.

Especially relevant Next 16 changes already baked into this repo:

- **`middleware.ts` is now `proxy.ts`** at the project root. See `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`. We use it for Supabase session refresh + auth gating.
- **`cookies()` is async.** Always `await cookies()` before calling `.get/.set/.delete`. The `@supabase/ssr` cookies adapter we use returns `Promise<...>` from `getAll/setAll` (verified day-zero against v0.10.3).
- **Caching defaults changed.** `fetch()` is **not** cached by default; opt-in with `use cache`. We rely on this — `serverFetch` always uses `cache: "no-store"`.
- **`next build` no longer auto-runs lint.** Run `npm run lint` explicitly. Pre-commit / CI should call it.
- **`unstable_instant` route export** for fast client navigation between dynamic routes; consider it before adding heavy dynamic routes.

## Architecture in one paragraph

This is the operator dashboard. It talks to `upstream-api-server` via the catch-all proxy at `src/app/api/upstream/[...path]/route.ts`, which mints the Supabase JWT server-side. The proxy auto-injects `?account_id=` from the `upstream_active_account` cookie (resolved by `getActiveAccountIdFromCookie()` + a single-membership fallback through `listMemberships()`; the redirecting `getActiveAccount()` is deliberately **not** used inside the proxy). All resource reads go through `serverFetch` (RSC, Server Actions) or `proxyFetch`/`useUpstreamList` (Client Components) — there are no direct Supabase queries from app code. The only Supabase client calls in the repo are auth-related: session refresh in `proxy.ts`, sign-in/sign-up Server Actions, and `getSession()` inside `serverFetch` to mint the bearer token. See `docs/architecture.md` for the full picture.

## dashboard-next (now the default `/dashboard`)

The light-theme redesign that lived at `src/app/dashboard-next/` was **promoted to the default `/dashboard` on 2026-05-29** (route-level rename). The previous dark dashboard is preserved as a navigable fallback at **`/dashboard-legacy`** (`src/app/dashboard-legacy/`). The new dashboard is fully wired (every page reads real data; the camera detail page has WHEP + latest frame + Realtime; tokens have create/revoke; the light login is public at `/dashboard/login`). It reuses the same `/api/upstream` proxy, `serverFetch` / `useUpstreamList`, account scoping, and auth — no duplication of the data layer. Two home tiles (Network, Billing) remain illustrative because the backing services don't exist yet.

The component folder (`src/components/dashboard-next/`), the `.dashboard-next` theme scope / `--dn-*` tokens, and the `-next` component-name suffixes are **kept as-is for now** — dropping them would delete components the live `/dashboard-legacy` fallback still imports. Those cleanup steps are deferred until the fallback is retired.

Read `docs/dashboard-next.md` for the canonical reference: architecture, theme tokens, the Realtime channel-naming convention (the new dashboard uses `camera:…`; `/dashboard-legacy` uses `legacy-camera:…`), shared modules (`player-state-event.ts`, `whep-client.ts`), token security model, and the promotion checklist (route steps done; cleanup deferred). `src/app/dashboard/README.md` has the at-a-glance route status table.

### Route policy — `/dashboard` is the live dashboard; `/dashboard-legacy` is the fallback

- New product-facing dashboard features (geometry editor, reliability surfaces, camera workflow tabs, review/debug UI) build under `/dashboard` (`src/app/dashboard/(app)/`). Do **not** add new feature work to `/dashboard-legacy` — it exists only as a rollback fallback and will be retired.
- `/dashboard-legacy` remains available for rollback during the confidence period; bug-fix only.
- New theme-agnostic perception/observation helpers go under `src/lib/perception/` so both segments can share them (see `src/lib/perception/overlay-helpers.ts`, `overlay-svg.tsx`, `summarize-observation.ts`).
- New dashboard UI components still go under `src/components/dashboard-next/` (the `-next` suffix and folder are retained until the fallback is retired — see the deferred cleanup in `docs/dashboard-next.md`).
- New dashboard routes go under `src/app/dashboard/(app)/`.

## Source of truth for API contracts

`../upstream-api-server/docs/` is authoritative:
- `api-contracts.md` — endpoint shapes, error codes, env vars, JWT claim format
- `architecture.md` — phased delivery + state machines + identity classes
- `supabase/migrations/` — schema + RLS policies

Error envelope: `{ "error": { "code", "message", "details", "request_id" } }`. Codes are stable; messages are not. Switch on `code`. See `src/lib/api/errors.ts` for the canonical category mapping + friendly messages.

## Conventions baked into the codebase

- **Path alias**: `@/*` → `./src/*`.
- **Server vs Client**: prefer Server Components. Use `"use client"` only when something genuinely needs the browser (interactive state, browser APIs, SWR polling). All Supabase queries and direct-Supabase reads must be server-side.
- **Auth header**: never include the Supabase access token in browser JS. Use `/api/upstream/...` from the client; `serverFetch` from the server.
- **Account scoping**: `serverFetch` requires explicit `accountId`. The proxy auto-injects from the cookie. Never assume ambient state.
- **Polling**: client components use `useUpstreamList` from `src/lib/api/use-list.ts`. Don't reach for raw `useSWR` unless polling something outside the upstream proxy (latest-frame is one such case).
- **Live updates (Supabase Realtime)**: when a component needs near-real-time push instead of polling, subscribe to Supabase Realtime via `createSupabaseBrowserClient()` filtered to a single row/column. This is a sanctioned exception to the "all reads through `/api/upstream`" rule because broadcasts are a push channel, not a read — and Realtime respects the same RLS policies the proxy honors. Today both `camera-detail-realtime.tsx` (dark, `/dashboard`) and `camera-detail-realtime-next.tsx` (light, `/dashboard-next`) do this, watching `stream_sessions` for state transitions on distinct channel names — see `docs/dashboard-next.md` "Realtime channel naming convention". Don't use Realtime for resource fetching — only for change notifications that trigger `router.refresh()` or local state updates derived from the broadcast row.
- **Errors**: route all unexpected errors through `reportError(err, { area })` from `src/lib/error.ts`. Don't sprinkle `console.error` — one chokepoint = easy Sentry swap later.
- **Token plaintext**: only the `<TokenCreateDialog />` ever holds the plaintext. Don't lift, persist, log, cache, or place in URLs. Wipes on dialog close, tab hide, blur, beforeunload, route change.
- **Secrets**: nothing prefixed `NEXT_PUBLIC_*` may carry a secret. The Supabase **service role key** must never live in this repo.

## Commit / doc policy

Every meaningful commit updates `docs/commit-log.md` in the same commit, plus any other affected doc (`README.md`, this file, `docs/architecture.md`). Small mechanical changes (typo, dep bump) may be batched with the next real commit.

## Stack notes

- **Tailwind v4**: no `tailwind.config.js`. Brand tokens are in `src/app/globals.css` under `:root` + `@theme inline`. Use semantic classes (`text-ink`, `text-accent`, `bg-glass-bg`, etc.) rather than raw hex.
- **Scoped light theme for dashboard-next**: `--dn-*` CSS vars + `.dn-*` utility classes scoped under `.dashboard-next` in `src/app/dashboard-next/theme.css`. Never reference them from outside the segment, and never reference prod tokens (`--accent`, `--ink-soft`, `.glass`) from inside it. See `docs/dashboard-next.md` "Theme system".
- **ESLint 9 flat config** in `eslint.config.mjs`.
- **No date library** — `Intl.DateTimeFormat` + `Intl.RelativeTimeFormat` via `src/lib/time.ts`.
- **No UI primitives kit** (no shadcn). Components live under `src/components/`. The only Radix primitive is `@radix-ui/react-dialog` for the secret-reveal modal.
- **App Router only.** Do not introduce `pages/`.

## Adding a new dashboard page (cookbook)

1. Drop a Server Component under `src/app/dashboard/(app)/<segment>/page.tsx`. The `(app)` route group adds no URL segment but holds the authed chrome + auth gate (see `(app)/layout.tsx`); the resulting URL is `/dashboard/<segment>`. (Legacy `/dashboard-legacy/` uses a flat structure with no route group — don't add new pages there.)
2. `getActiveAccount()` already runs in `(app)/layout.tsx` for the chrome; call it again in the page only when you need `activeAccountId` for a fetch (`serverFetch` is `cache: "no-store"`, so the duplicate is cheap).
3. Call resource functions in `src/lib/api/*.ts` (or add new ones following the existing shape — wrap `serverFetch`, accept `{ accountId, ... }`).
4. If the page needs polling, hand the initial data to a Client Component using `useUpstreamList(...)` from `src/lib/api/use-list.ts`.
5. Empty/loading/error states are part of the page, not a phase 2 cleanup. Page-level `loading.tsx` / `error.tsx` exist under `src/app/dashboard/` and inherit by default.
6. Add the route to the sidebar in `src/components/nav/sidebar-next.tsx`.

## Day-zero verifications to repeat when bumping deps

- `@supabase/ssr` cookies adapter types still accept `Promise<...>` returns. (Source: `node_modules/@supabase/ssr/dist/main/types.d.ts`.)
- Snapshot bucket in Supabase Storage is still private (signed URLs only).
- RLS policy `stream_validations_member_select` still exists (see `upstream-api-server/supabase/migrations/20260512130300_stream_sessions.sql`).
