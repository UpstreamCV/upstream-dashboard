"use client";

import { usePathname } from "next/navigation";
import { ScrollArea } from "@/components/dashboard-next/scroll-area";
import { SidebarNext } from "@/components/nav/sidebar-next";

// Route-aware chrome arrangement for the authed dashboard.
//
//   • HOME (/) — a SCROLLING page. The rail is a sticky, collapsed icon dock
//     (expands on hover, like every other page) that carries the user identity
//     at its top-left; the rounded content panel scrolls, sliding up and
//     bleeding over the top edge of the screen as you scroll. The top-right
//     tools (search + Upstream Dashboard + logo) render INSIDE the panel's
//     top-right, so the panel bg runs behind them. The tools row and the rail's
//     identity block share one height (--dn-topbar-h) so the panel's top edge
//     lines up with the rail's first nav button.
//   • EVERY OTHER PAGE — a fixed work area. No header, so the panel is locked to
//     the viewport and its content scrolls INSIDE it (ScrollArea); the panel
//     bleeds to the top/right/bottom edges with a squared top-left corner. The
//     rail is an in-flow icon dock that expands on hover.
//
// `tools` is passed in from the server layout (it renders a Server Component);
// a Client Component can render a server element handed to it as a prop.
export function AppShell({
  name,
  tools,
  children,
}: {
  name: string;
  tools: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  if (isHome) {
    return (
      <div className="relative z-10 h-full overflow-y-auto dn-scroll">
        <div className="flex min-h-full gap-3">
          {/* Sticky, viewport-tall rail (collapsed icon dock + identity) — stays
              put and expands on hover. No left padding here: the rail owns it so
              its hover box reaches the screen's left edge. */}
          <div className="sticky top-0 h-dvh self-start shrink-0 hidden md:block">
            <SidebarNext name={name} />
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Tools (search + Upstream Dashboard + logo) sit at the top-right on
                the background, as a sticky LOW-z element INSIDE this scroll layer
                — so they're part of the frosted panel's backdrop and actually
                get BLURRED as the panel scrolls up over them. Its fixed height
                (--dn-topbar-h, mirrored by the rail's identity block) is the top
                gap that keeps the tools visible at rest AND lands the panel's top
                edge level with the rail's first nav button. */}
            <div className="sticky top-0 z-0 hidden sm:flex items-center justify-end px-3 md:px-5 h-[var(--dn-topbar-h)]">
              {tools}
            </div>
            {/* Frosted panel — higher z, so it paints over (and backdrop-blurs)
                the tools as it rises, then bleeds over the top edge. */}
            <main className="dn-panel relative z-10 min-h-dvh">
              <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-8 md:pb-12">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  // Non-home: fixed panel + internal scroll, bleeding to all three edges. No
  // left padding on the row — the rail owns its own left padding so its hover
  // box reaches the screen's left edge.
  return (
    <div className="relative z-10 flex h-full flex-col">
      <div className="flex-1 flex min-h-0 gap-3">
        <SidebarNext name={name} />
        <main className="dn-panel dn-panel-square flex-1 min-w-0 relative overflow-hidden">
          <ScrollArea>{children}</ScrollArea>
        </main>
      </div>
    </div>
  );
}
