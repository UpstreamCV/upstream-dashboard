import { Suspense } from "react";
import Image from "next/image";
import { SignUpFormNext } from "@/components/dashboard-next/signup-form-next";
import { ShellBackdrop } from "@/components/dashboard-next/shell-backdrop";
import { CursorGlow } from "@/components/dashboard-next/cursor-glow";

// Dark signup — the sibling of (dash)/login. Same frosted creek card + backdrop.
// Sits OUTSIDE the (app) route group → no getActiveAccount(), no sidebar/topbar,
// no auth redirect. `/signup` is public (proxy.ts PUBLIC_PATHS); signed-in users
// hitting it are bounced to "/". The form uses useSearchParams() to preserve the
// `next` param across the Server Action redirect, so it's wrapped in <Suspense>
// to satisfy Next 16's CSR-bailout boundary requirement.
export default function DashboardNextSignup() {
  return (
    <div className="dn-shell-bg relative min-h-dvh w-full grid place-items-center p-4 sm:p-6">
      <ShellBackdrop />
      {/* Drives the .dn-glow-soft magnify hover on the submit button (this page
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
            <SignUpFormNext />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
