"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import clsx from "clsx";
import {
  Bell,
  CreditCard,
  Cpu,
  Globe,
  Home,
  KeyRound,
  LogOut,
  Network,
  Radio,
  ScrollText,
  Settings,
  Users,
  Video,
  Workflow,
  type LucideIcon,
} from "lucide-react";

// Figma navigation rail — NO container: the button pills sit directly on the
// shell background. Each item is a pill with a per-section icon + label; the
// active item is a solid white pill (gradient label + deep-creek icon). Cameras,
// Agents, Streaming Sessions, API Keys, and Home route to wired pages; the
// others are inert placeholders ("coming soon" via title) until they land.
//
// Per-route behavior:
//   • EVERY PAGE collapses to an icon-only dock that expands to the labelled
//     rail on HOVER (no toggle button). The rail is in-flow and widens on :hover
//     (see .dn-rail-dock), so the content panel reflows to make room. The rail
//     owns its left padding, so the hover box reaches the screen's left edge.
//   • HOME (/) additionally sizes its identity block to the top tools row
//     (--dn-topbar-h) so the avatar sits level with the search/logo cluster and
//     the FIRST nav button top-aligns with the content panel; the rail fills the
//     sticky viewport-tall wrapper in AppShell so the footer pins to the bottom.
//
// Each item's icon lives in a fixed-width centered SLOT, so a collapsed icon is
// dead-centered (equal padding L/R) and never slides when the rail expands — the
// label simply cross-fades in beside it. That's what keeps the expand smooth and
// every pill identical in size.
const NAV: {
  label: string;
  href: string | null;
  match?: RegExp;
  icon: LucideIcon;
}[] = [
  {
    label: "Home",
    href: "/",
    match: /^\/$/,
    icon: Home,
  },
  {
    label: "Cameras",
    href: "/cameras",
    match: /^\/cameras/,
    icon: Video,
  },
  {
    label: "Agents",
    href: "/agents",
    match: /^\/agents/,
    icon: Cpu,
  },
  {
    label: "Streaming Sessions",
    href: "/stream-sessions",
    match: /^\/stream-sessions/,
    icon: Radio,
  },
  { label: "Network", href: null, icon: Network },
  {
    label: "Billing",
    href: "/billing",
    match: /^\/billing/,
    icon: CreditCard,
  },
  { label: "Users", href: null, icon: Users },
  {
    label: "Workflows",
    href: "/workflows",
    match: /^\/workflows/,
    icon: Workflow,
  },
  {
    label: "Alerts",
    href: "/alerts",
    match: /^\/alerts/,
    icon: Bell,
  },
  {
    label: "Audit Logs",
    href: "/audit-logs",
    match: /^\/audit-logs/,
    icon: ScrollText,
  },
  {
    label: "API Keys",
    href: "/api-tokens",
    match: /^\/api-tokens/,
    icon: KeyRound,
  },
  {
    label: "Settings",
    href: "/settings",
    match: /^\/settings/,
    icon: Settings,
  },
];

const ICON_SIZE = {
  width: "clamp(18px,1.6vw,22px)",
  height: "clamp(18px,1.6vw,22px)",
};

const ICON_SLOT = "3rem"; // fixed centered slot = collapsed rail content width

// The centered, fixed-width icon slot shared by every pill (and the avatar).
// Module-scoped so it isn't re-created on every render.
function Slot({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="grid place-items-center shrink-0"
      style={{ width: ICON_SLOT }}
    >
      {children}
    </span>
  );
}

// No horizontal padding on the pill — the centered icon-slot owns the left side
// and the label carries its own right padding, so the icon stays put and pills
// are uniform whether collapsed or expanded. No backdrop-blur: the nav pills
// never carried the cursor sheen, so they stay plain (glass is hover-only and
// lives on .dn-glow-soft buttons — see theme.css).
const ITEM_BASE = "flex items-center rounded-2xl py-2.5 transition-colors";
const LABEL_BASE =
  "font-bold text-[clamp(0.9rem,1.05vw,1.05rem)] truncate min-w-0 pr-3";

// Rail expand state, tracked at MODULE scope so it survives the rail remounting
// on home↔non-home navigation. The expand is JS-driven (not just CSS :hover)
// because after a client-side navigation the browser won't re-apply :hover to a
// freshly-mounted rail under a STATIONARY cursor — so clicking a nav item would
// otherwise auto-collapse the rail on the new page until you wiggle the mouse.
let railOpen = false;
let lastPointer: { x: number; y: number } | null = null;

export function SidebarNext({ name }: { name: string }) {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);
  // Seed from the persisted module flag so a remounted rail paints already-open
  // (no collapse flash) when the cursor is still over it after navigating.
  const asideRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(() => railOpen);

  // Single source of truth for the expand: the pointer is inside the rail's
  // CURRENT box (collapsed 4.5rem or expanded). Natural hysteresis — entering
  // the narrow rail opens it; you stay open until you leave the WIDE rail. Runs
  // on every move and is re-evaluated on each route change from the last known
  // pointer, so it's correct even when the browser won't re-fire :hover.
  useEffect(() => {
    const evaluate = (x: number, y: number) => {
      const el = asideRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const inside =
        x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      if (inside !== railOpen) {
        railOpen = inside;
        setOpen(inside);
      }
    };
    const onMove = (e: MouseEvent) => {
      lastPointer = { x: e.clientX, y: e.clientY };
      evaluate(e.clientX, e.clientY);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    if (lastPointer) evaluate(lastPointer.x, lastPointer.y);
    return () => window.removeEventListener("mousemove", onMove);
  }, [pathname]);

  // Every page now collapses to a hover-expand icon dock (Home included). On
  // Home the dock's identity block is sized to the top tools row so the first
  // nav button top-aligns with the content panel; elsewhere the avatar simply
  // leads the rail.
  const isHome = pathname === "/";
  const dock = true;
  const initial = name.trim().charAt(0).toUpperCase() || "U";

  // Mirrors the old dashboard's sign-out flow: hard-redirect via
  // window.location so the browser tosses every cached RSC payload tied to the
  // prior session, landing on the new dashboard's own login screen.
  async function handleSignOut() {
    setSigningOut(true);
    try {
      const res = await fetch("/api/auth/sign-out", { method: "POST" });
      if (res.ok) {
        window.location.href = "/login";
        return;
      }
      toast.error("Sign out failed. Try again.");
    } catch {
      toast.error("Sign out failed. Check your connection.");
    }
    setSigningOut(false);
  }

  function itemCls(active: boolean) {
    return clsx(
      ITEM_BASE,
      active ? "bg-white shadow-sm" : "bg-white/[0.06] hover:bg-white/[0.12]",
    );
  }
  // Labels stay in the DOM (so the icon never reflows) but are clipped by the
  // rail's overflow-x-hidden and faded out; on hover they cross-fade in as the
  // rail widens. Same on every page now (Home included).
  function labelCls(color: string) {
    return clsx(
      LABEL_BASE,
      "opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-data-[open=true]:opacity-100",
      color,
    );
  }
  const rail = (
    <>
      {/* User identity at the top-left. Avatar centered in the same slot as the
          nav icons; avatar-only until hover, then the name reveals. The block is
          sized to the top tools-row height (--dn-topbar-h) on EVERY page, so the
          rail's top — avatar + first nav button — sits identically as you
          navigate. On Home that also lands the first nav button at the content
          panel's top edge (the tools row uses the same height there). */}
      <div
        className="flex items-center shrink-0"
        // Height = tools-row height MINUS the rail's gap-1.5 (0.375rem) so the
        // first nav button lands at y = --dn-topbar-h. (Avatar centers ~3px high
        // vs the tools cluster — below the visual threshold for a small avatar.)
        style={{ height: "calc(var(--dn-topbar-h) - 0.375rem)" }}
      >
        <Slot>
          <span
            className="grid place-items-center rounded-full bg-white/90 text-[var(--dn-creek-deep)] font-bold shrink-0"
            style={{
              width: "clamp(30px,3vw,38px)",
              height: "clamp(30px,3vw,38px)",
              fontSize: "clamp(0.78rem,1.05vw,0.98rem)",
            }}
            aria-hidden
          >
            {initial}
          </span>
        </Slot>
        <div className="min-w-0 leading-tight pr-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-data-[open=true]:opacity-100">
          <p className="font-bold text-[clamp(0.66rem,0.82vw,0.78rem)] text-white/50 truncate">
            Welcome back,
          </p>
          <p className="font-bold text-[clamp(0.9rem,1.05vw,1.05rem)] text-white/85 truncate capitalize">
            {name}
          </p>
        </div>
      </div>

      <nav className="flex flex-col gap-1.5">
        {NAV.map((item) => {
          const active = item.match?.test(pathname) ?? false;
          const Icon = item.icon;
          const title = item.href ? item.label : `${item.label} (coming soon)`;
          const inner = (
            <>
              <Slot>
                <Icon
                  aria-hidden
                  strokeWidth={2}
                  className={clsx(
                    "shrink-0",
                    // Active pill is solid white → black icon + label (not the
                    // creek gradient, which read poorly on white).
                    active ? "text-black" : "text-white/80",
                  )}
                  style={ICON_SIZE}
                />
              </Slot>
              <span className={labelCls(active ? "text-black" : "text-white/80")}>
                {item.label}
              </span>
            </>
          );
          return item.href ? (
            <Link
              key={item.label}
              href={item.href}
              className={itemCls(active)}
              title={title}
              aria-label={dock ? item.label : undefined}
            >
              {inner}
            </Link>
          ) : (
            <span
              key={item.label}
              className={clsx(itemCls(active), "cursor-default select-none")}
              aria-disabled
              aria-label={dock ? title : undefined}
              title={title}
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
          title="Our Website"
          aria-label={dock ? "Our Website" : undefined}
          className={itemCls(false)}
        >
          <Slot>
            <Globe
              aria-hidden
              strokeWidth={2}
              className="shrink-0 text-white/80"
              style={ICON_SIZE}
            />
          </Slot>
          <span className={labelCls("text-white/80")}>Our Website</span>
        </a>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          title="Sign Out"
          aria-label={dock ? "Sign Out" : undefined}
          className={clsx(
            itemCls(false),
            "text-left disabled:opacity-60 disabled:cursor-not-allowed",
          )}
        >
          <Slot>
            <LogOut
              aria-hidden
              strokeWidth={2}
              className="shrink-0 text-white/80"
              style={ICON_SIZE}
            />
          </Slot>
          <span className={labelCls("text-white/80")}>
            {signingOut ? "Signing out…" : "Sign Out"}
          </span>
        </button>
      </div>
    </>
  );

  // The rail is always a hover-expand icon dock now. It sits IN the flex flow
  // and widens on hover (.dn-rail-dock), pushing the content panel right; the
  // rail owns its left padding (px-3, parent has none) so the hover box reaches
  // the screen's left edge — the whole left strip expands it. On Home it fills
  // the sticky viewport-tall wrapper in AppShell (h-full, footer pinned to the
  // bottom) and drops its TOP padding, so the identity block — sized to
  // --dn-topbar-h — lands the first nav button at the content panel's top edge.
  return (
    <aside
      ref={asideRef}
      data-open={open ? "true" : "false"}
      className={clsx(
        // pl 18px / pr 6px (not symmetric px): the rail BOX still starts at the
        // screen's left edge (no parent padding) so its hover zone covers the
        // leftmost pixels, while the pills sit 18px from the edge — equal to
        // their 18px gap to the panel on the right (6px pr + 12px row gap).
        "dn-rail-dock dn-scroll group hidden md:flex md:flex-col gap-1.5 pl-[18px] pr-1.5 shrink-0 overflow-x-hidden overflow-y-auto pb-4 sm:pb-6 md:pb-8",
        // Home's rail lives in a block wrapper and must fill it; elsewhere the
        // rail is a flex item that already stretches to full height.
        isHome && "h-full",
      )}
    >
      {rail}
    </aside>
  );
}
