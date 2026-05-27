# dashboard-next — at-a-glance status

The **new dashboard**, built in parallel with the live one. **This is the target for all new product-facing dashboard work** — see `docs/dashboard-next.md` "Route policy."

- **Live (production):** `src/app/dashboard/` → `/dashboard`. Bug fixes only; no new major features.
- **New (this folder):** `src/app/dashboard-next/` → `/dashboard-next` (authed) and `/dashboard-next/login` (public).

Both run in the same Next app; the new one reuses the existing data layer (`@/lib/api/*`), shared perception helpers (`@/lib/perception/*`), the `/api/upstream` proxy, and auth (`getActiveAccount()`) — no duplication, no second build.

**For the full picture** — architecture, theme tokens, Realtime channel naming, shared modules, token security, promotion checklist — read `docs/dashboard-next.md`. This README is intentionally short and focuses on day-to-day status.

## Status — fully wired

Every page reads real data from the upstream API via `serverFetch` + `useUpstreamList` (10 s default poll), mirroring the live `/dashboard` patterns.

| Route | Source | Polling |
|---|---|---|
| `/dashboard-next` | `getDashboardSummary` + `listAgents` + `listTokens` + `getAccount` + `getAccountLimits` | 10 s × 4 |
| `/dashboard-next/cameras` | `listCameras` + `listAgents` | 10 s × 2 |
| `/dashboard-next/cameras/[cameraId]` | redirect → `./monitor` | n/a |
| `/dashboard-next/cameras/[cameraId]/monitor` | `getCamera` + `getAgent` + `listStreamSessions` + `getLatestFrame` + `getLatestPerception` + `listValidations`; WHEP player + latest-frame poll + live perception overlay + latest-frame perception overlay | 7 s frame + 1 s live perception + Realtime push (layout) |
| `/dashboard-next/cameras/[cameraId]/observations` | `listRecentObservations` | optional 5 s "live" toggle |
| `/dashboard-next/cameras/[cameraId]/configure` | none — P6-B seam (links to geometry preflight) | n/a |
| `/dashboard-next/cameras/[cameraId]/configure/geometry` | `getCameraGeometryConfig` + `getLatestFrame`; interactive line editor + Server Action `saveGeometryAction` (ROIs read-only, deferred to P6-B2) | n/a |
| `/dashboard-next/cameras/[cameraId]/settings` | `getCamera` | n/a |
| `/dashboard-next/cameras/[cameraId]/reliability` | none — stub, waiting on backend signals | n/a |
| `/dashboard-next/agents` | `listAgents` | 10 s |
| `/dashboard-next/stream-sessions` | `listStreamSessions` + `listCameras` + `listAgents` | 10 s |
| `/dashboard-next/api-tokens` | `listTokens` + `createTokenAction` + `revokeTokenAction` | none (Server Action revalidate) |
| `/dashboard-next/login` | `signInAction` (in `PUBLIC_PATHS`) | n/a |

The camera detail's shared header + Realtime listener live in `cameras/[cameraId]/layout.tsx`; tabs are real route segments. See `docs/dashboard-next.md` "Camera detail — workflow tabs" for the per-tab fetch/responsibility table.

Two home tiles remain illustrative on purpose (the backing services don't exist yet) — see `docs/dashboard-next.md` "Placeholder tiles".

## Sanctioned surface

Files safe to change without prod risk:

- `src/app/dashboard-next/**`
- `src/components/nav/sidebar-next.tsx`
- `src/components/nav/topbar-next.tsx`
- `src/components/dashboard-next/**`
- `public/dashboard-next/**`

Anything outside this list — especially `src/components/stream/*`, `src/lib/webrtc/*`, `src/lib/api/*`, `src/lib/account/*`, `proxy.ts`, the catch-all proxy under `src/app/api/upstream/` — is shared with the live dashboard. Touch with care; both dashboards will feel it.

## Theme, Realtime, shared modules, promotion

See `docs/dashboard-next.md`. The canonical reference covers:

- Theme system (`.dn-*` classes, `--dn-*` vars, how to add tokens)
- Realtime channel naming (`dn-camera:` prefix during parallel run)
- Shared modules (`player-state-event.ts`, `whep-client.ts`)
- Token security model and the dialog's wipe matrix
- The authoritative promotion checklist
