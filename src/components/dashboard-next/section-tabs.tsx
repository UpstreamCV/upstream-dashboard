"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

// Secondary sub-nav strip for a sidebar SECTION (Cameras / Event Outputs /
// Dev Settings / Account). Generalizes camera-tabs.tsx — same pill styling and
// prefix-match active logic — but takes absolute hrefs instead of building them
// from a cameraId, so it can sit at the top of a route-group layout (or inline
// on a list page) and switch between the section's sub-areas.
//
// This is a NEW, additive component: camera-tabs.tsx stays exactly as-is (the
// per-camera-detail strip, also imported by /dashboard-legacy). Keep the classes
// in sync with camera-tabs.tsx so the two strips read identically.
//
// Prefix-match note: a tab stays active on its sub-routes (e.g. /alerts active
// on /alerts/[alertId]). Safe as long as no tab href is a prefix of a sibling
// tab href — true for every section today; revisit if that ever overlaps.

export function SectionTabs({
  tabs,
  ariaLabel,
}: {
  tabs: { label: string; href: string }[];
  ariaLabel: string;
}) {
  const pathname = usePathname();

  // Chrome-style tab strip: tabs are centered and sit ON a bottom rule; the
  // active tab is a raised, rounded-top "foreground" tab that breaks through
  // the rule (border-b-transparent + -mb-px) so it reads as connected to the
  // content below — like browser tabs.
  return (
    <nav
      aria-label={ariaLabel}
      className="flex flex-wrap items-end justify-center gap-1 border-b border-white/15"
    >
      {tabs.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
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
