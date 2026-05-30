import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

// IMPORTANT: entries are matched as an exact path OR as a prefix-with-slash.
// "/foo" opens every subpath under "/foo/…" too. That's intentional for nested
// auth flows (e.g. `/dashboard/login/confirm-email` if we ever add one),
// but it means adding a new entry must be done with full knowledge of every
// route below it — anything nested becomes public automatically. Don't add a
// short prefix here unless you mean every subpath.
const PUBLIC_PATHS = ["/login", "/signup", "/dashboard/login"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
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

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Mirror the above for the dashboard's own light-themed login: logged-in
  // users should be sent into the dashboard rather than seeing the form.
  if (user && pathname === "/dashboard/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
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
