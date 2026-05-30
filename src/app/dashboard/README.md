# dashboard — at-a-glance status

The operator dashboard. **As of 2026-05-29 this is the live default at `/dashboard`** (promoted from the former `dashboard-next`). All new product-facing dashboard work goes here — see `docs/dashboard-next.md` "Route policy."

- **Live (production, this folder):** `src/app/dashboard/` → `/dashboard` (authed) and `/dashboard/login` (public).
- **Legacy fallback:** `src/app/dashboard-legacy/` → `/dashboard-legacy`. Kept for rollback only; bug fixes only, no new features. Slated for removal after a confidence period.

Both run in the same Next app and share the data layer (`@/lib/api/*`), perception helpers (`@/lib/perception/*`), the `/api/upstream` proxy, and auth (`getActiveAccount()`) — no duplication, no second build.

> The component folder is still `src/components/dashboard-next/` (the `-next` suffix is retained until the legacy fallback is retired).

**For the full picture** — architecture, theme tokens, Realtime channel naming, shared modules, token security, promotion checklist — read `docs/dashboard-next.md`. This README is intentionally short and focuses on day-to-day status.

## Status — fully wired

Every page reads real data from the upstream API via `serverFetch` + `useUpstreamList` (10 s default poll), mirroring the live `/dashboard` patterns.

| Route | Source | Polling |
|---|---|---|
| `/dashboard` | `getDashboardSummary` + `listAgents` + `listTokens` + `getAccount` + `getAccountLimits` | 10 s × 4 |
| `/dashboard/cameras` | `listCameras` + `listAgents` | 10 s × 2 |
| `/dashboard/cameras/[cameraId]` | redirect → `./monitor` | n/a |
| `/dashboard/cameras/[cameraId]/monitor` | `getCamera` + `getAgent` + `listStreamSessions` + `getLatestFrame` + `getLatestPerception` + `listValidations` + `getLatestProcessorStatus`; WHEP player + latest-frame poll + live perception overlay + latest-frame perception overlay + Applied Geometry chip | 7 s frame + 1 s live perception + Realtime push (layout) |
| `/dashboard/cameras/[cameraId]/observations` | `listRecentObservations` | optional 5 s "live" toggle |
| `/dashboard/cameras/[cameraId]/configure` | none — P6-B seam (links to geometry preflight) | n/a |
| `/dashboard/cameras/[cameraId]/configure/geometry` | `getCameraGeometryConfig` + `getLatestFrame`; interactive editor — line + ROI authoring, whole-ROI drag, label editing, hover/selected fill states — via `saveGeometryAction` | n/a |
| `/dashboard/cameras/[cameraId]/settings` | `getCamera` | n/a |
| `/dashboard/cameras/[cameraId]/reliability` | none — stub, waiting on backend signals | n/a |
| `/dashboard/agents` | `listAgents` | 10 s |
| `/dashboard/stream-sessions` | `listStreamSessions` + `listCameras` + `listAgents` | 10 s |
| `/dashboard/api-tokens` | `listTokens` + `createTokenAction` + `revokeTokenAction` | none (Server Action revalidate) |
| `/dashboard/login` | `signInAction` (in `PUBLIC_PATHS`) | n/a |

The camera detail's shared header + Realtime listener live in `cameras/[cameraId]/layout.tsx`; tabs are real route segments. See `docs/dashboard-next.md` "Camera detail — workflow tabs" for the per-tab fetch/responsibility table.

Two home tiles remain illustrative on purpose (the backing services don't exist yet) — see `docs/dashboard-next.md` "Placeholder tiles".

## Surface map (post-promotion)

`/dashboard` is now production, so nothing here is risk-free anymore. This map documents what is **segment-local** vs **shared** so you know the blast radius of a change.

Segment-local to the new dashboard:

- `src/app/dashboard/**`
- `src/components/nav/sidebar-next.tsx`
- `src/components/nav/topbar-next.tsx`
- `src/components/dashboard-next/**`
- `public/dashboard/**`

Shared with the `/dashboard-legacy` fallback (touch with care — both dashboards feel it): `src/components/stream/*`, `src/lib/webrtc/*`, `src/lib/api/*`, `src/lib/account/*`, `src/lib/perception/*`, `proxy.ts`, and the catch-all proxy under `src/app/api/upstream/`.

## Theme, Realtime, shared modules, promotion

See `docs/dashboard-next.md`. The canonical reference covers:

- Theme system (`.dn-*` classes, `--dn-*` vars, how to add tokens)
- Realtime channel naming (new dashboard `camera:…`; `/dashboard-legacy` `legacy-camera:…`)
- Shared modules (`player-state-event.ts`, `whep-client.ts`)
- Token security model and the dialog's wipe matrix
- The authoritative promotion checklist
