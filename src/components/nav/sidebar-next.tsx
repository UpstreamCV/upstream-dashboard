"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import clsx from "clsx";
import {
  Bell,
  CreditCard,
  Cpu,
  Globe,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Network,
  Radio,
  Settings,
  Users,
  Video,
  Workflow,
  type LucideIcon,
} from "lucide-react";

// Figma DashboardHome navigation rail. Translucent panel; each item is a pill
// with a per-section icon + label. Active item = solid white pill, gradient
// label (.dn-grad-text) + deep-creek icon. Cameras, Agents, Streaming Sessions,
// API Keys, and Home route to wired pages; the other items remain inert
// placeholders (no fake "#" navigation / 404s) and surface "Coming soon" via
// title attribute until those pages land.
//
// On promotion this replaces src/components/nav/sidebar.tsx (see
// docs/dashboard-next.md "Promotion checklist").
const NAV: {
  label: string;
  href: string | null;
  match?: RegExp;
  icon: LucideIcon;
}[] = [
  {
    label: "Home",
    href: "/dashboard",
    match: /^\/dashboard$/,
    icon: LayoutDashboard,
  },
  {
    label: "Cameras",
    href: "/dashboard/cameras",
    match: /^\/dashboard\/cameras/,
    icon: Video,
  },
  {
    label: "Agents",
    href: "/dashboard/agents",
    match: /^\/dashboard\/agents/,
    icon: Cpu,
  },
  {
    label: "Streaming Sessions",
    href: "/dashboard/stream-sessions",
    match: /^\/dashboard\/stream-sessions/,
    icon: Radio,
  },
  { label: "Network", href: null, icon: Network },
  { label: "Billing", href: null, icon: CreditCard },
  { label: "Users", href: null, icon: Users },
  {
    label: "Workflows",
    href: "/dashboard/workflows",
    match: /^\/dashboard\/workflows/,
    icon: Workflow,
  },
  {
    label: "Alerts",
    href: "/dashboard/alerts",
    match: /^\/dashboard\/alerts/,
    icon: Bell,
  },
  {
    label: "API Keys",
    href: "/dashboard/api-tokens",
    match: /^\/dashboard\/api-tokens/,
    icon: KeyRound,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    match: /^\/dashboard\/settings/,
    icon: Settings,
  },
];

const ICON_SIZE = { width: "clamp(18px,1.6vw,22px)", height: "clamp(18px,1.6vw,22px)" };

export function SidebarNext() {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  // Mirrors src/components/nav/topbar.tsx:25 — the old dashboard's sign-out
  // flow. Hard-redirects via window.location so the browser tosses every
  // cached RSC payload tied to the prior session, not just SWR's in-memory
  // store. Lands on the new dashboard's own login screen.
  async function handleSignOut() {
    setSigningOut(true);
    try {
      const res = await fetch("/api/auth/sign-out", { method: "POST" });
      if (res.ok) {
        window.location.href = "/dashboard/login";
        return;
      }
      toast.error("Sign out failed. Try again.");
    } catch {
      toast.error("Sign out failed. Check your connection.");
    }
    setSigningOut(false);
  }

  // Rail vertical padding matches the main panel's (p-4 sm:p-6 md:p-8) so the
  // Home button's top aligns with the first tile row and Sign Out gets the same
  // bottom breathing room; horizontal stays tight so labels keep their width.
  return (
    <aside
      className="dn-rail dn-scroll hidden md:flex md:flex-col gap-1.5 px-3 py-4 sm:py-6 md:py-8 shrink-0 overflow-y-auto"
      style={{ width: "clamp(190px,17vw,244px)" }}
    >
      <nav className="flex flex-col gap-1.5">
        {NAV.map((item) => {
          const active = item.match?.test(pathname) ?? false;
          const Icon = item.icon;
          const inner = (
            <>
              <Icon
                aria-hidden
                strokeWidth={2}
                className={clsx(
                  "shrink-0",
                  active ? "text-[var(--dn-creek-deep)]" : "text-white/80",
                )}
                style={ICON_SIZE}
              />
              <span
                className={clsx(
                  "truncate font-bold text-[clamp(0.9rem,1.05vw,1.05rem)]",
                  active ? "dn-grad-text" : "text-white/80",
                )}
              >
                {item.label}
              </span>
            </>
          );
          const cls = clsx(
            "flex items-center gap-2.5 rounded-2xl px-3 py-2.5 transition",
            active
              ? "bg-white shadow-sm"
              : "bg-white/[0.06] hover:bg-white/[0.12]",
          );
          return item.href ? (
            <Link key={item.label} href={item.href} className={cls}>
              {inner}
            </Link>
          ) : (
            <span
              key={item.label}
              className={clsx(cls, "cursor-default select-none")}
              aria-disabled
              title="Coming soon"
            >
              {inner}
            </span>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1.5">
        <a
          href="https://upstreamcv.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 bg-white/[0.06] hover:bg-white/[0.12] transition"
        >
          <Globe
            aria-hidden
            strokeWidth={2}
            className="shrink-0 text-white/80"
            style={ICON_SIZE}
          />
          <span className="truncate font-bold text-[clamp(0.9rem,1.05vw,1.05rem)] text-white/80">
            Our Website
          </span>
        </a>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 bg-white/[0.06] hover:bg-white/[0.12] transition text-left disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <LogOut
            aria-hidden
            strokeWidth={2}
            className="shrink-0 text-white/80"
            style={ICON_SIZE}
          />
          <span className="truncate font-bold text-[clamp(0.9rem,1.05vw,1.05rem)] text-white/80">
            {signingOut ? "Signing out…" : "Sign Out"}
          </span>
        </button>
      </div>
    </aside>
  );
}
