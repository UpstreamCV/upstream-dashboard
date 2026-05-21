# dashboard-next — architecture, conventions, promotion

The canonical reference for the parallel light-theme redesign at `src/app/dashboard-next/`. Pair this doc with `docs/architecture.md` (the live `/dashboard` flow — most of it applies to `/dashboard-next` too because the data layer is shared) and `src/app/dashboard-next/README.md` (the at-a-glance status table).

## Purpose & status

`/dashboard-next` is a parallel redesign of the operator dashboard. It is **fully wired** as of 2026-05-19 (every page reads real data; camera detail has the WHEP player + latest frame + Realtime listener; tokens have create/revoke; login is publicly reachable and wired to `signInAction`). It is the target replacement for `/dashboard`. Both routes coexist in the same Next 16 app so we can iterate on the new design without disturbing production users.

Two of the home tiles (Network, Billing) remain illustrative — see [Placeholder tiles](#placeholder-tiles).

## Architecture

### Segment scope

Everything light-themed is **scoped** to the `/dashboard-next` segment. Three layers of insulation:

- **CSS class scope.** `src/app/dashboard-next/layout.tsx` puts `className="dashboard-next ..."` on the segment's root element. Every theme rule in `theme.css` is nested under `.dashboard-next` so it cannot match anything on `/dashboard` or `/(auth)`.
- **Token naming.** All CSS variables are `--dn-*`; all utility classes are `.dn-*`. Even if the cascade ever leaked, nothing would collide with the app's existing tokens (`--accent`, `--ink`, `.glass`, etc.).
- **Component naming.** Components live under `src/components/dashboard-next/` and are typically suffixed `-next` (e.g. `live-stream-player-next.tsx`). On promotion the suffix and the folder both go away (see [Promotion checklist](#promotion-checklist)).

### Route structure

```
src/app/dashboard-next/
├── layout.tsx             # Segment root: theme + Satoshi font only. No auth.
├── theme.css              # .dn-* tokens, scoped under .dashboard-next.
├── fonts.ts / fonts/      # Self-hosted Satoshi, segment-scoped preload.
├── loading.tsx            # Suspense fallback (scoped backdrop + skeletons).
├── error.tsx              # Error boundary; reportError(err, { area: "dashboard-next" }).
├── README.md              # Status table + sanctioned surface.
├── login/                 # PUBLIC route, outside the (app) group.
│   └── page.tsx
└── (app)/                 # Route group (no URL segment).
    ├── layout.tsx         # getActiveAccount() + chrome (sidebar/topbar/scroll).
    ├── page.tsx           # Home — 9 metric tiles.
    ├── cameras/
    │   ├── page.tsx
    │   └── [cameraId]/
    │       ├── page.tsx
    │       └── not-found.tsx
    ├── agents/page.tsx
    ├── stream-sessions/page.tsx
    └── api-tokens/
        ├── page.tsx
        └── actions.ts     # createTokenAction, revokeTokenAction.
```

The `(app)` route group adds no URL segment but holds the authed-only chrome and `getActiveAccount()` gate. The `login/` route sits **outside** `(app)` so it renders without auth check or sidebar/topbar — see [proxy.ts](#auth-routing).

### Layout flow

`(app)/layout.tsx` composes the shell in this order (back to front, outermost to innermost):

1. `<ShellBackdrop />` — 5 drifting orbs over the creek wash. Reduced-motion respected via `theme.css`.
2. `<CursorGlow />` — Window-level pointer tracker that feeds `--mx/--my/--glow` CSS vars to every `.dn-glow-soft` button so the white sheen fades in as the pointer approaches.
3. `<TopbarNext />` — Server Component greeting + logo + presentational search.
4. `<SidebarNext />` + `<main className="dn-panel"><ScrollArea>{children}</ScrollArea></main>`. The shell is `h-dvh + overflow-hidden`; only the content inside `<ScrollArea>` scrolls, and the custom scrollbar overlays the panel.

## Data flow

Three patterns. Every read goes through `/api/upstream` (browser) or `serverFetch` (server). No direct Supabase queries except the sanctioned Realtime subscription on camera detail.

### Pattern 1: Server fetch → polling client wrapper

The default for every list page. The Server Component runs parallel fetches and hands `initialData` to a Client Component wrapper which uses `useUpstreamList` (`src/lib/api/use-list.ts`) for 10 s polling.

```ts
// (app)/cameras/page.tsx (sketch)
const [cameras, agents] = await Promise.all([
  listCameras({ accountId: activeAccountId }),
  listAgents({ accountId: activeAccountId }),
]);
return <CamerasGridClient initialCameras={cameras} initialAgents={agents} />;

// cameras-grid-client.tsx
const cameras = useUpstreamList<CameraListResponse>("/v1/cameras",
  { fallbackData: { cameras: initialCameras } }).data?.cameras ?? initialCameras;
```

| Route | Endpoints | Cadence |
|---|---|---|
| `/dashboard-next` | `/v1/dashboard/summary`, `/v1/agents`, `/v1/api-tokens`, `/v1/account/limits` (`/v1/account` static) | 10 s × 4 |
| `/dashboard-next/cameras` | `/v1/cameras`, `/v1/agents` | 10 s × 2 |
| `/dashboard-next/agents` | `/v1/agents` | 10 s |
| `/dashboard-next/stream-sessions` | `/v1/stream-sessions?limit=100` | 10 s |
| `/dashboard-next/cameras/[id]` | `/v1/cameras/{id}/latest-frame` | 7 s — see [Camera detail](#camera-detail) |
| `/dashboard-next/api-tokens` | `/v1/api-tokens` | none (Server Action revalidates after mutations) |

10 s aligns with SWR's default `dedupingInterval` (3 s) leaving plenty of headroom. 7 s on snapshots is deliberately faster than the agent's ~5 s snapshot upload cadence — picking 10 s would mean repeated 304-like polls of an unchanged frame; picking 5 s would race the agent's write. 7 s lands consistently after each new snapshot.

### Pattern 2: Server fetch → Server Action mutation

`(app)/api-tokens/` uses Server Actions (`createTokenAction`, `revokeTokenAction`) rather than polling. Token state changes are infrequent and explicit; after each mutation the action calls `revalidatePath("/dashboard-next/api-tokens")` and the next render picks up the new row. No client-side polling required.

The actions file is a mirror of `src/app/dashboard/settings/api-tokens/actions.ts` — same upstream POST/DELETE shapes, only the revalidation path differs.

### Pattern 3: Direct Supabase Realtime (sanctioned exception)

`<CameraDetailRealtimeNext />` (`src/components/dashboard-next/camera-detail-realtime-next.tsx`) subscribes to `postgres_changes` on the `stream_sessions` table filtered by `camera_id`. On every state transition it calls `router.refresh()`, which re-runs the page's Server Component fetches and re-renders. This is faster than polling — sub-200 ms vs. the 10 s SWR tick — and is **sanctioned by `AGENTS.md`**:

> when a component needs near-real-time push instead of polling, subscribe to Supabase Realtime via `createSupabaseBrowserClient()` filtered to a single row/column. This is a sanctioned exception to the "all reads through `/api/upstream`" rule because broadcasts are a push channel, not a read — and Realtime respects the same RLS policies the proxy honors.

See [Realtime channel naming](#realtime-channel-naming-convention) for the `dn-` prefix.

## Camera detail

`(app)/cameras/[cameraId]/page.tsx` is the most intricate page in either dashboard. Five concurrent data sources feed it:

1. **`getCamera`** — the page's primary subject. 404 from this triggers `notFound()` and renders `not-found.tsx`.
2. **`getAgent`** — gracefully `null` on 404 (agent may have been deleted while the camera row persists).
3. **`listStreamSessions({ cameraId, limit: 1 })`** — the most recent session, used to drive the live-stream panel.
4. **`getLatestFrame`** — already returns `null` on `snapshot_not_found`; the latest-frame card polls this endpoint on its own.
5. **`listValidations({ sessionId })`** — only if there's a current session.

Four client islands inside the page:

- **`LiveStreamPlayerNext`** — WHEP client. Signals go through `/api/upstream/v1/stream-sessions/{id}/whep`, so the api-server enforces account-scoped auth; the browser never sees the agent's bearer token. Backoff schedule `[500, 1000, 2000, 4000, 8000]` ms; tear-down on visibility-hidden and `pagehide` (bfcache); reconnect on visibility-return. Dispatches a window-scoped `upstream:player-state` custom event on every state transition, filtered by `cameraId` so a second tab on a different camera can't flip this badge. See `src/components/stream/player-state-event.ts` for the contract.

- **`LatestFrameCardNext`** — `useUpstreamList` polling `/v1/cameras/{id}/latest-frame` on a 7 s cadence. Renders the `signed_url` from Supabase Storage (private bucket, time-limited URLs) and the captured-at relative time. Empty state when 404 / `snapshot_not_found`.

- **`CameraDetailRealtimeNext`** — Realtime listener (above). Returns `null` from render; purely a side-effect component.

- **`CameraStreamStatusBadgeNext`** — Bridges the DB's `cameras.status` column to the WebRTC player's connection state. The DB flips to `streaming` the moment MediaMTX accepts the SRT publish, but the dashboard's WHEP player needs another 1–3 s to handshake + first keyframe. Without this bridge the badge says "streaming" above a "Connecting…" video pane. While `cameras.status === "streaming"` but the player hasn't dispatched `connected`, the badge displays `connecting` instead. See `src/components/stream/camera-stream-status-badge.tsx` for the original (the dashboard-next port preserves the logic and React-19 render-time reset pattern).

## Token security

The plaintext API token is shown exactly once at creation, then never again — neither stored nor logged. `src/components/dashboard-next/token-create-dialog-next.tsx` is the *only* component in the entire app that ever holds the plaintext (in its `secret` React state).

The dialog wipes `secret` on every plausible "the user looked away" signal. The wipe matrix has five paths:

1. **Dialog close** — `handleOpenChange(false)` calls `setSecret(null)`.
2. **Window blur** — `window.addEventListener("blur", wipe)`.
3. **Document visibility hidden** — `document.visibilitychange` → if `visibilityState === "hidden"`, wipe.
4. **Before-unload** — `window.addEventListener("beforeunload", wipe)` (browser will discard memory anyway, but the explicit wipe matches the "never persist" contract).
5. **Route change** — `usePathname()` effect compares previous vs. current and wipes on change.

This matches `src/components/tokens/token-create-dialog.tsx` (the dark dialog) exactly. **Both implementations must stay in lockstep** — see also `docs/architecture.md` "Token plaintext hygiene" for the platform-level posture.

One implementation note specific to dashboard-next: Radix's `Dialog.Portal` mounts the dialog content outside the segment's `<div className="dashboard-next">` scope, so `.dn-*` styles wouldn't apply. The dashboard-next dialog wraps both `Dialog.Overlay` and `Dialog.Content` in an extra `<div className="dashboard-next">` inside the portal to re-establish the cascade.

## Theme system

### Naming convention

| Scope | Pattern | Examples |
|---|---|---|
| CSS variables | `--dn-*` | `--dn-tile`, `--dn-text-50`, `--dn-creek-mid`, `--dn-radius-tile` |
| Utility classes | `.dn-*` | `.dn-tile`, `.dn-panel`, `.dn-rail`, `.dn-btn`, `.dn-field`, `.dn-glow-soft` |
| Scope wrapper | `.dashboard-next` | every rule in `theme.css` is nested under it |

The `--dn-` prefix is the namespace-isolation lever — even if a `.dn-tile` rule somehow leaked outside `.dashboard-next`, nothing in production matches `--dn-tile` so the cascade is harmless. Conversely, **never** reference an old-dashboard token (`var(--accent)`, `var(--ink-soft)`) from inside the segment — the segment is intentionally decoupled.

### Token glossary

| Category | Tokens | Use |
|---|---|---|
| Palette | `--dn-creek-{deep,mid,moss,dark}` | Brand colors; backdrop, gradients, accents |
| Surfaces | `--dn-tile` (white), `--dn-shell` (creek wash) | Card / panel backgrounds |
| Text | `--dn-text` (black), `--dn-text-70`, `--dn-text-50`, `--dn-text-15` | Primary / secondary / disabled / subtle text |
| Sizing | `--dn-radius-tile`, `--dn-radius-panel` | Border-radius (clamp-scaled) |
| Effects | `--dn-shadow-tile` | Card drop shadow |
| Gradients | `--dn-grad-text`, `--dn-grad-btn` | Active sidebar label, login button |

The utility classes (`.dn-tile`, `.dn-panel`, etc.) compose these tokens with sizing, blur, and shadow rules. See `theme.css` for the full set — every rule is inline-commented with its Figma origin.

### Adding a new token

1. Declare it inside the `.dashboard-next { … }` block at the top of `theme.css`, beside its category neighbors.
2. Inline-comment what it's for and its Figma origin.
3. Use it from components via `className="text-[var(--dn-new)]"` or by adding a new `.dn-*` utility class (also under `.dashboard-next`) if the rule is reused.
4. Never reference it from outside `.dashboard-next`.

## Realtime channel naming convention

While `/dashboard` and `/dashboard-next` run in parallel, each side uses a distinct Realtime channel name so a tab on one dashboard doesn't refresh the other's badge.

- **Old dashboard** (`src/app/dashboard/cameras/[cameraId]/camera-detail-realtime.tsx`): `camera:${cameraId}:sessions`
- **New dashboard** (`src/components/dashboard-next/camera-detail-realtime-next.tsx`): `dn-camera:${cameraId}:sessions`

Both subscriptions watch the same underlying `stream_sessions` rows — RLS filters them identically — but each channel is its own subscriber set on Supabase Realtime's side. A user with both tabs open on the same camera ends up with two subscriptions and two `router.refresh()` calls on each transition; that's correct (each tab needs to re-render its own RSC tree).

**On promotion**, drop the `dn-` prefix so the new dashboard uses the original name. The promotion checklist below calls this out.

## Shared modules

Two files live under the *old* dashboard's tree but are imported by both dashboards. They are de-facto shared code and must stay coherent across both versions.

| File | What it is | Used by |
|---|---|---|
| `src/components/stream/player-state-event.ts` | Custom DOM event name + payload type + dispatcher | both WHEP players, both status badges |
| `src/lib/webrtc/whep-client.ts` | WHEP offer/answer negotiator | both WHEP players |

Both have JSDoc headers calling out the shared use. On promotion they move (see checklist step 7).

## Auth routing

`proxy.ts` (Next 16's renamed `middleware.ts`) handles three things relevant to dashboard-next:

- **PUBLIC_PATHS** includes `/dashboard-next/login`. Anything else under `/dashboard-next/*` redirects unauthenticated users to `/login?next=…`. The matching rule is exact-or-prefix-with-slash — adding a new public path automatically opens every subpath (see the inline comment in `proxy.ts`).
- **Post-login redirect for `/dashboard-next/login`.** Logged-in users visiting `/dashboard-next/login` are sent to `/dashboard-next` (mirrors the existing `/login` → `/dashboard` branch).
- **Session refresh.** The proxy still triggers a side-effect `getUser()` call on every request, which refreshes the Supabase session cookie. This is identical to the old dashboard.

## Placeholder tiles

Two tiles on the home page (`(app)/page.tsx`) remain illustrative. Both are inline-commented with the missing service and a one-line rationale, and both are surfaced in `src/app/dashboard-next/README.md`.

- **Network** — Would show an aggregate latency across the fleet. `upstream-api-server` exposes per-device heartbeats (via `agent.last_seen_at` + the cameras endpoint) but no aggregate latency endpoint. A future endpoint or a client-side fan-out would back this tile.
- **Billing** — Would show month-to-date spend and projection. There is no billing or metering service in the platform yet. The tile is kept for the Figma layout.

The Plan & Usage tile is partially wired: cameras and concurrent sessions are real; **minutes used** is `null` (the `UsageMeter` renders `—`) because `upstream-api-server` exposes the cap (`monthly_minutes_quota`) but not consumption.

## Promotion checklist

When `/dashboard-next` is ready to become `/dashboard`. This is the **authoritative** version (the README points here):

1. **Retire the old segment.** Rename `src/app/dashboard/` → `src/app/dashboard-legacy/` (or delete it after a grace period).
2. **Rename the new segment.** `src/app/dashboard-next/` → `src/app/dashboard/`.
3. **Find-replace `/dashboard-next/` → `/dashboard/`** across hrefs, route checks, redirects:
   - `sidebar-next.tsx` nav `href` and `match` regexes
   - `home-overview-client.tsx` tile `actionHref`s
   - `camera-card.tsx` Link href
   - `cameras/[cameraId]/page.tsx` + `not-found.tsx` Link hrefs
   - `login-form-next.tsx` `next` default
   - `proxy.ts` PUBLIC_PATHS + post-login redirect
   - `(app)/api-tokens/actions.ts` `revalidatePath` argument
   - `error.tsx` `reportError(area:)` and all `reportError` call sites under `src/components/dashboard-next/`
4. **Rename chrome files.** `sidebar-next.tsx` / `topbar-next.tsx` → `sidebar.tsx` / `topbar.tsx`, replacing the old ones.
5. **Move components.** `src/components/dashboard-next/*` → wherever the new home is. Either drop the `-next` suffix in place (keeping the folder) or move into `src/components/{nav,data,stream,tokens,...}/` to mirror the old organization.
6. **Drop the Realtime `dn-` prefix.** Change `dn-camera:${cameraId}:sessions` back to `camera:${cameraId}:sessions` in the (renamed) realtime file. Delete the channel-naming note from this doc and `camera-detail-realtime-next.tsx`.
7. **Move shared modules** to a permanent home:
   - `src/components/stream/player-state-event.ts` → `src/lib/stream/player-state.ts` (or `src/lib/realtime/`)
   - `src/lib/webrtc/whep-client.ts` → stays put, or moves under `src/lib/stream/whep.ts`
   - Update imports in both the renamed dashboard and any vestigial old code.
8. **Fold or keep the theme.** Decide whether to fold `theme.css` into `globals.css` (single theme app-wide) or keep the scoped light theme as-is. Either way, decide once.
9. **Update docs.** `AGENTS.md`, this file, `docs/architecture.md`, `docs/commit-log.md`, `src/app/dashboard-next/README.md` (becomes `src/app/dashboard/README.md` or is deleted entirely).
10. **Final sweep.** `git grep -i "dashboard-next\|dn-\|--dn-"` should turn up nothing outside `theme.css` (if kept) and the promotion's own commit-log entry.

## Conventions echoed from AGENTS.md

These apply identically to `/dashboard-next`:

- **Server-first.** Every page is a Server Component; `"use client"` only for polling, WHEP, Realtime, dialogs, and the cursor-glow / scroll-area effects.
- **Account scoping.** Every `serverFetch` gets an explicit `accountId` from `getActiveAccount()`. The proxy auto-injects for browser calls.
- **No browser auth token.** Client components use `proxyFetch` / `useUpstreamList`; only `<CameraDetailRealtimeNext />` calls `createSupabaseBrowserClient()`, and that's the sanctioned Realtime exception.
- **Errors via `reportError`.** Tag with `area: "dashboard-next"` (or a sub-area like `"dashboard-next/live-stream-player"`).
- **Token plaintext** lives only in the dialog. See [Token security](#token-security).
