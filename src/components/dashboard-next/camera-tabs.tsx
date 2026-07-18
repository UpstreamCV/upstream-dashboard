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
  { label: "Live Monitor", segment: "monitor" },
  { label: "Events", segment: "observations" },
  { label: "Configure", segment: "configure" },
  { label: "Processing", segment: "processing" },
  { label: "Reliability", segment: "reliability" },
  { label: "Issues", segment: "issues" },
  { label: "Settings", segment: "settings" },
] as const;

export function CameraTabs({ cameraId }: { cameraId: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Camera tabs"
      className="flex flex-wrap items-end justify-center gap-1 border-b border-white/15"
    >
      {TABS.map((tab) => {
        const href = `/cameras/${cameraId}/${tab.segment}`;
        // Prefix match so sub-routes (e.g. /configure/geometry) keep their
        // parent tab highlighted. Safe today because no tab href is a prefix
        // of another tab href; revisit if a sibling tab grows that overlap.
        // The bare camera root redirects to Live Monitor (./monitor), so
        // highlight that tab there too (covers the pre-redirect frame / a deep
        // link to the root).
        const active =
          pathname === href ||
          pathname.startsWith(`${href}/`) ||
          (tab.segment === "monitor" && pathname === `/cameras/${cameraId}`);
        return (
          <Link
            key={tab.segment}
            href={href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "rounded-t-lg px-4 py-2 text-[clamp(0.78rem,1vw,0.92rem)] transition",
              active
                ? "dn-tab dn-tab-active -mb-px font-bold text-white"
                : "text-white/55 hover:bg-white/[0.05] hover:text-white",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
