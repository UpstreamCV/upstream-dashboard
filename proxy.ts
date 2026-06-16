import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { isDemoMode } from "@/lib/demo/demo-mode";

// IMPORTANT: entries are matched as an exact path OR as a prefix-with-slash.
// "/foo" opens every subpath under "/foo/…" too. That's intentional for nested
// auth flows (e.g. `/dashboard/login/confirm-email` if we ever add one),
// but it means adding a new entry must be done with full knowledge of every
// route below it — anything nested becomes public automatically. Don't add a
// short prefix here unless you mean every subpath.
const PUBLIC_PATHS = ["/login", "/signup"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  // Demo mode: no Supabase, no auth gating — let every route through so the
  // recorded demo runs with no backend. (src/lib/demo)
  if (isDemoMode()) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          for (const { name, value } of toSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) {
            response.cookies.set(name, value, options);
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
