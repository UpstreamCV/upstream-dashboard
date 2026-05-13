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

The dashboard never talks to Postgres or Supabase Storage directly from the browser. Reads go through `upstream-api` so account scoping and limits stay in one place. For four endpoints the api-server doesn't yet expose (tokens list, latest frame, stream validations, dashboard summary) we query Supabase directly **server-side only** under existing RLS policies — those queries live in `src/lib/api/*.ts` and migrate to api-server endpoints when they land. See `docs/architecture.md`.

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

- `GET /v1/agents`, `GET /v1/agents/{id}` (`src/lib/api/agents.ts`)
- `GET /v1/cameras`, `GET /v1/cameras/{id}` (`src/lib/api/cameras.ts`)
- `GET /v1/stream-sessions`, `GET /v1/stream-sessions/{id}` (`src/lib/api/stream-sessions.ts`)
- `POST /v1/api-tokens`, `DELETE /v1/api-tokens/{id}` (`src/lib/api/api-tokens.ts` actions)

Direct Supabase reads (server-side, RLS-gated):
- `api_tokens` list (no `hash`) — `src/lib/api/api-tokens.ts`
- `snapshots` + Storage signed URL — `src/lib/api/snapshots.ts`
- `stream_validations` — `src/lib/api/validations.ts`

Every non-2xx response uses the envelope `{ "error": { "code", "message", "details", "request_id" } }`.

## Project layout

```
proxy.ts                              # Next 16 auth gate (Supabase session refresh)
src/
  app/
    (auth)/login/                     # public sign-in
    (dashboard)/                      # auth + active-account required
      dashboard/                      # overview
      cameras/, cameras/[cameraId]/   # list + detail (latest frame, session, validation)
      agents/                         # list
      stream-sessions/                # list
      settings/api-tokens/            # generate / revoke (owner/admin)
    select-account/                   # multi-membership chooser (top-level, outside (dashboard))
    api/
      upstream/[...path]/             # catch-all proxy → upstream-api
      auth/sign-out/                  # clears Supabase session
      cameras/[cameraId]/latest-frame # signed-URL frame endpoint
  components/                         # data, nav, brand, tokens, stream
  lib/
    env.ts                            # zod-validated process.env
    error.ts                          # reportError() shim
    time.ts                           # Intl helpers
    supabase/{server,client}.ts       # @supabase/ssr factories
    account/{active,memberships,actions}.ts
    api/                              # types, errors, server/client fetchers,
                                      # per-resource wrappers, snapshots, validations
docs/
  architecture.md                     # this app's place + auth flow + gaps
  commit-log.md                       # required per-commit history
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

## Commit / doc policy

Every meaningful commit updates `docs/commit-log.md` in the same commit, plus any affected docs (README, AGENTS, architecture). See `AGENTS.md` for the full policy.
