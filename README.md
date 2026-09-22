# upstream-dashboard

Operator dashboard for the Upstream multi-camera streaming platform. Next.js (App Router) + TypeScript + Tailwind v4. Authenticates users through Supabase Auth and talks to [`upstream-api-server`](https://github.com/UpstreamCV/upstream-api-server) for everything else.

## Where this fits

```
upstream-dashboard (this repo)
        │ Supabase JWT in Authorization header
        ▼
upstream-api-server  ──►  Supabase Postgres
        │
        └─► upstream-streaming-server, upstream-processor
```

The dashboard never talks to Postgres or Supabase Storage directly. Every resource read and write — including tokens, snapshots, stream validations, and the dashboard summary — flows through `upstream-api-server` so account scoping and limits stay in one place. The only Supabase client usage in this repo is auth: session refresh in `proxy.ts`, `signInWithPassword` / `signUp` in the auth Server Actions, and `getSession()` inside `serverFetch` to mint the bearer token. See `docs/architecture.md`.

## Stack

- Next.js 16 (App Router, Turbopack default)
- React 19
- Tailwind CSS v4 (PostCSS plugin, no `tailwind.config.js`)
- TypeScript 5
- ESLint 9 (flat config)
- `@supabase/ssr`, `@supabase/supabase-js` for auth + RLS-protected reads
- `swr` for client polling
- `zod` (env + boundary validation), `clsx`, `lucide-react`, `sonner`, `@radix-ui/react-dialog`

Versions are pinned to match `upstream-web`. **Next 16 has breaking changes** (`middleware.ts` is now `proxy.ts`, `cookies()` is async, fetch caching off by default); consult `node_modules/next/dist/docs/` before writing non-trivial app code. See also `AGENTS.md`.

## Quickstart

```sh
# 1. Install deps
npm install

# 2. Copy env template and fill in values
cp .env.example .env.local
# Edit .env.local with your Supabase project URL/anon key + upstream-api URL.

# 3. Run upstream-api-server locally (separate terminal, in that repo)
#    cd ../upstream-api-server && supabase start && make dev

# 4. Run the dashboard
npm run dev
```

Then open `http://localhost:3000`. The api-server's default CORS allowlist includes `http://localhost:3000`, so no extra config is needed. The dashboard will redirect you to `/login` until you sign in.

### Account provisioning

The dashboard has a real signup flow at `/signup` (linked from `/login`). On submit:

1. `supabase.auth.signUp()` creates the row in `auth.users`.
2. The api-server's `handle_new_user()` trigger (migration `20260513140000_signup_trigger.sql`) provisions `accounts` + `account_members(role='owner')` + `account_limits` with permissive defaults in the same DB transaction.
3. If Supabase email confirmation is **off** (local dev default), the session cookies are set and the user lands on `/dashboard` directly. If confirmation is **on** (hosted Supabase default), the page shows a "check your email" screen.

#### Manual seeding (fallback / power-user path)

Useful only when testing the api-server in isolation, or backfilling an existing Supabase user that pre-dates the trigger migration. Studio SQL:

```sql
insert into accounts (id, name, slug)
  values (gen_random_uuid(), 'Demo', 'demo')
  returning id;
-- Copy the returned account_id and use it in both inserts below:

insert into account_members (account_id, user_id, role)
  values ('<account-id>', '<user-id>', 'owner');

insert into account_limits (
  account_id, max_cameras, max_concurrent_sessions, max_fps,
  max_width, max_height, max_bitrate_kbps, allowed_codecs
) values (
  '<account-id>', 5, 5, 60,
  1920, 1080, 8000, '{h264,h265}'
);
```

Users with multiple memberships will land on `/select-account` once on every fresh session.

## Environment

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_UPSTREAM_API_URL` | yes | Base URL for the api-server. Local: `http://localhost:4000`. Prod: `https://api.upstreamcv.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Same project the api-server is bound to |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Anon key (safe in the browser) |

The Supabase **service role key** must never appear in this repo. The api-server holds it.

## API contract

`../upstream-api-server/docs/api-contracts.md` is authoritative. Endpoints the dashboard uses today (with this repo's TypeScript wrappers in parens):

- `GET /v1/agents`, `GET /v1/agents/{id}` — `src/lib/api/agents.ts`
- `GET /v1/cameras`, `GET /v1/cameras/{id}` — `src/lib/api/cameras.ts`
- `GET /v1/cameras/{id}/latest-frame` — `src/lib/api/snapshots.ts` (api-server mints the Supabase Storage signed URL; 404 → empty state)
- `GET /v1/stream-sessions`, `GET /v1/stream-sessions/{id}` — `src/lib/api/stream-sessions.ts`
- `GET /v1/stream-sessions/{id}/validations` — `src/lib/api/validations.ts`
- `GET /v1/api-tokens`, `POST /v1/api-tokens`, `DELETE /v1/api-tokens/{id}` — `src/lib/api/api-tokens.ts` + `src/app/dashboard/settings/api-tokens/actions.ts`
- `GET /v1/dashboard/summary` — `src/lib/api/dashboard.ts`

Every non-2xx response uses the envelope `{ "error": { "code", "message", "details", "request_id" } }`. Switch on `error.code` (stable), not `error.message`. See `src/lib/api/errors.ts` for the category map + friendly-message table.

## Project layout

```
proxy.ts                              # Next 16 auth gate (Supabase session refresh)
src/
  app/
    layout.tsx, page.tsx, not-found.tsx, globals.css
    (auth)/                           # route group — no /auth URL prefix
      layout.tsx                      # centered card shell
      login/                          # public sign-in (Server Action)
      signup/                         # public sign-up (Server Action; trigger provisions account)
    dashboard/                        # real /dashboard URL segment (auth + active-account required)
      layout.tsx, loading.tsx, error.tsx
      page.tsx, overview-cards.tsx    # overview (polls /v1/dashboard/summary)
      cameras/                        # list + cameras/[cameraId]/{page,not-found,camera-detail-polling}
      agents/                         # list
      stream-sessions/                # list
      settings/api-tokens/            # generate / revoke (owner/admin)
    select-account/                   # multi-membership chooser (top-level, outside /dashboard
                                      # to avoid the getActiveAccount → /select-account redirect loop)
    api/
      upstream/[...path]/             # catch-all proxy → upstream-api-server (mints JWT, injects account_id)
      auth/sign-out/                  # signs out + clears active-account cookie
  components/
    data/                             # data-table, status-badge, empty-state, page-header,
                                      # relative-time, copy-button
    nav/                              # sidebar, topbar
    stream/                           # latest-frame-card, playback-coming-soon
    tokens/                           # token-create-dialog (plaintext-scrubbing), token-row-actions
  lib/
    env.ts                            # zod-validated process.env (throws on missing/invalid)
    error.ts                          # reportError() chokepoint (swap for Sentry/OTel later)
    safe-next.ts                      # ?next= sanitizer (open-redirect defense)
    time.ts                           # Intl helpers (no date-fns / luxon)
    supabase/server.ts                # @supabase/ssr server factory (async cookies adapter)
    supabase/client.ts                # @supabase/ssr browser factory (currently unused — kept
                                      # for future browser-side auth flows like password reset)
    account/{active,memberships,actions}.ts
                                      # getActiveAccount(), listMemberships() (React cache),
                                      # setActiveAccountAction()
    api/                              # types.ts, errors.ts, server.ts (serverFetch),
                                      # client.ts (proxyFetch + SWR config), use-list.ts,
                                      # per-resource wrappers: agents, cameras, snapshots,
                                      # stream-sessions, validations, api-tokens, dashboard
docs/
  architecture.md                     # this app's place + auth flow + polling cadence
  commit-log.md                       # required per-commit history (see policy below)
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Next.js dev server on `http://localhost:3000` |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint (Next 16 does not auto-run lint on build) |
| `npm run lint:fix` | ESLint with `--fix` |
| `npx tsc --noEmit` | Type check |

## Demo mode

`https://dashboard.upstreamcv.com/demo` opens the dashboard on a fake account with fake data — no login, no api-server, no Supabase. It sets the `upstream_demo` cookie (plus the `demo_scene` narrative cursor) and redirects to Home; every request that carries the cookie is answered from `src/lib/demo/fixtures.ts`, and writes stick in memory for the session. Leave with the "Exit demo" badge, Sign out, or `/demo/exit`. `/demo?scene=<adding|connected|line-saved|counting|problem|fixing|fixed>` deep-links a beat of the story; press backtick in the app to reveal the scene stepper.

The page is meant to be embedded: `next.config.ts` allows framing from the sites listed in `FRAME_ANCESTORS` (`frame-ancestors` CSP). The demo cookies are `SameSite=None; Secure`, so the embed must be served over https (Safari still blocks third-party cookies inside a frame — open the demo in a new tab there). Locally, `npm run build && npm run start` then visit `http://localhost:3000/demo` (Lax cookies on plain http).

`npm run demo` still builds a whole-app demo with `NEXT_PUBLIC_DEMO_MODE=1` for recording; see `AGENTS.md` "Demo mode".

## Deploy to Netlify

Netlify's Next.js Runtime auto-detects this project — middleware (`proxy.ts`) deploys as an Edge Function, the catch-all proxy (`/api/upstream/[...path]`) deploys as a serverless Function, and Server Components run on serverless. No plugin block is needed in `netlify.toml`; just the Node pin + build command (already committed).

**One-time setup**

1. **Connect the repo.** New site → import from Git → pick this repo. Netlify reads `netlify.toml` and uses `npm run build` on Node 20.
2. **Add the three environment variables** under Site → Settings → Environment variables:
   - `NEXT_PUBLIC_UPSTREAM_API_URL` — production api-server URL (e.g. `https://api.upstreamcv.com`)
   - `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key

   For each var, **enable the "Builds" scope** (not only "Functions" / "Runtime"). Next.js inlines `NEXT_PUBLIC_*` into the client bundle at `next build` time — if the vars are runtime-only, the build either crashes with a zod validation error from `src/lib/env.ts` or ships a bundle with `undefined` values. If you're using Netlify's **shared / team environment variables** ("external variables"), make sure they're explicitly linked to this site and scoped to **Builds** — being in the team library is not enough.
3. **Trigger a fresh deploy.** After any env-var change, hit "Deploys → Trigger deploy → Clear cache and deploy site". A runtime-only change won't update the client bundle.
4. **Add the production URL to api-server CORS.** Edit `UPSTREAM_API_CORS_ORIGINS` (or equivalent) on `upstream-api-server` to include the Netlify domain (e.g. `https://your-site.netlify.app`, plus any custom domain).
5. **Add the production URL to Supabase Auth.** Project Settings → Authentication → URL Configuration → Site URL + Redirect URLs. Without this, sign-in redirects from `?next=…` won't work and OAuth (if added later) will reject the redirect.

**Note on Netlify's secrets scanner.** Netlify scans every build output for the values of every env var and fails the deploy if it finds them. That's wrong for `NEXT_PUBLIC_*` — those are *meant* to be inlined into the client bundle (that's literally what the prefix signals), and the Supabase **anon** key is safe to expose (RLS gates every query; only the **service-role** key is sensitive, and it isn't in this repo). The `netlify.toml` in this repo allowlists the three public keys via `SECRETS_SCAN_OMIT_KEYS`. If you ever add a real secret (e.g., a Stripe key, a server-only Supabase key), do **not** prefix it `NEXT_PUBLIC_`, and do **not** add it to that allowlist — let the scanner do its job.

**Verifying the deploy**

- `https://<site>.netlify.app/login` should render the sign-in card (no redirect loop).
- The Netlify Functions log should show the catch-all `/api/upstream/*` invocation when you hit `/dashboard` post-login.
- If you see "Missing or invalid environment variables" in the build log, re-check the env-var scope and run "Clear cache and deploy site".

**Other hosts**: Vercel works out of the box (it's Next.js's home host). For self-hosting, `npm run build && npm run start` behind any Node 20+ runtime is sufficient; mind the same `NEXT_PUBLIC_*` build-time inlining.

## Commit / doc policy

Every meaningful commit updates `docs/commit-log.md` in the same commit, plus any affected docs (README, AGENTS, architecture). See `AGENTS.md` for the full policy.

## Project Tracking

We use GitHub Issues as a lightweight tracker for meaningful bugs,
features, follow-ups, and milestone work. Issues should include clear
context and acceptance criteria, but should not become heavy process.
Small fast-moving implementation details can stay in PRs, commit logs,
or working notes. New product surfaces should land under
`/dashboard-next` per `AGENTS.md`.

The cross-repo plan lives in `../docs/github-issues-plan.md`.
