import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { DEMO_MODE_COOKIE, demoModeFromCookie } from "@/lib/demo/demo-mode";

// IMPORTANT: entries are matched as an exact path OR as a prefix-with-slash.
// "/foo" opens every subpath under "/foo/…" too. That's intentional for nested
// auth flows (e.g. `/dashboard/login/confirm-email` if we ever add one),
// but it means adding a new entry must be done with full knowledge of every
// route below it — anything nested becomes public automatically. Don't add a
// short prefix here unless you mean every subpath.
// "/demo" covers /demo (arms the demo cookie) and /demo/exit (clears it).
const PUBLIC_PATHS = ["/login", "/signup", "/demo"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  // Demo mode (build flag OR the `upstream_demo` cookie set by /demo): no
  // Supabase, no auth gating — let every route through so the demo runs with
  // no backend. (src/lib/demo)
  if (demoModeFromCookie(request.cookies.get(DEMO_MODE_COOKIE)?.value)) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet, headers) {
          for (const { name, value } of toSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) {
            response.cookies.set(name, value, options);
          }
          // @supabase/ssr >=0.12 hands us no-store headers that MUST ride along
          // with the auth cookies (Cache-Control: private, no-store… / Expires /
          // Pragma). A response carrying a session token must never be cached by
          // a CDN — we deploy behind Netlify — or one user's token can be served
          // to another. Dropping this argument still type-checks (TS allows
          // fewer params), so the omission is silent: accepting it is optional,
          // applying it is not.
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Refresh the session as a side effect.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // Logged-in users hitting the auth pages get sent into the app (now at root).
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on every page request except static assets, optimized images, and the
  // catch-all upstream proxy (which does its own auth check).
  matcher: [
    "/((?!_next/static|_next/image|_next/data|favicon.ico|api/upstream|.*\\.(?:png|jpg|jpeg|svg|webp|ico|gif|woff2?)$).*)",
  ],
};
