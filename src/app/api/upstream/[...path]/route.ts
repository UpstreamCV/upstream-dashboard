import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import {
  ACTIVE_ACCOUNT_COOKIE,
  getActiveAccountIdFromCookie,
} from "@/lib/account/active";
import { listMemberships } from "@/lib/account/memberships";
import { reportError } from "@/lib/error";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/demo-mode";
import { resolveDemoResponse } from "@/lib/demo/router";
import { coerceScene, DEMO_SCENE_COOKIE } from "@/lib/demo/scene";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "cookie",
  "authorization",
]);

async function resolveAccountId(): Promise<string | null> {
  const fromCookie = await getActiveAccountIdFromCookie();
  if (fromCookie) return fromCookie;
  // Fallback for single-membership users who haven't pinned a cookie yet.
  try {
    const memberships = await listMemberships();
    if (memberships.length === 1) return memberships[0].accountId;
    return null;
  } catch {
    return null;
  }
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;

  // Demo mode: serve fixtures, no auth, no upstream. (src/lib/demo)
  if (isDemoMode()) {
    const url = new URL(req.url);
    const scene = coerceScene(req.cookies.get(DEMO_SCENE_COOKIE)?.value);
    const query = Object.fromEntries(url.searchParams.entries());
    return NextResponse.json(
      resolveDemoResponse("/" + path.join("/"), query, scene) ?? {},
    );
  }

  // Reject path-traversal segments before URL parsing normalizes them away.
  // The upstream API only exposes /v1/*; an authenticated user escaping the
  // prefix can't reach anything sensitive today, but belt-and-braces.
  for (const segment of path) {
    if (segment === "" || segment === "." || segment === "..") {
      return NextResponse.json(
        { error: { code: "invalid_path", message: "Invalid request path." } },
        { status: 400 },
      );
    }
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "missing_credentials", message: "Not signed in." } },
      { status: 401 },
    );
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "invalid_user_token", message: "No access token." } },
      { status: 401 },
    );
  }

  const upstreamUrl = new URL(req.url);
  const targetPath = "/" + path.map(encodeURIComponent).join("/");
  const target = new URL(
    targetPath + upstreamUrl.search,
    env.NEXT_PUBLIC_UPSTREAM_API_URL,
  );

  if (!target.searchParams.has("account_id")) {
    const accountId = await resolveAccountId();
    if (accountId) target.searchParams.set("account_id", accountId);
  }

  const headers = new Headers();
  for (const [k, v] of req.headers) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) headers.set(k, v);
  }
  headers.set("Authorization", `Bearer ${accessToken}`);

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
    // Body: forward as-is for non-GET/HEAD.
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(target.toString(), init);
  } catch (err) {
    reportError(err, { area: "upstream_proxy", path: targetPath });
    return NextResponse.json(
      {
        error: {
          code: "upstream_unreachable",
          message: "Could not reach the Upstream API.",
          details: { reason: err instanceof Error ? err.message : String(err) },
        },
      },
      { status: 502 },
    );
  }

  // Translate stale-account responses into a 401 so the client wipes its
  // SWR cache + redirects through /select-account.
  if (upstreamResponse.status === 403) {
    const cloned = upstreamResponse.clone();
    let body: unknown;
    try {
      body = await cloned.json();
    } catch {
      body = null;
    }
    const code =
      (body as { error?: { code?: string } } | null)?.error?.code ?? "";
    if (code === "account_id_required" || code === "forbidden_account") {
      const out = NextResponse.json(
        body ?? {
          error: {
            code: "account_id_required",
            message: "Account context missing or invalid.",
          },
        },
        { status: 401 },
      );
      out.cookies.delete(ACTIVE_ACCOUNT_COOKIE);
      return out;
    }
  }

  // Pipe response through.
  const responseHeaders = new Headers();
  for (const [k, v] of upstreamResponse.headers) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) responseHeaders.set(k, v);
  }
  const buf = await upstreamResponse.arrayBuffer();
  return new NextResponse(buf, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
