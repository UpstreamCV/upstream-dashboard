"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

// Tab strip for the camera detail workflow. Each tab is a real Next route
// segment under /dashboard-next/cameras/[cameraId]/ so deep links are stable,
// loading boundaries scope per tab, and per-tab fetches don't block each
// other. usePathname() picks the active tab via exact match.
//
// Light-theme styling only — no legacy dark classes. Lives next to the rest
// of the dashboard-next components so it can be styled consistently with the
// camera header.

const TABS = [
  { label: "Monitor", segment: "monitor" },
  { label: "Observations", segment: "observations" },
  { label: "Configure", segment: "configure" },
  { label: "Reliability", segment: "reliability" },
  { label: "Settings", segment: "settings" },
] as const;

export function CameraTabs({ cameraId }: { cameraId: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Camera tabs"
      className="flex flex-wrap items-center gap-1 border-b border-white/15 pb-1"
    >
      {TABS.map((tab) => {
        const href = `/dashboard/cameras/${cameraId}/${tab.segment}`;
        // Prefix match so sub-routes (e.g. /configure/geometry) keep their
        // parent tab highlighted. Safe today because no tab href is a prefix
        // of another tab href; revisit if a sibling tab grows that overlap.
        // The bare camera root redirects to Monitor, so highlight Monitor there
        // too (covers the pre-redirect frame / a deep link to the root).
        const active =
          pathname === href ||
          pathname.startsWith(`${href}/`) ||
          (tab.segment === "monitor" &&
            pathname === `/dashboard/cameras/${cameraId}`);
        return (
          <Link
            key={tab.segment}
            href={href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "rounded-full px-3 py-1.5 text-[clamp(0.78rem,1vw,0.92rem)] transition",
              active
                ? "bg-white text-black font-bold dn-glow-soft"
                : "text-white hover:bg-white/10",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
