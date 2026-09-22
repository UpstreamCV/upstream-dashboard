import { NextResponse, type NextRequest } from "next/server";
import { clearDemoCookies, demoCookieOptionsFor } from "@/lib/demo/demo-mode.server";

// GET /demo/exit — "Exit demo": drop the demo cookies and go to the real login.
// A plain link target (not a Server Action) so it works as an <a> inside the
// embedding frame and from the address bar alike.
export async function GET(req: NextRequest) {
  // Relative, for the same reason as /demo: an absolute URL built from
  // req.nextUrl leaves the custom domain on Netlify.
  const res = new NextResponse(null, {
    status: 307,
    headers: { Location: "/login" },
  });
  clearDemoCookies(res.cookies, demoCookieOptionsFor(req));
  res.headers.set("Cache-Control", "no-store");
  return res;
}
