# dashboard-next — architecture, conventions, promotion

The canonical reference for the light-theme dashboard now at `src/app/dashboard/` (renamed from `src/app/dashboard-next/` on promotion). Pair this doc with `docs/architecture.md` (the dashboard data flow) and `src/app/dashboard/README.md` (the at-a-glance status table).

> **Promotion status (2026-05-29): EXECUTED at the route level.** The new dashboard is now the default at **`/dashboard`**; the previous dark dashboard is preserved as a navigable fallback at **`/dashboard-legacy`**. Done: the folder rename + route/import/redirect/Realtime updates from the [promotion checklist](#promotion-checklist). **Deferred** (would delete components the live `/dashboard-legacy` fallback still imports): dropping `-next` component suffixes, moving components, renaming chrome files, and folding the theme. Realtime channels: the new dashboard now uses `camera:…`; `/dashboard-legacy` uses `legacy-camera:…`. **Note:** the deep-dive sections below still write `/dashboard-next/*` and `src/app/dashboard-next/` in examples — read those as `/dashboard/*` and `src/app/dashboard/` until a later doc sweep.

## Purpose & status

`/dashboard-next` is a parallel redesign of the operator dashboard. It is **fully wired** as of 2026-05-19 (every page reads real data; camera detail has the WHEP player + latest frame + Realtime listener; tokens have create/revoke; login is publicly reachable and wired to `signInAction`). It is the target replacement for `/dashboard`. Both routes coexist in the same Next 16 app so we can iterate on the new design without disturbing production users.

Two of the home tiles (Network, Billing) remain illustrative — see [Placeholder tiles](#placeholder-tiles).

## Route policy

`/dashboard-next` is the target for **all new product-facing dashboard work**. New feature work — the P6-B latest-frame geometry editor, reliability surfaces, camera workflow tabs, review queue, debug UI — builds here.

- Legacy `/dashboard` is available for production stability and bug fixes only. Do not add new major features to it unless explicitly approved.
- Theme-agnostic perception/observation helpers live under `src/lib/perception/` (`overlay-helpers.ts`, `overlay-svg.tsx`, `summarize-observation.ts`) so both segments share them without duplication. Previously these lived under `src/app/dashboard/cameras/[cameraId]/`; the route-placement was historical.
- Dashboard-next UI components live under `src/components/dashboard-next/` (suffix `-next` until promotion).
- Dashboard-next routes live under `src/app/dashboard-next/(app)/`.

The promotion checklist (below) eventually retires the legacy segment — but until then, every new feature goes here, not there. Each ported feature shrinks the promotion's blast radius.

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
    │       ├── layout.tsx         # Persistent header + Realtime + CameraTabs.
    │       ├── page.tsx           # Redirects to ./monitor.
    │       ├── not-found.tsx
    │       ├── monitor/page.tsx       # Live stream + overlays + meta panels.
    │       ├── observations/page.tsx  # Recent processor observations + JSON.
    │       ├── configure/page.tsx     # P6-B seam — geometry editor placeholder.
    │       ├── settings/page.tsx      # Read-only camera metadata.
    │       └── reliability/page.tsx   # Stub — backend signals don't exist yet.
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

`<CameraDetailRealtimeNext />` (`src/components/dashboard-next/camera-detail-realtime-next.tsx`) subscribes to `postgres_changes` on the `stream_sessions` table and refreshes on this camera's state transitions (`router.refresh()`, which re-runs the page's Server Component fetches). This is faster than polling — sub-200 ms vs. the 10 s SWR tick — and is **sanctioned by `AGENTS.md`**:

> when a component needs near-real-time push instead of polling, subscribe to Supabase Realtime via `createSupabaseBrowserClient()` filtered to a single row/column. This is a sanctioned exception to the "all reads through `/api/upstream`" rule because broadcasts are a push channel, not a read — and Realtime respects the same RLS policies the proxy honors.

**Two non-obvious requirements (learned the hard way — see commit-log 2026-05-28/29):**

1. **Authenticate the Realtime socket.** `postgres_changes` on an RLS table authorizes each record read as the `authenticated` role, so the socket must carry the user JWT. `createSupabaseBrowserClient()` (`src/lib/supabase/client.ts`) is a **memoized singleton** that mirrors the cookie session onto the Realtime socket via `realtime.setAuth(token)` (eagerly + on `onAuthStateChange`). For an RLS-protected subscription, also `await getSession()` → `await realtime.setAuth(token)` **before** `.subscribe()` (the overlay does this) — otherwise records come back with `Error 401: Unauthorized` and an empty payload.

2. **Filter client-side, not server-side, for non-PK columns.** A server-side `filter: camera_id=eq.…` silently drops every `UPDATE` event unless the table is `REPLICA IDENTITY FULL` (Supabase can only match a filter on UPDATEs against replica-identity columns; `camera_id` is a unique index, not the PK). Our snapshot/session tables are UPSERTed → all UPDATEs, so both `CameraDetailRealtimeNext` and `LivePerceptionOverlayNext` subscribe **without** a server filter and discard non-matching `camera_id` rows in the handler. RLS still scopes delivery to the account.

The DB-side requirements for a table to be subscribable at all (publication membership, `REPLICA IDENTITY FULL`, and critically `GRANT SELECT … TO authenticated` — whose absence makes Realtime silently deliver nothing while the API still reads fine) live in **`upstream-api-server/docs/architecture.md` → "Supabase Realtime for dashboard push"** and its `troubleshooting.md`. If a channel is `SUBSCRIBED` but silent, start there.

See [Realtime channel naming](#realtime-channel-naming-convention) for the `dn-` prefix.

## Camera detail — workflow tabs

The camera detail page is a **tabbed workflow** under `(app)/cameras/[cameraId]/`. Each tab is a real route segment so deep links resolve, loading boundaries scope per tab, and per-tab fetches don't block each other.

| Tab | Route segment | Purpose | Server fetches |
|---|---|---|---|
| Monitor | `/monitor` | Live video + perception overlays + meta panels (operator view) | `getCamera`, `getAgent`, `listStreamSessions(limit:1)`, `getLatestFrame`, `getLatestPerception`, `listValidations` |
| Observations | `/observations` | Recent processor observations + per-row JSON (debug/reliability) | `listRecentObservations(limit: DEFAULT)` |
| Configure | `/configure` | P6-B seam — geometry editor placeholder + preflight link | none |
| Configure → Geometry | `/configure/geometry` | Read-only preflight: real `GeometryConfigRecord` from `/v1/cameras/{id}/geometry-config` | `getCameraGeometryConfig` |
| Configure → Detection | `/configure/detection` | M5/M6 Model & Detection editor: pick a model + object classes + tracker / confidence / FPS, save | `listModels`, `getCameraProcessingConfig` |
| Settings | `/settings` | Read-only camera metadata + ids + timestamps | `getCamera` |
| Reliability | `/reliability` | Stub — surfaces findings once backend signals exist | none |

`/cameras/[cameraId]/page.tsx` itself just `redirect()`s to `./monitor`, so bare camera URLs continue to resolve.

### Layout responsibilities

`(app)/cameras/[cameraId]/layout.tsx` is the persistent shell across all five tabs. It owns:

- `getCamera()` (404 → `notFound()`) and `listStreamSessions(limit:1)` for the header status + Realtime initial state.
- The header block: back link, eyebrow, name, `<CameraStreamStatusBadgeNext />`, copy id.
- `<CameraDetailRealtimeNext />` — mounted here so session-state pushes survive tab navigation. If it lived in `monitor/page.tsx` only, switching to Observations would silently kill push updates until the next manual nav.
- `<CameraTabs cameraId />` — the tab strip (Client Component, uses `usePathname()` for active state).

Per-tab fetches live in each tab's `page.tsx`. Layout/page fetch duplication for `getCamera` + `listStreamSessions` is accepted today (`serverFetch` uses `cache: "no-store"` per `AGENTS.md`); revisit with React `cache()` or a layout-only loader if it becomes a hot spot.

### Monitor tab — six data sources, four client islands

1. **`getCamera`** — primary subject. 404 → `notFound()`.
2. **`getAgent`** — gracefully `null` on 404 (agent may have been deleted while the camera row persists).
3. **`listStreamSessions({ cameraId, limit: 1 })`** — drives the live-stream panel.
4. **`getLatestFrame`** — returns `null` on `snapshot_not_found`; the latest-frame card polls this endpoint on its own.
5. **`getLatestPerception`** — returns `null` on `perception_snapshot_not_found`; the two perception overlay cards consume this.
6. **`listValidations({ sessionId })`** — only if there's a current session.
7. **`getLatestProcessorStatus({ cameraId, streamSessionId? })`** — returns `null` on `processor_status_not_found`; the Applied Geometry chip consumes this. Narrows by `streamSessionId` when a current session exists so the chip reflects the running runtime rather than the latest-ever historical row.

Client islands inside the Monitor tab:

- **`LiveStreamPlayerNext`** — WHEP client. Signals go through `/api/upstream/v1/stream-sessions/{id}/whep`, so the api-server enforces account-scoped auth; the browser never sees the agent's bearer token. Backoff schedule `[500, 1000, 2000, 4000, 8000]` ms; tear-down on visibility-hidden and `pagehide` (bfcache); reconnect on visibility-return. Dispatches a window-scoped `upstream:player-state` custom event on every state transition, filtered by `cameraId` so a second tab on a different camera can't flip this badge. See `src/components/stream/player-state-event.ts` for the contract.

- **`LatestFrameCardNext`** — `useUpstreamList` polling `/v1/cameras/{id}/latest-frame` on a 7 s cadence. Renders the `signed_url` from Supabase Storage (private bucket, time-limited URLs) and the captured-at relative time. Empty state when 404 / `snapshot_not_found`.

- **`LatestFramePerceptionOverlayNext`** — Renders the latest perception snapshot over the latest captured frame. Server-rendered initial data + on-demand `mutate()` + optional 5 s live toggle. Reuses the shared `<PerceptionOverlaySvg />` and helpers from `@/lib/perception/*`.

- **`LivePerceptionOverlayNext`** — Wraps `<LiveStreamPlayerNext />` via the `overlay` slot and draws the latest perception snapshot over the live video. **Free-plan-safe realtime sessions (M5):** live detections are **OFF by default** — the video preview always plays, but no Supabase Realtime connection is opened until the user clicks "Turn on live detections", which starts a **15-minute client-side viewing session** (`useLiveDetectionSession`, not persisted). A subscription is held open ONLY while `computeRealtimeGate` is satisfied — session on + not expired + stream connected + processing enabled + output fresh + tab visible — and is torn down on expiry, processing-off, stream drop, staleness, tab hide (`usePageVisible`), or unmount; on re-focus before expiry it reconnects. `streamActive` is read from the WebRTC player's `PLAYER_STATE_EVENT` (`kind === "connected"`), the same signal `CameraStreamStatusBadgeNext` uses. **Realtime-additive, poll-always-while-active:** while subscribed, each `postgres_changes` row on `latest_perception_snapshots` is written **straight into the SWR cache** (`mutate({ snapshot }, { revalidate: false })`) so the overlay renders at the processor's full emit rate. **The subscription deliberately has NO server-side `camera_id` filter** — the snapshot is UPSERTed (one row per camera) so all writes after the first are UPDATEs, and Supabase only evaluates a `postgres_changes` filter on UPDATEs against columns in the table's REPLICA IDENTITY (the PK `id`; `camera_id` is only a unique index). A `camera_id=eq.` filter therefore drops every UPDATE → "subscribed but silent". Instead RLS (`member_select`) scopes delivery to the account and the handler ignores rows whose `camera_id` ≠ the viewed camera. **Do not re-add a server-side `camera_id` filter** unless the table is set `REPLICA IDENTITY FULL`. (`camera-detail-realtime-next` had the same bug on `stream_sessions` and uses the same client-side filter.) The SWR poll runs at `LIVE_OVERLAY_POLL_MS = 250` **whenever a session is active** and `0` (no requests) otherwise — it is **never slowed by the realtime status**. This is deliberate: polling hits our own API (not Supabase), so it costs nothing against the Free plan, and a channel can report `SUBSCRIBED` yet deliver no events (e.g. the `latest_perception_snapshots` table isn't in the `supabase_realtime` publication in that environment). Slowing the poll on `SUBSCRIBED` alone — as an earlier cut did — made the overlay update only every 10s when realtime was silent; the fast poll is the robust floor and realtime is purely additive on top. The chip only says **"Realtime connected"** when row events have actually arrived within `REALTIME_DELIVERING_WINDOW_MS = 8_000` (tracked via `lastRealtimeEventAt`); a subscribed-but-silent channel reads **"Fallback polling"**, which is also the tell that the publication migration isn't applied. A `StatusDot` connection chip on the metadata line shows `deriveOverlayConnectionState` (Off / Expired / Processing disabled / Stream inactive / Processor stale / Connecting / Realtime connected / Reconnecting / Fallback polling). An always-visible disclaimer states that the in-browser boxes are a preview that may lag the video while **detections/events are still created from the actual camera stream** — it must never imply the processor is delayed or out of sync. Does not stream frame-synced metadata; shows an explicit "overlay Ns old" age and a stale warning past `staleAfterSeconds`. The gating/session/countdown logic is pure + unit-tested in `overlay-helpers.ts`; the effect/timer/visibility wiring is integration-tested under jsdom + `@testing-library/react` (per-file `// @vitest-environment jsdom`). (History: detection FPS is processor-bound — the overlay auto-scales to the emit rate; the processor was once capped at ~3 FPS by an inline upload in its frame loop, see the processor's `deepstream_runtime/README.md` "P5-C perception snapshot" pitfall.)

  **Perception-fanout WS hot path (2026-06-11, additive):** on top of poll + Realtime, the overlay opens a WebSocket to the `perception-fanout` sidecar (`upstream-streaming-server/perception-fanout/`; wire contract in that repo's `docs/perception-fanout.md`), which relays processor snapshots at **10–15 Hz with no DB on the path**. Gated by the **same** `computeRealtimeGate` as the Supabase subscription — any gate closing tears the socket down. Plumbing: `connectPerceptionStream` (`src/lib/perception/perception-ws-client.ts`, framework-free like `whep-client.ts`; jittered 500 ms→8 s backoff; re-mints the token on every (re)connect and on `bye(token_expired)`/close 4401 with no backoff penalty) ← token from `fetchPerceptionStreamToken` (`src/lib/api/perception-stream.ts`, a **client-safe** module — NOT `api/perception.ts`, which is `server-only`) → `POST /v1/cameras/{id}/perception/stream-token` through the `/api/upstream` proxy, so the browser holds no api-server URL and zero new `NEXT_PUBLIC_*` envs (`ws_url` arrives in the token response). Each frame maps via `perceptionRecordFromWsMessage` (synthetic id `ws:<camera_id>:<seq>`; `seq` gaps are normal — the sidecar drops intermediate frames for slow clients) and is written straight into the SWR cache exactly like the Realtime handler. **Poll downshift (the one sanctioned exception to "never slow the poll"):** while a WS frame arrived within `WS_DELIVERING_WINDOW_MS = 2_000` the poll relaxes 250 ms → `WS_KEEPWARM_POLL_MS = 2_000` — unlike a merely-`SUBSCRIBED` Realtime channel, `wsDelivering` is evidence of actually-delivered data, and the keep-warm tick restores the 250 ms floor within ~2 s of WS silence. The chip gains **"Live stream connected"** (`ws_connected`, green), which outranks the Realtime modes (the WS path is strictly fresher) but never the session/stream/staleness blockers. A 503 `perception_stream_not_configured` or 404 from the token endpoint stops the client for the session (no retry storm) — deployments without the sidecar behave exactly as before. Supabase Realtime stays subscribed as the first fallback tier; the token is short-lived, rides only the WS query string, and is never logged or kept in app state.

- **`RecentObservationsPanelNext`** — Lives on the Observations tab. Recent processor observations with type/limit filters, optional 5 s live polling, and per-row JSON expand. Raw fields (processor id, package id, payload) stay accessible — reliability work needs them.

- **`CameraDetailRealtimeNext`** — Realtime listener (above). Returns `null` from render; purely a side-effect component. Lives in `layout.tsx`, not Monitor, so it stays alive across tab navigation.

- **`CameraStreamStatusBadgeNext`** — Bridges the DB's `cameras.status` column to the WebRTC player's connection state. The DB flips to `streaming` the moment MediaMTX accepts the SRT publish, but the dashboard's WHEP player needs another 1–3 s to handshake + first keyframe. Without this bridge the badge says "streaming" above a "Connecting…" video pane. While `cameras.status === "streaming"` but the player hasn't dispatched `connected`, the badge displays `connecting` instead. See `src/components/stream/camera-stream-status-badge.tsx` for the original (the dashboard-next port preserves the logic and React-19 render-time reset pattern).

### Shared perception lib

The three pieces of pure perception logic are theme-agnostic and shared with legacy `/dashboard`:

- `@/lib/perception/overlay-helpers.ts` — `normalizeSnapshot`, `resolveBBox`, `selectOverlayObjects`, `formatObjectLabel`, `buildLatestPerceptionPath`, `CONFIDENCE_THRESHOLDS`, `OVERLAY_COLORS`. Pure, deterministic, defensive against malformed JSONB.
- `@/lib/perception/overlay-svg.tsx` — `<PerceptionOverlaySvg />`. Pure presentational SVG; colors come from `OVERLAY_COLORS` constants so it reads on any background. Reused unchanged by both dashboards.
- `@/lib/perception/summarize-observation.ts` — `summarizeObservation`, `buildRecentObservationsPath`, `OBSERVATION_TYPES`, `OBSERVATION_LIMITS`, `DEFAULT_OBSERVATION_LIMIT`. Pure helpers for the observations panel.

These previously lived under `src/app/dashboard/cameras/[cameraId]/`; the directory placement was historical, not architectural. New perception work goes under `@/lib/perception/` so both segments share it.

## P6-B Preflight — Geometry API + Schema Contract

The geometry editor (P6-B) will live at `/dashboard-next/cameras/[cameraId]/configure/geometry/`. Before any drawing UI ships, the data contract is wired up end-to-end against the **already-existing** `upstream-api-server` P6-A endpoints (`GET` + `PUT` on `/v1/cameras/{camera_id}/geometry-config`). The Configure tab links into this preflight; the preflight renders the camera's real saved geometry, read-only.

### Source of truth

Do not drift from these — the api-server's Pydantic models reject unknown fields with 422:

- **Pydantic models**: `../upstream-api-server/src/upstream_api/schemas/geometry.py` (`GeometryPoint`, `GeometryFrame`, `GeometryRoi`, `GeometryLine`, `GeometryConfig`, `GeometryConfigRecord`, `GeometryConfigResponse`).
- **Contract**: `../upstream-api-server/docs/api-contracts.md` around line 818.

### What's in place

- **TS types** — `src/lib/api/types.ts`. Mirrors the Pydantic shapes exactly, snake_case throughout. `GeometryConfig.version: 1` and `GeometryConfigRecord.revision: number` are two distinct fields and must not be conflated.
- **Validation** — `src/lib/perception/geometry-schema.ts`. Pure functions; mirrors every server-side rule so authoring errors fail fast in the browser instead of round-tripping through 422. `GEOMETRY_LIMITS` exposes the constants; `validateGeometryConfig` returns `GeometryValidationIssue[]` for inline error rendering; `createGeometryValidationSummary` rolls them up.
- **API wrapper** — `src/lib/api/geometry.ts`. Server-only (`import "server-only"`). `getCameraGeometryConfig` for reads, `updateCameraGeometryConfig` for the eventual PUT. There is **no** `listCameraGeometryVersions` — the server keeps no version-history endpoint today; only the current row is queryable via `revision`.
- **Preflight page** — `src/app/dashboard-next/(app)/cameras/[cameraId]/configure/geometry/page.tsx`. Server Component. Renders the real `GeometryConfigRecord`: a status banner that distinguishes "Probe default — no operator save yet" from "Operator-saved", ROI/line counts, schema/coordinate-space facts, a raw-JSON inspector, and a back link to Configure. No drawing tools.

### Always-200 GET — system probe default

The server returns a probe-default `GeometryConfig` (near-full-frame `entry-roi` + horizontal `entry-line`) when a camera has no operator save: `is_default: true`, `revision: 0`, `id: null`, null timestamps. The preflight banner makes the distinction explicit so operators can tell "system default" from "I saved this." The only 404 the GET fires is `camera_not_found`.

### Why drawing-library state never persists

The persisted schema is **UpStream-owned**: the api-server's Pydantic models use `extra="forbid"`, so any drawing-library field (selection state, fabric.js object handles, undo stack, presentation styling) sent in a PUT body is rejected with 422 `validation_error`. The editor's working state will be entirely editor-local; conversion to `GeometryConfig` happens at save time only. The `geometry-schema.ts` validator is the early-warning layer that catches drift before the network round-trip.

### Why versioning matters for reliability

Today the dashboard only sees the **current** `revision`. The number is exposed in the preflight banner so an operator can tell a save round-tripped. Future reliability work pivots on this number:

- **Observation lineage** — every processor observation should record which geometry revision produced it, so the dashboard can answer "did this event come from the geometry I'm looking at, or an old one?"
- **Findings provenance** — reliability findings tied to a revision can age out when the operator saves new geometry, instead of lingering as stale alerts.
- **Replay / shadow tests** — playing a recorded session against an alternate revision requires both revisions to be addressable; persisting per-revision history is a future api-server change.

### P6-C / P6-D

- **P6-C** — the processor begins consuming `geometry_config` on its next session. The plumbing is already in place: `/v1/internal/processor/eligible-sessions` wire-carries the camera's current geometry config so the processor doesn't need a separate fetch (see `../upstream-api-server/docs/api-contracts.md` ~line 978).
- **P6-D** — end-to-end verification: an operator saves geometry, the next session starts, observations re-emit against the new revision within seconds. The Monitor tab's perception overlay should reflect the change.

## Applied Geometry chip — Monitor-tab read of P6-C lineage

The Monitor tab carries a small read-only panel that surfaces the lineage block the P6-C analytics worker stamps onto every processor status post (`processor_statuses.payload.applied_geometry`). First visible reliability surface — the same data future findings will alert on.

**Endpoint:** `GET /v1/cameras/{id}/processor-status/latest` (P6-D). Caller-authed. Accepts `?stream_session_id=` to narrow to a specific run when multiple processor restarts have stamped overlapping rows.

**Wrapper:** `getLatestProcessorStatus({ accountId, cameraId, streamSessionId? })` in `src/lib/api/processor-status.ts`. Returns `null` on `processor_status_not_found` (mirrors `getLatestPerception` / `getLatestFrame`) so the page never has to try/catch the no-status case.

**Component:** `<AppliedGeometryPanel status={...} />` (`src/components/dashboard-next/applied-geometry-panel.tsx`). Server Component. Same `.dn-tile` shape as `CameraMetaPanel` / `AgentPanel` / `ValidationPanel`; slots into the Monitor tab's meta-panel grid as the fourth tile (grid widens from `md:grid-cols-3` to `md:grid-cols-2 xl:grid-cols-4`).

**Display helper:** `formatAppliedGeometryStatus(status)` in `src/lib/perception/applied-geometry-format.ts` — pure tagged-variant union, no React. Resolution priority (first match wins):

1. `null` → `no_status` (neutral)
2. `error_code === "geometry_invalid"` → `geometry_invalid` (danger; P6-C stamps the error code at the row level alongside `source=fallback_default_on_error` — surfacing it first gives the chip the strongest signal)
3. `payload.applied_geometry` missing → `missing_applied_geometry` (muted)
4. `source === "operator_saved"` → `operator_saved` (positive; shows revision, line/ROI counts)
5. `source === "default"` → `default` (warning; "configure and restart")
6. `source === "fallback_default_on_error"` → `fallback` (warning; shows optional saved revision + error_reason)
7. anything else → `unknown_source` (warning; renders the source label verbatim — forward-compat for future api-server source values)

**Why no polling:** processor status changes on session restarts and lifecycle transitions, not per frame. Operators inspect the chip once after a save+restart; a tab reload gives them the fresh state. Keeps the surface tiny and avoids `useUpstreamList` complexity. If operators report needing live updates without a reload, the chip can switch to a Client Component using `useUpstreamList` on a 10–15 s cadence later.

**Copy guarantee:** the panel never mentions DeepStream / nvdsanalytics / GStreamer / pyds — operator-facing, not a runtime debug surface. Pinned by a test.

**Not in scope here:** reliability findings (no DB writes, no notifications), replay/shadow testing, geometry editor changes. The chip is read-only; saved geometry continues to flow through the existing `PUT /v1/cameras/{id}/geometry-config` editor path unchanged.

## P6-B1 — Latest-Frame Geometry Editor Foundation

The first real editor lands at the same route (`/dashboard-next/cameras/[cameraId]/configure/geometry`). Operators draw counting **lines** on top of the camera's latest frame, save them via a Server Action, and watch the sidebar's revision banner bump from `r0` (probe default) to `r1+` (operator-saved). Polygon ROI authoring is deferred to **P6-B2** — existing ROIs render read-only inside the editor and pass through saves unchanged.

### Components

All three live under `src/components/dashboard-next/geometry/`:

- `geometry-editor-model.ts` — **the persistence boundary.** Pure helpers + types. `geometryConfigToEditorState` / `editorStateToGeometryConfig` are the load/save converters; the save direction always passes through `rois` + `frame` verbatim so the editor cannot accidentally drop them. `createLineId` / `createDefaultLineLabel` / `createLine` mint stable slug-pattern-compliant identifiers (`line-1`, `line-2`, gap-filling). `clampNormalized` snaps pointer coords to `[0, 1]`. Unit-tested in `geometry-editor-model.test.ts` (17 tests; ROI passthrough is the load-bearing one).
- `frame-canvas.tsx` — pure layout primitive. Renders the `LatestFrame.signed_url` as a fixed underlay with the right aspect ratio (frame width/height when present, `16/9` fallback), and translates browser pointer events into normalized points via `getBoundingClientRect`. Knows nothing about lines, tools, or saves.
- `geometry-editor-svg.tsx` — pure SVG overlay. Renders existing lines (with endpoint handles), read-only ROI polygons (dimmer styling), and the dashed draft preview. Emits `onLineSelect` + `onEndpointPointerDown` for the parent panel to drive. `viewBox="0 0 1 1"` so normalized coords map directly; `preserveAspectRatio="none"` so the SVG stretches to whatever the canvas decides.
- `geometry-editor-panel.tsx` — the Client Component **brains**. Owns all editor-local state (tool, selection, draft, dragging, dirty, save). Wires endpoint drag through window-level `pointermove` / `pointerup` / `pointercancel` listeners (mirrors the `scroll-area.tsx` precedent — no `setPointerCapture`). Calls the Server Action via `useTransition` with FormData + JSON-stringified config. Toasts via `sonner`; `router.refresh()` after success so the sidebar re-fetches.

### Server Action

`src/app/dashboard-next/(app)/cameras/[cameraId]/configure/geometry/actions.ts` exports `saveGeometryAction(formData)` returning `{ ok: true, message, record } | { ok: false, message, issues? }`:

1. Parse `camera_id` + `config` (JSON) from FormData.
2. **Re-run** `validateGeometryConfig` server-side — defense-in-depth against forged payloads even though the client validated first.
3. `getActiveAccount()` for `accountId`.
4. `updateCameraGeometryConfig`. `UpstreamApiError` → `friendlyMessage`.
5. `revalidatePath` the editor route. Return the new `GeometryConfigRecord`.

Mirrors `api-tokens/actions.ts`. Never throws raw errors into the UI.

### Page layout

The page (`configure/geometry/page.tsx`) stays a Server Component. It fetches `getCameraGeometryConfig` + `getLatestFrame` in series and composes a two-column grid:

| Column | Contents |
|---|---|
| Main (`1fr`) | `<GeometryEditorPanel>` when a latest frame exists; `<NoFrameEmptyState>` otherwise. |
| Aside (`360px` on `lg+`) | `<StatusPanel>` (revision + `is_default` distinction + timestamps), `<PersistenceWarningCard>`, `<RawJsonDetails>` (collapsed). |

The aside re-renders after every save because the panel calls `router.refresh()`.

### Editor-local state vs `GeometryConfig`

The panel keeps these in component state only — they NEVER leave the browser:

- `tool: "select" | "draw"`
- `selectedLineId: string | null`
- `draft: { start, current } | null` (mid-draw preview)
- `dragging` set indirectly via window-level listeners
- `dirty`, `saving`, `saveError`, `saveIssues[]`

Only `editorStateToGeometryConfig(shapes)` is converted to the wire shape at save time. The api-server's `extra="forbid"` would reject any leak.

### Probe-default behavior

When `is_default: true`, the editor opens **empty** (no lines, no ROIs). The synthesized probe shapes the server returns for UI scaffolding are dropped — the operator authors fresh geometry from scratch. The status panel still shows `r0 — Not configured yet` so the relationship between "save here" and "revision bump to r1" stays explicit.

### Validation flow

`validateGeometryConfig` from `@/lib/perception/geometry-schema` runs in **two** places:

1. Client-side, inside `handleSave` — keeps a structurally broken save off the network. Issues render in an inline `<ValidationList>` under the toolbar.
2. Server-side, inside the action — defense-in-depth. Returns the same `GeometryValidationIssue[]` in the result envelope so the call site can render them identically.

Same source of truth in both places — no inlined rules.

### Out of scope (deferred)

- **P6-B3** — undo/redo, "Refresh frame" button, live perception overlay as read-only context toggle, line direction toggle in toolbar, label editing.

## P6-B2 — Polygon ROI Authoring

Extends the P6-B1 editor with first-class polygon ROI authoring at the same route. Operators draw, select, drag-vertex, and delete ROIs alongside lines. The persistence boundary is unchanged — `editorStateToGeometryConfig` still converts editor-local state to the wire shape, and both line and ROI passthroughs are verified by `geometry-editor-model.test.ts`.

### What changed from P6-B1

- **Selection** is now shape-typed via `SelectedGeometry = { kind: "line"; id } | { kind: "roi"; id } | null`. The toolbar's Delete button label adapts (`Delete line` / `Delete ROI` / `Delete`).
- **New tool** `"draw-roi"` in `EditorTool`. The toolbar adds a Draw ROI chip alongside Draw line.
- **ROI rendering** in `GeometryEditorSvg` is editable (sage-green fill + stroke, brighter when selected). Unselected ROIs render quiet vertex dots; selected ROIs expose per-vertex drag handles. The earlier dim "read-only" styling is gone.
- **ROI draft preview** — placed vertices connect via a solid polyline; a dashed segment previews the next vertex from cursor; once 3+ vertices exist, a faint close-back segment shows from cursor to first vertex, and the first vertex itself becomes a clickable close target.

### Drawing flow

1. Click **Draw ROI** in the toolbar — tool switches to `draw-roi`, an empty draft (`points: []`) is created.
2. Click on the frame to add each vertex. The hint at the bottom of the editor tracks progress (`1 of 3 minimum vertices placed`, etc.).
3. **Finish ROI** button enables at 3+ vertices. Alternatively, click the first vertex (rendered as a slightly larger close-target) to close the polygon.
4. **Escape** cancels the draft. **Backspace** removes the most recent vertex.
5. On finish, the ROI is appended to `shapes.rois`, the editor switches back to Select and selects the new ROI so Delete and vertex drag are immediately available.

### Vertex drag

Identical mechanic to line endpoint drag — `onPointerDown` on a handle attaches window-level `pointermove` / `pointerup` / `pointercancel` listeners, computes the new normalized point via `getBoundingClientRect()` + `clampNormalized`, calls `updateRoiPoint(shapes, roiId, vertexIndex, p)` from the model. ROI id, label, type, and enabled flag are preserved across vertex edits — the observation-lineage guarantee that matters for reliability surfaces once P6-D wires the revision into observations.

### Validation

No new rules — the existing `validateGeometryConfig` in `@/lib/perception/geometry-schema` already enforces every ROI rule the api-server's Pydantic models enforce (≥ 3 / ≤ 64 vertices, normalized point bounds, slug-pattern IDs, ≤ 20 ROIs, ≤ 80-char labels, no duplicate ROI ids, no `type` other than `polygon`). Validation runs client-side before the save action AND server-side inside the action.

### Reliability framing

ROI geometry is the substrate for the next wave of processor observations: `processor.roi_occupancy`, `processor.zone_entered`, `processor.zone_exited`, `processor.dwell_started/_updated/_exceeded` (already typed in `src/lib/api/types.ts:ObservationType`). Once P6-C lands, the revision of the saved geometry pins which polygons produced which observations — that lineage is what reliability findings, review queues, and replay/shadow tests will rely on. The dashboard's job here is to make that authoring honest, stable, and inspectable, without leaking any drawing-library state into the persisted record.

## P6-B3 — Visual Polish + Usability

Three concrete improvements to the editor on top of P6-B2, plus one undiagnosed bug fix. Same route, same schema, same save flow — purely UX surface work.

### Three-tier ROI fill + hover state

`<GeometryEditorSvg>` now drives a `hoveredRoiId` prop. Polygons render with one of three sage-tier fills (single hue, varying alpha):

| State | Fill alpha | Stroke | Stroke width |
|---|---|---|---|
| Normal | 0.10 | `OVERLAY_COLORS.box` | 2 |
| Hovered | 0.22 | `OVERLAY_COLORS.box` | 2.5 |
| Selected | 0.34 | `#a7e3a8` (brighter sage) | 3 |
| Draft (≥ 3 pts) | 0.18 | none (polyline supplies outline) | n/a |

Hover state is editor-local only (`hoveredRoiId: string | null` in the panel); it persists nothing. Polygons fire `onPointerEnter` / `onPointerLeave` → `onRoiHoverChange(id | null)`. Draft polygons now also fill at 3+ vertices so the operator sees the would-be shape before they hit Finish ROI.

### Whole-ROI drag

In Select mode, clicking and dragging an ROI polygon's interior translates the entire polygon by the pointer delta. Mechanic mirrors `startRoiVertexDrag` but uses a different model helper:

- `clampRoiTranslation(roi, dx, dy)` (`geometry-editor-model.ts`) computes the bounding box and clamps `(dx, dy)` to `[-minX, 1 − maxX] × [-minY, 1 − maxY]` so the polygon can never escape `[0, 1]`.
- `translateRoi(roi, dx, dy)` applies the clamped delta to every vertex while preserving `id` / `label` / `type` / `enabled`.

The panel's `startWholeRoiDrag` snapshots the **original ROI at drag-start** and applies deltas against the snapshot. Applying against the in-flight ROI would compound clamp rounding across many moves and silently shrink the polygon — explicit anti-pattern noted in the helper's JSDoc.

Vertex drag still works as before; vertex pointerdown stops propagation so it never escalates to a whole-shape drag.

### Selected-shape label editing

A new `<SelectedShapeCard>` slots between the canvas and the Hint line, rendering only when something is selected. It shows the shape kind (`LINE` / `ROI`), id (monospace), a vertex-count summary, and a `<input maxLength={GEOMETRY_LIMITS.maxLabelLen}>` for the label. Typing fires `updateLineLabel` or `updateRoiLabel` (model helpers); ID, geometry, direction, type, enabled — all preserved. Saving rounds the new label through the same `validateGeometryConfig` flow; invalid labels never reach the api-server.

The input is keyed by the selected shape's id so React remounts it when the operator switches selection.

### Cross-tool click fix (undiagnosed P6-B2 bug)

In P6-B2, clicking an existing ROI polygon while in Draw line or Draw ROI mode silently selected the ROI and ate the click — making it impossible to place a vertex on top of an existing shape. Fixed by passing `interactive: boolean` to the SVG; when `false` (any non-Select tool), existing shape hit targets (polygon, line stroke, line endpoint handles, ROI vertex handles) set `pointer-events: none` so clicks pass through to the canvas underneath. Draft hit targets (the first-vertex close-target during ROI draw) stay `pointer-events: auto` because they belong to the active draft, not an existing shape.

### Out of scope (still)

- Perception overlay context toggle inside the editor (P6-B4+).
- Line direction editor — direction stays `"any"` from `createLine`. The `GeometryLineDirection` enum is already in `LINE_DIRECTIONS`; toolbar add is a future commit.
- Undo / redo (P6-B4+).
- "Refresh frame" button (P6-B4+).
- Autosave — explicit Save button stays the only commit path.
- Per-vertex insert / delete — shape-level delete only.

## Model & Detection (M5/M6)

The detection-config surface lives at a Configure sub-route, `/dashboard/cameras/{id}/configure/detection`. Scope after M6: **model selection, "what to detect?" class selection, and "how to detect?" tracker / confidence threshold / processing FPS, plus save.** The Configure landing page links into it alongside the geometry editor; `camera-tabs.tsx` prefix-matches `/configure`, so the Configure tab stays active — no nav change was needed.

> **Honest status:** users can now configure model, classes, tracker, confidence threshold, and processing FPS in the dashboard, but **the live processor still does not consume these settings yet.** The save round-trips to a real api-server endpoint and bumps a revision; wiring the processor to apply it is a later milestone. A calm muted notice in the editor (not an error color) states this verbatim, and the status panel's "The processor picks this up on the camera's next session" is the forward-looking intent, not a claim that runtime behavior changed today.

### Data flow

Like the geometry preflight, the page reads **already-built, already-tested** api-server endpoints — no backend changes shipped with M5. Two new **server-only** clients (the `import "server-only"` + `serverFetch` + unwrap-nested-field pattern cloned from `src/lib/api/geometry.ts`):

- `src/lib/api/models.ts` — `listModels({ accountId })` → `GET /v1/models`, returns `res.models` (`ModelRegistryEntry[]`). The registry is the source of truth for which models exist, which classes each supports, and whether a model is `enabled` (selectable). Disabled entries are returned too, so the picker can show why a previously-saved model is no longer available.
- `src/lib/api/camera-processing-config.ts` — `getCameraProcessingConfig({ accountId, cameraId })` → `GET …/processing-config`, returns `res.processing_config`; and `putCameraProcessingConfig({ accountId, cameraId, config })` → `PUT` with body `{ config }`. The GET is always-200 with a synthesized default (`is_default: true`, `revision: 0`, `id: null`, null timestamps) when nothing is saved — same probe-default shape as geometry; only `camera_not_found` 404s. The PUT replaces the whole config, bumps `revision`, and 422s on validation failure.

> **No collision with the existing account-level config.** `src/lib/api/processing-config.ts` (the account master-switch: `ProcessingConfig` / `getProcessingConfig` / `patchProcessingConfig`) is untouched. Every new symbol is `CameraProcessingConfig*`-prefixed and lives in the new file so the two never tangle.

The page (`configure/detection/page.tsx`, Server Component) fetches the registry and the config concurrently via `Promise.all`, mapping the config's lone `camera_not_found` 404 to `notFound()` (mirrors geometry). It hands both to the `<ModelDetectionPanel>` client island and renders an aside: a `StatusPanel` (revision, a labeled saved-state summary `dl` — Model / Classes / Tracker / Confidence / FPS — `is_default` → "Not configured yet" vs. "Operator-saved" with relative timestamps) and a collapsed raw-JSON `<details>` for engineers verifying the wire shape. The aside re-renders after every save because the panel calls `router.refresh()`.

### Editor UX — model, classes, and the M6 tuning controls

`<ModelDetectionPanel>` (`src/components/dashboard-next/detection/model-detection-panel.tsx`, `"use client"`) owns all editor-local state:

- **Model picker** — a value-controlled native `<select>` defaulting to the saved `model_key`. Enabled models are selectable; disabled models render as `<option disabled>` with a ` (disabled)` suffix. If the saved `model_key` isn't in the registry (e.g. retired), a leading disabled placeholder `{key} (unavailable)` keeps the select reflecting the operator's saved choice instead of silently snapping to the first option. Changing models resets the class selection to "all supported", clears the old subset, and — if the current tracker isn't in the new model's `supported_trackers` — resets the tracker to the runtime default (null). `supported_classes`/`supported_trackers` differ per model, so the prior picks are meaningless.
- **Class selection** — a single **"All supported classes"** checkbox over a per-class checklist. When ON, the checklist still renders but every box is checked **and** disabled (greyed, `cursor-not-allowed`), and the copy explains it saves as an empty list. When OFF, the checklist is interactive and the operator must check ≥ 1 class; an empty subset shows a `role="status"` notice ("Check at least one class, or turn on All supported classes") and disables Save.
- **Detection tuning (M6)** — three controls, each defaulting to the runtime/model value (`null`):
  - **Tracker** — a `<select>` (`aria-label="Tracker"`) whose options are a leading **"Runtime default"** (value `""` → null) plus the selected model's `supported_trackers`. Single-tracker models still render (default + the one).
  - **Confidence threshold** — a paired `range` + `number` input (`aria-label`s "Confidence threshold" and "Confidence threshold value", `min=0 max=1 step=0.05`) kept in sync, plus a **"Use default"** button that sets it to null. When null the helper says "Use model/runtime default" and, when the model publishes one, "Model default: {value}".
  - **Processing FPS** — a `<select>` (`aria-label="Processing FPS"`) with **Default** (null) / 1 / 2 / 5 / 10 / 15 / 30; null shows "Use runtime/source default".
- **Read-only model info** — registry facts only: runtime, default confidence threshold, resource profile, supported trackers, limitations. Plus a note that the tuning controls are configured above and a default leaves the model's/runtime's built-in value.
- **Not-live notice** — a calm muted info tile (not an error color) stating the config persists but the live processor doesn't consume it yet.

**The `[]` = "all supported classes" convention.** An empty `selected_classes` is the sentinel meaning *all classes this model supports* — it **never** means "detect nothing." This is stated in the helper copy, the toolbar summary, and the raw-JSON blurb so the meaning is unmissable. On load: `initialConfig.selected_classes.length === 0` → all-classes ON; otherwise OFF with those exact classes pre-checked.

### M6 controls — null = "use the default"

Tracker, confidence threshold, and processing FPS are authored in the editor, but each defaults to `null` ("use the runtime/model default"). The save-time config is:

```ts
{ version: 1, model_key, selected_classes: allClasses ? [] : [...selectedClasses],
  tracker, confidence_threshold: confidence, processing_fps: fps }
```

where `tracker` / `confidence` / `fps` are `null` unless the operator set them. **No styling/CSS fields cross the wire.** Honest truth: these persist, but the live processor still does not consume them yet — runtime behavior is unchanged until the processor-config milestone.

### Validation — same source of truth, two places

`src/lib/perception/processing-config-schema.ts` is a pure (no React, no I/O) validator importable from the client editor, the Server Action, and node-environment tests — the same dual-run shape as `geometry-schema.ts`. `validateProcessingConfig(config, model)` returns `ProcessingConfigValidationIssue[]` (shape is `{ field, message }` — **not** geometry's `{ code, path, severity }`). It runs:

1. **Client-side**, inside `handleSave` — a structurally broken save never hits the network. Issues render in an inline list under the toolbar.
2. **Server-side**, inside `saveProcessingConfigAction` — defense-in-depth against a forged payload. The action looks up the model in the registry (`listModels`) so the `model_key` + `selected_classes` checks have the registry facts to validate against, re-runs the same validator, then calls `putCameraProcessingConfig`, `revalidatePath`s the route, and returns a `{ ok: true, record } | { ok: false, message, issues? }` envelope — never a raw error into the UI. `UpstreamApiError` → `friendlyMessage`. Mirrors `configure/geometry/actions.ts`.

The validator mirrors the authoritative server rules: model must exist + be enabled; `selected_classes` is `[]` or a subset of the model's `supported_classes`; and (M6) each tuning field is `null` ("use default") or within bounds — `tracker` must be in the model's `supported_trackers` (when the model is known), `confidence_threshold` a finite number in `[0.0, 1.0]`, `processing_fps` an integer in `[1, 30]`. Any wrong-typed non-null value is an issue. **Backend validation stays authoritative** — this layer only fails fast in the browser instead of round-tripping a 422.

### Backend owns facts; frontend owns hue

No styling fields cross the wire. The persisted `CameraProcessingConfig` carries only data the api-server validates; the model picker's chrome, the checklist layout, the status-panel tints, and the `--dn-*` tokens are all dashboard-local. The registry's facts (supported classes, limitations, resource profile) are rendered verbatim from `ModelRegistryEntry`; the dashboard adds presentation, never invents detection facts.

## Reliability by Config (M10)

The camera Reliability tab gains a config-aware section under the existing
confidence-trend card (which is unchanged): one card per **applied**
processing-config group from the M9
`GET /v1/cameras/{id}/reliability/confidence-trend/by-config` endpoint, so an
operator can compare confidence trends across the configs the camera actually
ran under (e.g. "person-only @ confidence 0.20, r4" vs "All classes · default
confidence, r3").

> **Honest status:** this section *reads* what was applied; it applies nothing.
> Confidence threshold and selected classes are applied only where supported;
> model switching, tracker changes, processing FPS, and class-filtered line/ROI
> counts remain not live-applied. Groups whose warnings include
> `selected_classes_analytics_counts_not_filtered` get a visible
> "line/ROI counts still all-class" badge, and the section's standing note says
> selected-class filters apply to per-object outputs only. Grouped trends show
> association under a config, not proven causation.

Pieces:

- `src/lib/api/reliability.ts:getReliabilityConfidenceTrendByConfig` — same
  resilient posture as the trend client (**all** errors → `null` +
  `reportError`), so a missing/failed M9 endpoint degrades to an "unavailable"
  body without blanking the tab. Supported filter params are wired
  (revision/status/classes-key/threshold/warning) but the page fetches
  unfiltered; the UI filters client-side.
- `src/lib/perception/config-group-label.ts` — pure, theme-agnostic label
  rules: `"all"` → "All classes", `null` threshold → "default confidence",
  `"unknown"` key → "unknown config", all-null dimensions (pre-M8 history) →
  "No config metadata"; statuses humanised ("partially applied · r4",
  "default config", "fallback default").
- M10.1: group labels include the applied FPS segment ("… · 5 FPS", null →
  "default FPS"), with an "output cadence only" badge when the group carries
  `processing_fps_output_cadence_only` (tooltip states it does not reduce
  GPU/inference work).
- `src/components/dashboard-next/reliability-by-config-card.tsx` — client card
  with the 24h | 7d toggle (both ranges server-fetched by the page, instant
  switch), per-group mini sparkline (gap-aware, same approach as the trend
  card but local so that card stays untouched), Latest avg / Low-conf ratio /
  Samples stats, "No samples for this config in the selected range." for
  zero-sample groups, and Classes/Status filters whose options derive from the
  returned groups — nothing hardcoded, no extra query params sent.

## Config Comparison (M11)

Below Reliability by Config sits the "Config Comparison" report card — a
DESCRIPTIVE before/after view from
`GET /v1/cameras/{id}/reliability/config-comparison-summary`: baseline vs
candidate group panels, a neutral status chip (`comparable` / `mixed metrics`
/ `inconclusive` / `no data`), the backend's factual summary/bullets,
comparability notes (threshold or class-set changes change the measured
population), and standing caveats. It is a report card, not a recommender:
the UI never says "better/worse/best/recommended/caused" (test-pinned, with
denial phrases like "not … a recommendation" explicitly allowed), and the FPS
caveat states output-cadence-only / no GPU reduction. Resilient null posture;
hidden in demo mode.

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

**Status (2026-05-29): route-level steps EXECUTED; cosmetic steps DEFERRED while `/dashboard-legacy` stays live as a fallback.** ✅ done: step 1 (old segment → `src/app/dashboard-legacy/`, kept not deleted), step 2 (`src/app/dashboard-next/` → `src/app/dashboard/`), step 3 (route literals `/dashboard-next/` → `/dashboard/` across hrefs, redirects, `revalidatePath`, proxy `PUBLIC_PATHS`), and a fallback-safe variant of step 6 (new dashboard drops the `dn-` prefix → `camera:…`; `/dashboard-legacy` renamed to `legacy-camera:…` so the two coexisting dashboards stay isolated). ⏸ deferred until `/dashboard-legacy` is retired: steps 4 (rename chrome files), 5 (move components), 7 (move shared modules), 8 (fold theme) — each would replace or delete a component the live fallback still imports. Step 9 (docs) is in progress; step 10 (final `git grep` sweep) waits on the deferred steps.

The original checklist (use when `/dashboard-legacy` is finally retired):

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
