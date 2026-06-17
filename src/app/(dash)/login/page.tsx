import { Suspense } from "react";
import Image from "next/image";
import { LoginFormNext } from "@/components/dashboard-next/login-form-next";
import { ShellBackdrop } from "@/components/dashboard-next/shell-backdrop";
import { CursorGlow } from "@/components/dashboard-next/cursor-glow";

// Figma DashboardFrontPage (node 189:262). Sits OUTSIDE the (app) route group
// → no getActiveAccount(), no sidebar/topbar, no auth redirect.
//
// Now publicly accessible: /dashboard-next/login is in proxy.ts PUBLIC_PATHS,
// and signed-in users visiting it are redirected to /dashboard-next.
//
// The form uses useSearchParams() to preserve the `next` param across the
// Server Action redirect, so we wrap it in <Suspense> to satisfy Next 16's
// CSR-bailout boundary requirement.
export default function DashboardNextLogin() {
  return (
    <div className="dn-shell-bg relative min-h-dvh w-full grid place-items-center p-4 sm:p-6">
      <ShellBackdrop />
      {/* Drives the .dn-glow-soft magnify hover on the login button (this page
          is outside the (app) shell that normally mounts CursorGlow). */}
      <CursorGlow />

      <div className="dn-glass-card relative z-10 w-[min(92vw,440px)] px-6 sm:px-10 py-10 sm:py-14 overflow-hidden">
        <Image
          src="/fish-watermark.png"
          alt=""
          aria-hidden
          width={585}
          height={845}
          className="pointer-events-none select-none absolute inset-0 m-auto w-[78%] h-auto opacity-20"
        />
        <div className="relative">
          <Suspense fallback={null}>
            <LoginFormNext />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
