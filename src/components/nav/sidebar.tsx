"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Activity,
  Cpu,
  KeyRound,
  LayoutDashboard,
  Video,
} from "lucide-react";

const NAV = [
  { href: "/dashboard-legacy", label: "Dashboard", icon: LayoutDashboard, match: /^\/dashboard-legacy$/ },
  { href: "/dashboard-legacy/cameras", label: "Cameras", icon: Video, match: /^\/dashboard-legacy\/cameras/ },
  { href: "/dashboard-legacy/agents", label: "Agents", icon: Cpu, match: /^\/dashboard-legacy\/agents/ },
  {
    href: "/dashboard-legacy/stream-sessions",
    label: "Stream sessions",
    icon: Activity,
    match: /^\/dashboard-legacy\/stream-sessions/,
  },
  {
    href: "/dashboard-legacy/settings/api-tokens",
    label: "API tokens",
    icon: KeyRound,
    match: /^\/dashboard-legacy\/settings\/api-tokens/,
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:flex-col gap-1 w-60 shrink-0 p-3 glass rounded-3xl">
      <div className="px-3 py-3 mb-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-accent mono">
          upstream
        </p>
        <p className="display text-xl font-semibold mt-0.5">
          dash<em>board</em>
        </p>
      </div>
      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = item.match.test(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition",
                active
                  ? "bg-glass-bg text-ink border border-glass-stroke"
                  : "text-ink-soft hover:text-ink hover:bg-glass-bg/60 border border-transparent",
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
